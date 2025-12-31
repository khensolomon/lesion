import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio'; // Added missing import
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

// --- GLSL SHADER SOURCE ---
// This runs on the GPU for every pixel of the window.
// It calculates if a pixel is outside the corner radius and discards it.
const SHADER_SOURCE = `
uniform sampler2D tex;
uniform float height;
uniform float width;
uniform float radius;

void main () {
    // Standard texture lookup
    vec4 color = cogl_color_in * texture2D(tex, cogl_tex_coord_in[0].xy);
    
    // Convert texture coordinates (0.0 - 1.0) to pixel coordinates
    vec2 pos = cogl_tex_coord_in[0].xy * vec2(width, height);
    
    // Determine the center of the closest corner circle
    vec2 center = vec2(0.0);
    bool in_corner = false;
    
    if (pos.x < radius && pos.y < radius) {
        // Top Left
        center = vec2(radius, radius);
        in_corner = true;
    } else if (pos.x > width - radius && pos.y < radius) {
        // Top Right
        center = vec2(width - radius, radius);
        in_corner = true;
    } else if (pos.x < radius && pos.y > height - radius) {
        // Bottom Left
        center = vec2(radius, height - radius);
        in_corner = true;
    } else if (pos.x > width - radius && pos.y > height - radius) {
        // Bottom Right
        center = vec2(width - radius, height - radius);
        in_corner = true;
    }
    
    // If we are in a corner region, check distance from center
    if (in_corner) {
        if (distance(pos, center) > radius) {
            discard; // Cut it out!
        }
    }
    
    cogl_color_out = color;
}
`;

// --- CUSTOM EFFECT CLASS ---
// Wraps the generic Clutter.ShaderEffect to handle our uniforms (radius, size)
const RoundedCornerEffect = GObject.registerClass({
    GTypeName: 'LesionRoundedCornerEffect',
}, class RoundedCornerEffect extends Clutter.ShaderEffect {
    _init(radius) {
        super._init({ shader_type: Clutter.ShaderType.FRAGMENT_SHADER });
        this._radius = radius;
        this.set_shader_source(SHADER_SOURCE);
    }

    vfunc_paint_target(paint_node, paint_context) {
        const actor = this.get_actor();
        if (!actor) return;

        const [width, height] = actor.get_size();

        // Pass uniforms to the GPU
        // Fix: Ensure values are explicitly floats for the shader
        this.set_uniform_value('width', parseFloat(width));
        this.set_uniform_value('height', parseFloat(height));
        this.set_uniform_value('radius', parseFloat(this._radius));

        // Chain up to draw
        super.vfunc_paint_target(paint_node, paint_context);
    }

    updateRadius(radius) {
        this._radius = radius;
        this.queue_repaint();
    }
});

/**
 * Manages Window Effects (Mutter Level) and Shell Styles
 */
export class CornersManager extends ExtensionComponent {
    
    onEnable() {
        logError("CornersManager (Mutter): Initializing...");
        
        this._cssFile = null;
        this._generatedFile = 'dynamic-corners.css';
        this._windowSignals = []; // Track signals connected to individual window objects if needed
        this._displaySignal = null;
        
        // Initial Sync
        this._sync();

        // Settings Listeners
        this.observe('changed::corners-enabled', () => this._sync());
        this.observe('changed::corners-radius', () => {
            // Live update for radius to avoid full destruction/recreation
            this._updateExistingWindowsRadius(); 
        });
        this.observe('changed::corners-flat', () => this._sync());
    }

    onDisable() {
        logError("CornersManager: Disabling...");
        this._disableWindowEffects();
        this._unloadShellStyles();
    }

    _sync() {
        const settings = this.getSettings();
        const enabled = settings.get_boolean('corners-enabled');

        if (!enabled) {
            this._disableWindowEffects();
            this._unloadShellStyles();
            return;
        }

        const isFlat = settings.get_boolean('corners-flat');
        const radius = isFlat ? 0 : settings.get_int('corners-radius');

        // 1. Shell UI (Still needs CSS)
        this._syncShell(radius, isFlat);

        // 2. Windows (Mutter Shader)
        // If flat, we just disable the effect (radius 0 shader is wasteful)
        if (isFlat || radius === 0) {
            this._disableWindowEffects();
        } else {
            this._enableWindowEffects(radius);
        }
    }

    // --- WINDOW MANAGEMENT (MUTTER/CLUTTER) ---

    // Helper to abstract the API change across GNOME versions
    _getWindowActors() {
        if (global.get_window_actors) {
            return global.get_window_actors();
        }
        
        // GNOME 45+ fallback: Iterate MetaWindows and get their actors
        const actors = [];
        const windows = global.display.list_all_windows(); 
        for (const win of windows) {
            const actor = win.get_compositor_private();
            if (actor) actors.push(actor);
        }
        return actors;
    }

