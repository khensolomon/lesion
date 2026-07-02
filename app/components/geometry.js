import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';
import { isMaximized } from '../util/compat.js';

/**
 * Remembers per-app window geometry (keyed by wm_class) and restores it when
 * a NEW window of that app is created.
 *
 * Design rules (each one fixes a real bug from the previous version):
 *
 * 1. NEVER restore already-open windows on enable. GNOME re-enables
 *    extensions on every unlock and shell restart; restoring then snapped
 *    every open window back to its saved slot, scrambling the workspace.
 *    Existing windows are tracked (for saving) only.
 *
 * 2. A new window is "unsettled" until restore has run plus a grace period.
 *    Changes from unsettled windows are IGNORED, so the app's own initial
 *    self-placement can no longer overwrite the saved slot before restore
 *    reads it (the old save/restore race).
 *
 * 3. wm_class is often still null at 'window-created' (especially Wayland).
 *    Restore polls briefly until it appears instead of giving up.
 *
 * 4. Only NORMAL, non-transient, non-skip-taskbar windows are handled.
 *    Dialogs sharing the app's wm_class used to overwrite the app's slot
 *    with dialog-sized geometry.
 *
 * 5. Restored geometry is clamped to the window's current work area, so a
 *    layout saved on a monitor that is gone (or not yet configured during
 *    login) cannot push windows off-screen.
 *
 * 6. The store is pruned (age + size cap) so 'geometry-data' cannot grow
 *    without bound.
 */

// Tuning constants
const WM_CLASS_POLL_MS = 250;     // Poll interval while waiting for wm_class
const WM_CLASS_MAX_TRIES = 8;     // ~2s total before giving up on restore
const SETTLE_GRACE_MS = 1000;     // Ignore self-placement for this long after restore
const SAVE_DEBOUNCE_SEC = 2;      // Disk write debounce
const PRUNE_MAX_AGE_DAYS = 180;   // Drop entries not seen for this long
const PRUNE_MAX_ENTRIES = 300;    // Hard cap on stored apps

export class GeometryManager extends ExtensionComponent {

    onEnable() {
        this._saveTimeoutId = null;
        this._geometryCache = {};
        // win -> { signals: [], settled: bool, timerId: 0 }
        this._windowData = new Map();

        log("[Geometry] enabling manager");

        this._loadCache();
        this._pruneCache();

        const display = global.display;
        const id = display.connect('window-created', (d, win) => {
            // New window: track AND restore
            this._trackWindow(win, true);
        });
        this._signals.push({ obj: display, id });

        // Existing windows: track only — see design rule 1.
        global.display.list_all_windows().forEach(win => this._trackWindow(win, false));

        this.observe('changed::geometry-enabled', () => {
            if (!this.getSettings().get_boolean('geometry-enabled')) {
                this._cleanupWindows();
            } else {
                global.display.list_all_windows().forEach(win => this._trackWindow(win, false));
            }
        });
    }

    onDisable() {
        if (this._saveTimeoutId) {
            GLib.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
            // Flush the pending debounce write so the last moves aren't lost
            this._saveToDisk();
        }
        this._cleanupWindows();
    }

    // --- Tracking ------------------------------------------------------

    _shouldManage(win) {
        if (!win) return false;
        // NORMAL only: dialogs, popups, tooltips, docks and menus must not
        // read from or write to the per-app slot.
        if (win.get_window_type() !== Meta.WindowType.NORMAL) return false;
        try {
            if (typeof win.get_transient_for === 'function' && win.get_transient_for()) return false;
            if (typeof win.is_skip_taskbar === 'function' && win.is_skip_taskbar()) return false;
        } catch (e) {}
        return true;
    }

    _trackWindow(win, isNew) {
        if (!this.getSettings().get_boolean('geometry-enabled')) return;
        if (!this._shouldManage(win)) return;
        if (this._windowData.has(win)) return;

        const data = {
            signals: [],
            // Pre-existing windows were placed by the user already, so their
            // changes are trustworthy immediately. New windows must settle
            // first (design rule 2).
            settled: !isNew,
            timerId: 0,
        };
        this._windowData.set(win, data);

        data.signals.push(win.connect('unmanaged', () => this._untrackWindow(win)));
        data.signals.push(win.connect('size-changed', () => this._onWindowChanged(win)));
        data.signals.push(win.connect('position-changed', () => this._onWindowChanged(win)));

        if (isNew)
            this._scheduleRestore(win, data, 0);
    }

    _untrackWindow(win) {
        const data = this._windowData.get(win);
        if (!data) return;

        if (data.timerId) {
            GLib.source_remove(data.timerId);
            data.timerId = 0;
        }
        data.signals.forEach(id => {
            try { win.disconnect(id); } catch (e) {}
        });
        this._windowData.delete(win);
    }

