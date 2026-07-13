import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';
import { isMaximized, maximize, unmaximize } from '../util/compat.js';

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
const WM_CLASS_POLL_MS = 250;     // Poll interval while waiting for the app identity
const WM_CLASS_MAX_TRIES = 12;    // ~3s: identities can CHANGE after mapping (see below)
const SETTLE_GRACE_MS = 600;      // Grace after the last verify pass
const VERIFY_DELAY_MS = 500;      // Delay between restore verification passes
const VERIFY_MAX_TRIES = 4;       // Reapply attempts against app self-placement
const SAVE_DEBOUNCE_SEC = 2;      // Disk write debounce
const PRUNE_MAX_AGE_DAYS = 180;   // Drop entries not seen for this long
const PRUNE_MAX_ENTRIES = 300;    // Hard cap on stored apps
const MAX_TITLES_PER_APP = 10;    // Per-title sub-slots kept per app
const ANIMATE_AFTER_MS = 250;     // Window visible longer than this -> fade-move, don't snap
const FADE_OUT_MS = 90;           // Fade-out before an already-visible window is moved
const FADE_IN_MS = 140;           // Fade-in at the destination
const MOVE_MIN_DELTA = 8;         // Don't animate sub-8px corrections

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
            restored: false,
            wmClassSignalId: 0,
            timerId: 0,
            createdAt: GLib.get_monotonic_time(),
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

        try {
            const actor = win.get_compositor_private();
            if (actor) {
                // A disable mid-fade must not leave the window invisible
                actor.remove_transition('opacity');
                if (actor.opacity === 0) actor.opacity = 255;
            }
        } catch (e) {}

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
    /**
     * Waits for the window's FINAL app identity before restoring.
     *
     * Crucial detail: get_wm_class() being non-null is NOT enough. Several
     * apps establish or CHANGE their identity after the window exists —
     * Firefox maps as 'firefox' and later becomes 'firefox_firefox', Chrome
     * mutates similarly, and GTK4 single-instance apps (Nautilus, Text
     * Editor, Settings, Boxes) settle their app-id late. Saves always run
     * later, under the final identity — so looking up the cache with the
     * EARLY identity finds nothing and restore silently never happened for
     * exactly those apps. We therefore keep polling until the identity
     * matches a saved entry (or attempts run out), and also react to
     * 'notify::wm-class' in case the change lands between polls.
     */
    _scheduleRestore(win, data, attempt) {
        // React immediately if the identity changes mid-wait
        if (attempt === 0 && !data.wmClassSignalId) {
            try {
                data.wmClassSignalId = win.connect('notify::wm-class', () => {
                    if (data.restored || !this._windowData.has(win)) return;
                    const id = win.get_wm_class();
                    if (id && this._geometryCache[id])
                        this._beginRestore(win, data, id);
                });
                data.signals.push(data.wmClassSignalId);
            } catch (e) {}
        }

        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            attempt === 0 ? 0 : WM_CLASS_POLL_MS, () => {
                data.timerId = 0;
                if (!this._windowData.has(win) || data.restored) return GLib.SOURCE_REMOVE;

                let appId = null;
                try { appId = win.get_wm_class(); } catch (e) {}

                const geo = appId ? this._geometryCache[appId] : null;

                if (geo) {
                    this._beginRestore(win, data, appId);
                } else if (attempt < WM_CLASS_MAX_TRIES) {
                    // Either no identity yet, or an identity with no saved
                    // entry — which may still be the EARLY identity of an
                    // app whose final one we know. Keep waiting.
                    this._scheduleRestore(win, data, attempt + 1);
                } else {
                    log(`[Geometry] No saved entry for '${appId ?? 'unknown'}' — tracking only`);
                    this._settleLater(win, data);
                }
                return GLib.SOURCE_REMOVE;
            });
    }

    _beginRestore(win, data, appId) {
        if (data.restored) return;

        // Re-validate: window type and transient parent are often set AFTER
        // 'window-created' (exactly like the late wm_class). A paste-conflict
        // dialog that slipped in as a "normal window" at creation is
        // untracked here instead of being flown to the app's saved position.
        if (!this._shouldManage(win)) {
            log(`[Geometry] '${appId}' turned out to be a dialog/transient — untracking`);
            this._untrackWindow(win);
            return;
        }

        data.restored = true;
        if (data.timerId) {
            GLib.source_remove(data.timerId);
            data.timerId = 0;
        }
        const geo = this._lookupGeometry(win, appId);
        this._applyGeometry(win, appId, geo, data);
        this._verifyRestore(win, data, appId, 0);
    }

    _verifyRestore(win, data, appId, tries) {
        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, VERIFY_DELAY_MS, () => {
            data.timerId = 0;
            if (!this._windowData.has(win)) return GLib.SOURCE_REMOVE;

            const geo = this._lookupGeometry(win, appId);
            if (geo && tries < VERIFY_MAX_TRIES && !this._matchesGeometry(win, geo)) {
                log(`[Geometry] ${appId} moved itself after restore; reapplying (${tries + 1}/${VERIFY_MAX_TRIES})`);
                this._applyGeometry(win, appId, geo, data);
                this._verifyRestore(win, data, appId, tries + 1);
            } else {
                // Last resort: some apps insist on their own SIZE, but on
                // Wayland no app can position itself — a final move_frame
                // always sticks, so at least the position is honored.
                if (geo && !geo.max && !this._matchesGeometry(win, geo) &&
                    !isMaximized(win) && !win.is_fullscreen()) {
                    try {
                        const t = this._clampToWorkArea(win, geo);
                        const before = win.get_frame_rect();
                        log(`[Geometry] ${appId} kept its own size; enforcing position only`);
                        const doMove = () => win.move_frame(true, t.x, t.y);
                        if (this._shouldAnimate(data))
                            this._fadeMove(win, before, { x: t.x, y: t.y, w: before.width, h: before.height }, doMove);
                        else
                            doMove();
                    } catch (e) {}
                }
                this._settleLater(win, data);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _settleLater(win, data) {
        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_GRACE_MS, () => {
            data.timerId = 0;
            data.settled = true;
            return GLib.SOURCE_REMOVE;
        });
    }

    _matchesGeometry(win, geo) {
        try {
            if (geo.max) return isMaximized(win);
            if (isMaximized(win)) return false;
            const r = win.get_frame_rect();
            const target = this._clampToWorkArea(win, geo);
            const near = (a, b) => Math.abs(a - b) <= 2;
            return near(r.x, target.x) && near(r.y, target.y) &&
                   near(r.width, target.w) && near(r.height, target.h);
        } catch (e) {
            return true; // Don't fight windows we can't measure
        }
    }

    _clampToWorkArea(win, geo) {
        let { x, y, w, h } = geo;
        try {
            const wa = win.get_work_area_current_monitor();
            if (wa && wa.width > 0 && wa.height > 0) {
                w = Math.min(w, wa.width);
                h = Math.min(h, wa.height);
                x = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
                y = Math.max(wa.y, Math.min(y, wa.y + wa.height - h));
            }
        } catch (e) {}
        return { x, y, w, h };
    }

    /**
     * Per-title lookup with app-level fallback.
     *
     * Multiple windows of one app share a wm_class, so a single slot per
     * app meant the slot held whatever window was touched LAST — a Files
     * window would inherit the Trash window's geometry. Distinctly titled
     * windows (Nautilus folders, Trash, mounted drives) now get their own
     * sub-slot. Apps with volatile titles (browsers: title = page) simply
     * fall back to the app-level slot.
     */
    _lookupGeometry(win, appId) {
        const entry = this._geometryCache[appId];
        if (!entry) return null;
        try {
            const title = win.get_title();
            if (title && entry.titles) {
                const t = entry.titles[title.substring(0, 80)];
                if (t) return t;
            }
        } catch (e) {}
        return entry;
    }

    _writeTitleGeo(entry, win, geo) {
        let title = null;
        try { title = win.get_title(); } catch (e) {}
        if (!title) return;
        title = title.substring(0, 80);

        entry.titles = entry.titles || {};
        const t = entry.titles[title] || {};
        Object.assign(t, geo, { last_seen: Date.now() });
        entry.titles[title] = t;

        // Cap sub-slots per app (browsers would otherwise store one per page)
        const keys = Object.keys(entry.titles);
        if (keys.length > MAX_TITLES_PER_APP) {
            keys.sort((a, b) => (entry.titles[a].last_seen || 0) - (entry.titles[b].last_seen || 0));
            while (keys.length > MAX_TITLES_PER_APP)
                delete entry.titles[keys.shift()];
        }
    }

    /**
     * Moves an already-visible window without visible travel: fade the
     * actor out, apply the move while invisible, fade back in at the
     * destination. The previous slide animation visibly departed from the
     * arbitrary spawn position, which read as buggy rather than deliberate.
     */
    _fadeMove(win, before, target, applyFn) {
        const dx = Math.abs(before.x - target.x);
        const dy = Math.abs(before.y - target.y);
        const dw = Math.abs((before.width ?? before.w ?? 0) - (target.w ?? 0));
        const dh = Math.abs((before.height ?? before.h ?? 0) - (target.h ?? 0));
        if (dx < MOVE_MIN_DELTA && dy < MOVE_MIN_DELTA &&
            dw < MOVE_MIN_DELTA && dh < MOVE_MIN_DELTA) {
            applyFn();
            return;
        }

        let actor = null;
        try { actor = win.get_compositor_private(); } catch (e) {}
        if (!actor) {
            applyFn();
            return;
        }

        try {
            actor.remove_transition('opacity');
            const prev = actor.opacity;
            actor.ease({
                opacity: 0,
                duration: FADE_OUT_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => {
                    try { applyFn(); } catch (e) {}
                    actor.ease({
                        opacity: prev,
                        duration: FADE_IN_MS,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    });
                },
            });
        } catch (e) {
            applyFn();
        }
    }

    /** Animate only when the window has been visible long enough to notice */
    _shouldAnimate(data) {
        return data && (GLib.get_monotonic_time() - data.createdAt) > ANIMATE_AFTER_MS * 1000;
    }

    _applyGeometry(win, appId, geo, data = null) {
        if (win.is_fullscreen()) return;

        try {
            // Apply the floating rect first (when we have one) so a later
            // unmaximize returns to the remembered size, then apply the
            // maximized state on top if that's how the app was closed.
            if (geo.w > 50 && geo.h > 50) {
                if (isMaximized(win) && !geo.max) unmaximize(win);
                if (!isMaximized(win)) {
                    const t = this._clampToWorkArea(win, geo);
                    const before = win.get_frame_rect();
                    log(`[Geometry] Restoring ${appId} to ${t.x},${t.y} [${t.w}x${t.h}]`);
                    const doMove = () => win.move_resize_frame(true, t.x, t.y, t.w, t.h);
                    if (!geo.max && this._shouldAnimate(data))
                        this._fadeMove(win, before, t, doMove);
                    else
                        doMove();
                }
            }
            if (geo.max && !isMaximized(win)) {
                log(`[Geometry] Restoring ${appId} maximized`);
                maximize(win);
            }
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

        if (win.is_fullscreen()) return;

        const appId = win.get_wm_class();
        if (!appId) return;

        // Dialogs/transients must never write into the app slot, even if
        // they were mis-typed as NORMAL at creation time.
        if (!this._shouldManage(win)) {
            this._untrackWindow(win);
            return;
        }

        // Maximized: remember the STATE, keep the last floating rect so
        // unmaximizing after restore returns to the remembered size.
        // (Previously maximized windows were skipped entirely, so an app
        // closed maximized reopened as a floating window.)
        if (isMaximized(win)) {
            const entry = this._geometryCache[appId] || {};
            entry.max = true;
            entry.last_seen = Date.now();
            this._writeTitleGeo(entry, win, { max: true });
            this._geometryCache[appId] = entry;
            this._queueSave();
            return;
        }

        const rect = win.get_frame_rect();
        if (rect.width < 50 || rect.height < 50) return;

        const entry = this._geometryCache[appId] || {};
        Object.assign(entry, {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            max: false,
            last_seen: Date.now()
        });
        this._writeTitleGeo(entry, win, {
            x: rect.x, y: rect.y, w: rect.width, h: rect.height, max: false
        });
        this._geometryCache[appId] = entry;

        log(`[Geometry] Saved ${appId} ('${win.get_title?.() ?? ''}'): ${rect.x},${rect.y} [${rect.width}x${rect.height}]`);
        this._queueSave();
    }

    _queueSave() {
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