    _enableWindowEffects(radius) {
        logError(`CornersManager: Enabling Window Shaders (r=${radius})`);
        
        // 1. Apply to existing windows
        this._getWindowActors().forEach(actor => {
            this._applyEffectToActor(actor, radius);
        });

        // 2. Watch for new windows
        if (!this._displaySignal) {
            this._displaySignal = global.display.connect('window-created', (display, window) => {
                // Wait for the actor to be ready
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                   const actor = window.get_compositor_private();
                   if (actor) {
                       this._applyEffectToActor(actor, radius);
                   }
                   return GLib.SOURCE_REMOVE;
                });
            });
        }
    }

    _disableWindowEffects() {
        // 1. Stop watching
        if (this._displaySignal) {
            global.display.disconnect(this._displaySignal);
            this._displaySignal = null;
        }

        // 2. Remove effects
        this._getWindowActors().forEach(actor => {
            this._removeEffectFromActor(actor);
        });
    }

    _applyEffectToActor(actor, radius) {
        if (!actor || actor.is_destroyed()) return;

        // Skip if already has OUR effect
        const existing = actor.get_effect('lesion-corners');
        if (existing) {
            if (existing instanceof RoundedCornerEffect) {
                existing.updateRadius(radius);
            }
            return;
        }

        // Check window type (don't round fullscreen, desktop, etc)
        const win = actor.meta_window;
        if (win) {
             const type = win.get_window_type();
             if (type === Meta.WindowType.DESKTOP || 
                 type === Meta.WindowType.DOCK || 
                 win.is_fullscreen()) {
                 return;
             }
        }

        const effect = new RoundedCornerEffect(radius);

        // Fix: Add resize listener to trigger repaint when window size changes
        const sizeId = actor.connect('notify::size', () => effect.queue_repaint());
        effect._sizeSignalId = sizeId; // Store signal ID on the effect for cleanup

        actor.add_effect_with_name('lesion-corners', effect);
    }

    _removeEffectFromActor(actor) {
        if (!actor || actor.is_destroyed()) return;
        
        const effect = actor.get_effect('lesion-corners');
        if (effect) {
            // Cleanup the size listener we added
            if (effect._sizeSignalId) {
                actor.disconnect(effect._sizeSignalId);
            }
            actor.remove_effect_by_name('lesion-corners');
        }
    }

    _updateExistingWindowsRadius() {
        const settings = this.getSettings();
        const isFlat = settings.get_boolean('corners-flat');
        const radius = isFlat ? 0 : settings.get_int('corners-radius');

        if (isFlat || radius === 0) {
            this._disableWindowEffects();
            return;
        }

        // If not running, start running
        if (!this._displaySignal) {
            this._enableWindowEffects(radius);
            return;
        }

        // Just update values
        this._getWindowActors().forEach(actor => {
            const effect = actor.get_effect('lesion-corners');
            if (effect && effect instanceof RoundedCornerEffect) {
                effect.updateRadius(radius);
            } else {
                this._applyEffectToActor(actor, radius);
            }
        });
    }

    // --- SHELL UI (CSS) ---
    // Kept for Panels, Search, etc.
    
    _syncShell(radius, isFlat) {
        this._unloadShellStyles();
        
        // Ensure style dir exists
        const styleDir = GLib.build_filenamev([this._extension.path, 'style']);
        try {
             if (!GLib.file_test(styleDir, GLib.FileTest.EXISTS)) {
                 Gio.File.new_for_path(styleDir).make_directory_with_parents(null);
             }
        } catch(e) {}

        const cssContent = `
            .window-clone-border, 
            .modal-dialog, 
            .workspace-thumbnail-indicator,
            #panel,
            #panel .panel-button,
            .overview-controls,
            .window-preview {
                border-radius: ${radius}px !important;
            }
            ${isFlat ? `#panel, .panel-button { border-radius: 0px !important; }` : ''}
        `;

        try {
            const path = GLib.build_filenamev([styleDir, this._generatedFile]);
            const file = Gio.File.new_for_path(path);
            file.replace_contents(cssContent, null, false, Gio.FileCreateFlags.NONE, null);

            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            const theme = themeContext.get_theme();
            theme.load_stylesheet(file);
            this._cssFile = file;
            themeContext.set_theme(theme);
        } catch (e) {
            logError("Failed to apply shell corners", e);
        }
    }

    _unloadShellStyles() {
        if (this._cssFile) {
            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            const theme = themeContext.get_theme();
            theme.unload_stylesheet(this._cssFile);
            this._cssFile = null;
            themeContext.set_theme(theme);
        }
    }
}