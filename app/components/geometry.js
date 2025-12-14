import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

export class GeometryManager extends ExtensionComponent {
    
    onEnable() {
        this._trackingWindows = new Set(); // Keep track of windows we hooked
        this._saveTimeoutId = null;        // Debounce timer ID
        this._geometryCache = {};          // In-memory mirror of settings
        
        log("[Geometry] Enabling manager...");
        
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
            }
        });
    }

    onDisable() {
        if (this._saveTimeoutId) {
            GLib.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
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

        // Try to Restore
        this._restoreWindow(win);

        // Hook for changes
        // We use 'connect' on the MetaWindow object
        const signals = [];
        
        // Size change
        signals.push(win.connect('size-changed', () => this._onWindowChanged(win)));
        // Position change
        signals.push(win.connect('position-changed', () => this._onWindowChanged(win)));

        // Store signal IDs to disconnect later (cleanup is important!)
        // We attach a custom property to the window object to track its own signals
        win._lesionGeometrySignals = signals;
        this._trackingWindows.add(win);
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
        if (win.get_maximized() || win.is_fullscreen()) return;

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
        // Disconnect all window signals we added
        for (const win of this._trackingWindows) {
            if (win._lesionGeometrySignals) {
                win._lesionGeometrySignals.forEach(id => win.disconnect(id));
                win._lesionGeometrySignals = null;
            }
        }
        this._trackingWindows.clear();
    }
}