    _cleanupWindows() {
        for (const win of [...this._windowData.keys()])
            this._untrackWindow(win);
    }

    // --- Restore -------------------------------------------------------

    /**
     * Restores once wm_class is available (polling briefly — Wayland apps
     * often set it after 'window-created'), then marks the window settled
     * after a grace period so saving can begin.
     */
    _scheduleRestore(win, data, attempt) {
        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            attempt === 0 ? 50 : WM_CLASS_POLL_MS, () => {
                data.timerId = 0;
                if (!this._windowData.has(win)) return GLib.SOURCE_REMOVE;

                let appId = null;
                try { appId = win.get_wm_class(); } catch (e) {}

                if (!appId && attempt < WM_CLASS_MAX_TRIES) {
                    this._scheduleRestore(win, data, attempt + 1);
                    return GLib.SOURCE_REMOVE;
                }

                if (appId)
                    this._restoreWindow(win, appId);

                // Grace period before this window's own events count as
                // user changes worth persisting.
                data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_GRACE_MS, () => {
                    data.timerId = 0;
                    data.settled = true;
                    return GLib.SOURCE_REMOVE;
                });
                return GLib.SOURCE_REMOVE;
            });
    }

    _restoreWindow(win, appId) {
        const geo = this._geometryCache[appId];
        if (!geo) return;

        // Don't fight the compositor over maximized/fullscreen windows
        if (isMaximized(win) || win.is_fullscreen()) return;

        // Basic sanity check to ensure it's not 0x0
        if (!(geo.w > 50 && geo.h > 50)) return;

        let { x, y, w, h } = geo;

        // Clamp to the current work area (design rule 5)
        try {
            const wa = win.get_work_area_current_monitor();
            if (wa && wa.width > 0 && wa.height > 0) {
                w = Math.min(w, wa.width);
                h = Math.min(h, wa.height);
                x = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
                y = Math.max(wa.y, Math.min(y, wa.y + wa.height - h));
            }
        } catch (e) {}

        log(`[Geometry] Restoring ${appId} to ${x},${y} [${w}x${h}]`);
        try {
            win.move_resize_frame(true, x, y, w, h);
            geo.last_seen = Date.now();
        } catch (e) {
            logError(`[Geometry] Restore failed for ${appId}`, e);
        }
    }

    // --- Save ----------------------------------------------------------

    _onWindowChanged(win) {
        if (!this.getSettings().get_boolean('geometry-enabled')) return;

        const data = this._windowData.get(win);
        // Unsettled = the app is still doing its initial self-placement, or
        // our own restore is in flight. Never persist those values.
        if (!data || !data.settled) return;

        // Skip maximized/fullscreen — we don't want "screen size" as the size
        if (isMaximized(win) || win.is_fullscreen()) return;

        const appId = win.get_wm_class();
        if (!appId) return;

        const rect = win.get_frame_rect();
        if (rect.width < 50 || rect.height < 50) return;

        this._geometryCache[appId] = {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            last_seen: Date.now()
        };

        if (this._saveTimeoutId)
            GLib.source_remove(this._saveTimeoutId);

        this._saveTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, SAVE_DEBOUNCE_SEC, () => {
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

    // --- Store maintenance ----------------------------------------------

    _loadCache() {
        try {
            const json = this.getSettings().get_string('geometry-data');
            this._geometryCache = JSON.parse(json) || {};
        } catch (e) {
            this._geometryCache = {};
            logError("[Geometry] Failed to parse cache", e);
        }
    }

    /**
     * Drops entries not seen for PRUNE_MAX_AGE_DAYS and caps the store at
     * PRUNE_MAX_ENTRIES (oldest first), so 'geometry-data' can't grow forever.
     */
    _pruneCache() {
        try {
            const now = Date.now();
            const maxAge = PRUNE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
            let entries = Object.entries(this._geometryCache)
                .filter(([, geo]) => !geo.last_seen || (now - geo.last_seen) < maxAge);

            if (entries.length > PRUNE_MAX_ENTRIES) {
                entries.sort((a, b) => (b[1].last_seen || 0) - (a[1].last_seen || 0));
                entries = entries.slice(0, PRUNE_MAX_ENTRIES);
            }

            const pruned = Object.fromEntries(entries);
            const removed = Object.keys(this._geometryCache).length - entries.length;
            if (removed > 0) {
                this._geometryCache = pruned;
                this._saveToDisk();
                log(`[Geometry] Pruned ${removed} stale entries.`);
            }
        } catch (e) {
            logError("[Geometry] Prune failed", e);
        }
    }
}
