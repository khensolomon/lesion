import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';
import { isMaximized } from '../util/compat.js';

/**
 * Uniform window corner rounding.
 *
 * Rounds ALL four corners of every normal window with an antialiased GPU
 * mask, so legacy apps with rounded tops and flat bottoms look consistent
 * with modern ones. Maximized and fullscreen windows are automatically
 * square (radius forced to 0), matching the user's expectation that a
 * maximized window should not float on rounded corners.
 *
 * What the previous implementation got wrong, and this one fixes:
 *
 * 1. FRAME-AWARE MASKING. A window's actor buffer includes the drop-shadow
 *    margins around the visible window (30+ px per side for CSD apps).
 *    Rounding the ACTOR's corners therefore rounded the invisible shadow,
 *    not the window. The mask here is computed against the frame rect's
 *    position INSIDE the buffer, passed to the shader as uniforms; pixels
 *    outside the frame (the shadow) are left untouched.
 *
 * 2. Shell.GLSLEffect snippet instead of the legacy Clutter.ShaderEffect
 *    + set_shader_source path, and smoothstep antialiasing instead of
 *    'discard' (which produced jagged staircase edges).
 *
 * 3. No shell-CSS side effects: the old version injected '!important'
 *    rules on '#panel .panel-button', fighting PanelsManager's styling.
 *    This component touches application windows only.
 *
 * Deliberate non-feature: a "force square" mode is not possible. Client-
 * side-decorated apps draw their own rounded top corners; the pixels
 * outside that curve do not exist in the client's buffer, and a shader can
 * only remove pixels, never invent window content. Uniformity is achieved
 * by rounding the flat corners to match, never the reverse.
 */

const DECLARATIONS = `
uniform vec4 bounds;      // frame rect inside the buffer: x1, y1, x2, y2
uniform float clip_radius;
uniform vec2 tex_size;    // buffer size
`;

// Nearest-point-on-inner-rect trick: for pixels inside the frame, clamp the
// position to the radius-inset rect; the distance to that point is 0 for the
// whole interior and grows only inside the corner squares, giving a perfect
// circular falloff with 1px smoothstep antialiasing.
const CODE = `
vec2 pos = cogl_tex_coord0_in.xy * tex_size;
if (clip_radius > 0.5 &&
    pos.x >= bounds.x && pos.y >= bounds.y &&
    pos.x <= bounds.z && pos.y <= bounds.w) {
    vec2 fmin = bounds.xy + vec2(clip_radius);
    vec2 fmax = bounds.zw - vec2(clip_radius);
    vec2 nearest = clamp(pos, fmin, fmax);
    float d = distance(pos, nearest) - clip_radius;
    cogl_color_out = cogl_color_out * (1.0 - smoothstep(-0.5, 0.5, d));
}
`;

const RoundedCornersEffect = GObject.registerClass({
    GTypeName: 'LesionRoundedCornersEffect',
}, class RoundedCornersEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(frameX, frameY, frameW, frameH, bufW, bufH, radius) {
        try {
            this.set_uniform_float(this.get_uniform_location('bounds'), 4,
                [frameX, frameY, frameX + frameW, frameY + frameH]);
            this.set_uniform_float(this.get_uniform_location('clip_radius'), 1, [radius]);
            this.set_uniform_float(this.get_uniform_location('tex_size'), 2, [bufW, bufH]);
            this.queue_repaint();
        } catch (e) {
            logError('[Corners] uniform update failed', e);
        }
    }
});

export class CornersManager extends ExtensionComponent {

    onEnable() {
        // win -> { effect, sigs: [] }
        this._windows = new Map();

        const id = global.display.connect('window-created', (d, win) => {
            // The compositor actor may not exist yet at this point
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
        if (!this._shouldRound(win) || this._windows.has(win)) return;

        const actor = win.get_compositor_private();
        if (!actor) return;

        const effect = new RoundedCornersEffect();
        try {
            actor.add_effect_with_name('lesion-corners', effect);
        } catch (e) {
            logError('[Corners] failed to attach effect', e);
            return;
        }

        const sigs = [];
        // size-changed also fires on maximize/unmaximize/fullscreen, which
        // is what flips the radius to 0 and back.
        sigs.push(win.connect('size-changed', () => this._updateWindow(win)));
        sigs.push(win.connect('unmanaged', () => this._detachWindow(win)));

        this._windows.set(win, { effect, sigs });
        this._updateWindow(win);
    }

    _updateWindow(win) {
        const rec = this._windows.get(win);
        if (!rec) return;

        try {
            const buffer = win.get_buffer_rect();
            const frame = win.get_frame_rect();

            let radius = this.getSettings().get_int('corners-radius');
            if (isMaximized(win) || win.is_fullscreen())
                radius = 0; // Square when maximized/fullscreen
            radius = Math.min(radius, Math.floor(Math.min(frame.width, frame.height) / 2));

            rec.effect.update(
                frame.x - buffer.x,
                frame.y - buffer.y,
                frame.width,
                frame.height,
                buffer.width,
                buffer.height,
                radius
            );
        } catch (e) {
            logError('[Corners] update failed', e);
        }
    }

    _detachWindow(win) {
        const rec = this._windows.get(win);
        if (!rec) return;

        rec.sigs.forEach(id => {
            try { win.disconnect(id); } catch (e) {}
        });
        try {
            const actor = win.get_compositor_private();
            if (actor) actor.remove_effect_by_name('lesion-corners');
        } catch (e) {}

        this._windows.delete(win);
    }

    _detachAll() {
        for (const win of [...this._windows.keys()])
            this._detachWindow(win);
    }
}
