import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';
import { isMaximized } from '../util/compat.js';

/**
 * Uniform window corner rounding — architecture ported from Rounded Window
 * Corners Reborn (the field-proven implementation).
 *
 * THE KEY INSIGHT (learned the hard way): a window's drop shadow is drawn by
 * the app itself, shaped for the window's ORIGINAL corners, and hugs them
 * densely. Cutting a rounded corner exposes the shadow that was hiding
 * underneath — a gray smudge at every corner, visible over light backgrounds
 * and invisible over dark ones. No amount of mask tuning can fix that,
 * because the smudge isn't the mask: it's the shadow. The only correct
 * design, and the one RWC uses, is:
 *
 *   1. The mask shader deletes EVERYTHING outside the frame bounds — the
 *      app's entire in-buffer shadow — in addition to rounding the corners.
 *   2. A dedicated shadow actor below the window paints a replacement
 *      shadow shaped for the ROUNDED window: an St.Bin whose inner child is
 *      a white rounded box with a CSS box-shadow. The white body exists
 *      only so CSS has something to cast a shadow from; a second small
 *      shader (ClipShadowEffect) erases bright pixels, leaving only the
 *      shadow itself.
 *   3. The shadow actor is geometry-bound to the window actor (position,
 *      size via BindConstraints; pivot/translation/scale/visible via
 *      property bindings) so it tracks moves, resizes, and animations.
 */

const SHADOW_PADDING = 80; // px of room around the frame for the CSS shadow

const DECLARATIONS = `
uniform vec4 bounds;      // frame rect inside the buffer: x1, y1, x2, y2
uniform float clip_radius;
uniform vec2 tex_size;    // size of the actor the effect is attached to
`;

// Masking (RWC math): everything outside the frame is removed (that's the
// app's own shadow — replaced by our shadow actor); inside the frame, the
// corner circle test runs with an antialiasing band centered on the curve
// (radius +/- 0.5, linear falloff), touching only the corner squares.
const CODE = `
vec2 pos = cogl_tex_coord0_in.xy * tex_size;
if (clip_radius > 0.5) {
    if (pos.x < bounds.x || pos.y < bounds.y ||
        pos.x > bounds.z || pos.y > bounds.w) {
        cogl_color_out = vec4(0.0);
    } else {
        vec2 fmin = bounds.xy + vec2(clip_radius);
        vec2 fmax = bounds.zw - vec2(clip_radius);
        bool corner_x = pos.x < fmin.x || pos.x > fmax.x;
        bool corner_y = pos.y < fmin.y || pos.y > fmax.y;
        if (corner_x && corner_y) {
            vec2 center = clamp(pos, fmin, fmax);
            vec2 delta = pos - center;
            float distSq = dot(delta, delta);
            float outer = clip_radius + 0.5;
            float inner = clip_radius - 0.5;
            float f = 1.0;
            if (distSq >= outer * outer)
                f = 0.0;
            else if (distSq > inner * inner)
                f = outer - sqrt(distSq);
            cogl_color_out = cogl_color_out * f;
        }
    }
}
`;

const RoundedCornersEffect = GObject.registerClass({
    GTypeName: 'LesionRoundedCornersEffect',
}, class RoundedCornersEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(frameX, frameY, frameW, frameH, texW, texH, radius) {
        try {
            // RWC insets the top-left by 1px so the shadow actor's body can
            // never peek out along that edge.
            this.set_uniform_float(this.get_uniform_location('bounds'), 4,
                [frameX + 1, frameY + 1, frameX + frameW, frameY + frameH]);
            this.set_uniform_float(this.get_uniform_location('clip_radius'), 1, [radius]);
            this.set_uniform_float(this.get_uniform_location('tex_size'), 2, [texW, texH]);
            this.queue_repaint();
        } catch (e) {
            logError('[Corners] uniform update failed', e);
        }
    }
});

