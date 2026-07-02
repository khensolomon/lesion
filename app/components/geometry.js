import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

export class GeometryManager extends ExtensionComponent {
    
    onEnable() {
        this._trackingWindows = new Set(); // Keep track of windows we hooked
        this._saveTimeoutId = null;        // Debounce timer ID
        this._geometryCache = {};          // In-memory mirror of settings
        
        log("[Geometry] enabling manager");
        
        // 1. Load initial data
        this._loadCache();

        // 2. Watch for new windows
        const display = global.display;
        const id = display.connect('window-created', (d, win) => {
            this._onWindowCreated(win);
        });
        this._signals.push({ obj: display, id });

        // 3. Hook existing windows
        global.display.list_all_windows().forEach(win => {
            this._onWindowCreated(win);
        });

        // 4. Watch for toggle
        this.observe('changed::geometry-enabled', () => {
            if (!this.getSettings().get_boolean('geometry-enabled')) {
                this._cleanupWindows();
            } else {
                // FIX: re-hook existing windows when the feature is turned
                // back on; previously nothing happened until windows were
                // recreated.
                global.display.list_all_windows().forEach(win => {
                    this._onWindowCreated(win);
                });
            }
        });
    }

    /**
     * Compat: Meta.Window.get_maximized() was removed in GNOME 49.
     * Use is_maximized() when available, fall back to the property pair,
     * then to the legacy method.
     */
    _isMaximized(win) {
        if (typeof win.is_maximized === 'function') return win.is_maximized();
        if ('maximized_horizontally' in win)
            return win.maximized_horizontally && win.maximized_vertically;
        if (typeof win.get_maximized === 'function') return win.get_maximized() !== 0;
        return false;
    }

    onDisable() {
        if (this._saveTimeoutId) {
            GLib.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
            // FIX: flush the pending debounce write, otherwise the last ~2s
            // of window moves are silently lost on disable/lock.
            this._saveToDisk();
        }
        this._cleanupWindows();
    }

    _loadCache() {
        try {
            const json = this.getSettings().get_string('geometry-data');
            this._geometryCache = JSON.parse(json) || {};
        } catch (e) {
            this._geometryCache = {};
            logError("[Geometry] Failed to parse cache", e);
        }
    }

    _onWindowCreated(win) {
        if (!this.getSettings().get_boolean('geometry-enabled')) return;
        if (!win || win.get_window_type() === Meta.WindowType.DESKTOP) return;
        if (this._trackingWindows.has(win)) return; // FIX: never double-hook

        // Try to Restore.
        // FIX: defer to idle — on 'window-created' the frame is often not
        // sized yet, so an immediate move_resize_frame gets overridden by the
        // app's own initial placement.
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (this._trackingWindows.has(win)) this._restoreWindow(win);
            return GLib.SOURCE_REMOVE;
        });

        // Hook for changes
        const signals = [];
        signals.push(win.connect('size-changed', () => this._onWindowChanged(win)));
        signals.push(win.connect('position-changed', () => this._onWindowChanged(win)));

        // FIX: untrack when the window goes away, otherwise the Set leaks
        // dead MetaWindows and cleanup later throws on disposed objects.
        signals.push(win.connect('unmanaged', () => {
            this._untrackWindow(win);
        }));

        win._lesionGeometrySignals = signals;
        this._trackingWindows.add(win);
    }

    _untrackWindow(win) {
        if (win._lesionGeometrySignals) {
            win._lesionGeometrySignals.forEach(id => {
                try { win.disconnect(id); } catch (e) {}
            });
            win._lesionGeometrySignals = null;
        }
        this._trackingWindows.delete(win);
    }

    _restoreWindow(win) {
        // We use wm_class (App ID) as the key. 
        // Note: Some apps have dynamic titles, so wm_class is safer.
        const appId = win.get_wm_class(); 
        if (!appId || !this._geometryCache[appId]) return;

        const geo = this._geometryCache[appId];
        
        // Basic sanity check to ensure it's not 0x0
        if (geo.w > 50 && geo.h > 50) {
            log(`[Geometry] Restoring ${appId} to ${geo.x},${geo.y} [${geo.w}x${geo.h}]`);
            win.move_resize_frame(true, geo.x, geo.y, geo.w, geo.h);
        }
    }

    _onWindowChanged(win) {
        if (!this.getSettings().get_boolean('geometry-enabled')) return;
        
        // Skip maximized/fullscreen windows - we don't want to save "screen size" as the window size
        if (this._isMaximized(win) || win.is_fullscreen()) return;

        const appId = win.get_wm_class();
        if (!appId) return;

        const rect = win.get_frame_rect();

        // Update RAM cache immediately
        this._geometryCache[appId] = {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            last_seen: Date.now()
        };

        // Debounce the disk write (wait 2 seconds of inactivity)
        if (this._saveTimeoutId) {
            GLib.source_remove(this._saveTimeoutId);
        }

        this._saveTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._saveToDisk();
            return GLib.SOURCE_REMOVE;
        });
    }

    _saveToDisk() {
        this._saveTimeoutId = null;
        try {
            const json = JSON.stringify(this._geometryCache);
            this.getSettings().set_string('geometry-data', json);
            log("[Geometry] Saved state to disk.");
        } catch (e) {
            logError("[Geometry] Save failed", e);
        }
    }

    _cleanupWindows() {
        // Disconnect all window signals we added (safe against disposed windows)
        for (const win of [...this._trackingWindows]) {
            this._untrackWindow(win);
        }
        this._trackingWindows.clear();
    }
}