// Erases the shadow actor's white body: bright pixels are attenuated, dark
// shadow pixels kept. Straight port of RWC's clip_shadow.frag, needed
// because of https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4474
const CLIP_SHADOW_CODE = `
vec4 c = cogl_color_out;
float gray = (c.r + c.g + c.b) / 3.0;
cogl_color_out *= (1.0 - smoothstep(0.4, 1.0, gray)) * c.a;
`;

const ClipShadowEffect = GObject.registerClass({
    GTypeName: 'LesionClipShadowEffect',
}, class ClipShadowEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, '', CLIP_SHADOW_CODE, false);
    }
});

export class CornersManager extends ExtensionComponent {

    onEnable() {
        // win -> { effect, sigs, actor, target, shadow, bindings }
        this._windows = new Map();

        const id = global.display.connect('window-created', (d, win) => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this._maybeAttach(win);
                return GLib.SOURCE_REMOVE;
            });
        });
        this._signals.push({ obj: global.display, id });

        this._syncAll();

        this.observe('changed::corners-enabled', () => this._syncAll());
        this.observe('changed::corners-radius', () => this._syncAll());
    }

    onDisable() {
        this._detachAll();
    }

    _enabled() {
        return this.getSettings().get_boolean('corners-enabled') &&
               this.getSettings().get_int('corners-radius') > 0;
    }

    _syncAll() {
        if (!this._enabled()) {
            this._detachAll();
            return;
        }
        global.display.list_all_windows().forEach(win => this._maybeAttach(win));
        for (const win of this._windows.keys())
            this._updateWindow(win);
    }

    _shouldRound(win) {
        if (!win) return false;
        const t = win.get_window_type();
        return t === Meta.WindowType.NORMAL ||
               t === Meta.WindowType.DIALOG ||
               t === Meta.WindowType.MODAL_DIALOG;
    }

    _maybeAttach(win) {
        if (!this._enabled()) return;
        if (this._windows.has(win)) return;
        if (!this._shouldRound(win)) {
            log(`[Corners] skipping '${win?.get_wm_class?.() ?? '?'}' (type=${win?.get_window_type?.()})`);
            return;
        }

        const actor = win.get_compositor_private();
        if (!actor) {
            try {
                const id = win.connect('shown', () => {
                    try { win.disconnect(id); } catch (e) {}
                    this._maybeAttach(win);
                });
            } catch (e) {}
            return;
        }

        // X11 clients (e.g. VSCode/Electron under Xwayland): the effect must
        // live on the surface child, not the window actor.
        let target = actor;
        try {
            if (win.get_client_type &&
                win.get_client_type() === Meta.WindowClientType.X11) {
                target = actor.get_first_child() ?? actor;
            }
        } catch (e) {}

        const effect = new RoundedCornersEffect();
        try {
            target.add_effect_with_name('lesion-corners', effect);
        } catch (e) {
            logError('[Corners] failed to attach effect', e);
            return;
        }

        const shadow = this._createShadow(actor);

        const sigs = [];
        sigs.push(win.connect('size-changed', () => this._updateWindow(win)));
        sigs.push(win.connect('notify::appears-focused', () => this._updateWindow(win)));
        sigs.push(win.connect('unmanaged', () => this._detachWindow(win)));

        this._windows.set(win, { effect, sigs, actor, target, ...shadow });
        this._updateWindow(win);

        log(`[Corners] attached to '${win.get_wm_class?.() ?? '?'}' ` +
            `type=${win.get_window_type()} client=${win.get_client_type?.()}`);
    }

    /**
     * Builds the replacement shadow: an outer bin (frame + padding) whose
     * inner child is the white rounded shadow-caster, placed just below the
     * window actor and geometry-bound to it.
     */
    _createShadow(actor) {
        const shadow = new St.Bin({
            name: 'lesion-shadow',
            style: `padding: ${SHADOW_PADDING}px;`,
            child: new St.Bin({ x_expand: true, y_expand: true }),
        });

        try {
            shadow.add_effect_with_name('lesion-clip-shadow', new ClipShadowEffect());
        } catch (e) {}

        global.window_group.insert_child_below(shadow, actor);

        // Track position and size
        for (let i = 0; i < 4; i++) {
            shadow.add_constraint(new Clutter.BindConstraint({
                source: actor,
                coordinate: i, // X, Y, WIDTH, HEIGHT
                offset: 0,
            }));
        }

        // Track animations and visibility
        const bindings = [];
        for (const prop of ['pivot-point', 'translation-x', 'translation-y',
                            'scale-x', 'scale-y', 'visible', 'opacity']) {
            try {
                bindings.push(actor.bind_property(prop, shadow, prop,
                    GObject.BindingFlags.SYNC_CREATE));
            } catch (e) {}
        }

        return { shadow, bindings };
    }

    _updateWindow(win) {
        const rec = this._windows.get(win);
        if (!rec) return;

        try {
            const buffer = win.get_buffer_rect();
            const frame = win.get_frame_rect();

            let radius = this.getSettings().get_int('corners-radius');
            if (isMaximized(win) || win.is_fullscreen())
                radius = 0;
            radius = Math.min(radius, Math.floor(Math.min(frame.width, frame.height) / 2));

            const tw = rec.target?.get_width?.() || buffer.width;
            const th = rec.target?.get_height?.() || buffer.height;

            rec.effect.update(
                frame.x - buffer.x,
                frame.y - buffer.y,
                frame.width,
                frame.height,
                tw,
                th,
                radius
            );

            this._updateShadow(win, rec, frame, buffer, radius);
        } catch (e) {
            logError('[Corners] update failed', e);
        }
    }

    _updateShadow(win, rec, frame, buffer, radius) {
        if (!rec.shadow) return;

        // Outer bin covers frame + SHADOW_PADDING on all sides; the actor
        // (source of the constraints) is the buffer rect, so offset by the
        // frame-buffer delta.
        const ox = frame.x - buffer.x;
        const oy = frame.y - buffer.y;
        const offsets = [
            ox - SHADOW_PADDING,
            oy - SHADOW_PADDING,
            (frame.width - buffer.width) + 2 * SHADOW_PADDING,
            (frame.height - buffer.height) + 2 * SHADOW_PADDING,
        ];
        rec.shadow.get_constraints().forEach((c, i) => {
            if (c instanceof Clutter.BindConstraint)
                c.offset = offsets[i];
        });

        const child = rec.shadow.get_child();
        if (!child) return;

        let style;
        if (radius <= 0) {
            // Maximized/fullscreen: no shadow needed
            style = 'opacity: 0;';
        } else {
            const shadowCss = win.appears_focused
                ? 'box-shadow: 0 4px 20px 5px rgba(0,0,0,0.32);'
                : 'box-shadow: 0 2px 10px 2px rgba(0,0,0,0.18);';
            style = `background: white; border-radius: ${radius}px; ${shadowCss}`;
        }
        if (child.style !== style) {
            child.style = style;
            child.queue_redraw();
        }
    }

    _detachWindow(win) {
        const rec = this._windows.get(win);
        if (!rec) return;

        rec.sigs.forEach(id => {
            try { win.disconnect(id); } catch (e) {}
        });
        (rec.bindings || []).forEach(b => {
            try { b.unbind(); } catch (e) {}
        });
        try {
            if (rec.shadow) rec.shadow.destroy();
        } catch (e) {}
        try {
            const target = rec.target ?? rec.actor ?? win.get_compositor_private();
            if (target) target.remove_effect_by_name('lesion-corners');
        } catch (e) {}

        this._windows.delete(win);
    }

    _detachAll() {
        for (const win of [...this._windows.keys()])
            this._detachWindow(win);
    }
}
