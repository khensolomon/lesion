import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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
const CLOAK_OFFSET = -100000;     // Off-screen translation while placing
const CLOAK_MAX_MS = 350;         // Reveal deadline if identity never resolves
const REVEAL_FADE_MS = 120;       // Soften late reveals (after map anim ended)

export class GeometryManager extends ExtensionComponent {

    onEnable() {
        this._saveTimeoutId = null;
        this._geometryCache = {};
        // win -> { signals: [], settled: bool, timerId: 0 }
        this._windowData = new Map();

        log("[Geometry] enabling manager");

        this._lastWrittenJson = null;
        this._loadCache();
        this._pruneCache();

        // CRITICAL: the preferences window edits 'geometry-data' directly
        // (Forget This Window / Clear All). Without reloading here, the
        // stale in-memory cache kept restoring forgotten entries AND wrote
        // them all back to disk on the next window move — resurrecting the
        // list the user had just cleared. Own writes are recognized via
        // _lastWrittenJson and ignored.
        this.observe('changed::geometry-data', () => {
            let json = null;
            try { json = this.getSettings().get_string('geometry-data'); } catch (e) {}
            if (json === null || json === this._lastWrittenJson) return;
            log('[Geometry] Store edited externally — reloading');
            this._loadCache();
        });

        const display = global.display;
        const id = display.connect('window-created', (d, win) => {
            // New window: track AND restore
            this._trackWindow(win, true);
        });
        this._signals.push({ obj: display, id });

        // USER INTENT IS AUTHORITATIVE: finishing a drag/resize settles the
        // window immediately. Previously a new window stayed "unsettled"
        // for up to ~3s (identity polling + grace), silently discarding the
        // user's first moves; and a fast drag could close before the save
        // debounce captured the final rect.
        const grabId = display.connect('grab-op-end', (d, win) => {
            const data = win ? this._windowData.get(win) : null;
            if (!data) return;
            if (data.timerId) {
                GLib.source_remove(data.timerId);
                data.timerId = 0;
            }
            data.settled = true;
            this._reveal(win, data); // safety: a grabbed window must be visible
            this._onWindowChanged(win);
        });
        this._signals.push({ obj: display, id: grabId });

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
            firstId: null,
            cloaked: false,
            cloakTimerId: 0,
            shownSeen: false,
            createdAt: GLib.get_monotonic_time(),
        };
        this._windowData.set(win, data);

        data.signals.push(win.connect('unmanaged', () => this._untrackWindow(win)));
        data.signals.push(win.connect('size-changed', () => this._onWindowChanged(win)));
        data.signals.push(win.connect('position-changed', () => this._onWindowChanged(win)));

        if (isNew) {
            // Second early trigger: the actor's first painted frame — some
            // identities land between window-created and first paint.
            try {
                const actor = win.get_compositor_private();
                if (actor) {
                    const ffId = actor.connect('first-frame', () => {
                        try { actor.disconnect(ffId); } catch (e) {}
                        this._tryResolveRestore(win, data);
                    });
                }
            } catch (e) {}

            // THE PLACEMENT OVERRIDE (found via journal analysis: every
            // restore was followed by "moved itself; reapplying" — a 100%
            // rate): Mutter runs its own placement when the window is first
            // SHOWN, discarding any geometry applied before that. Early
            // application is therefore kept only as a hint; the
            // authoritative apply happens in the one-shot 'shown' handler
            // below, after placement has run, while the cloak keeps the
            // whole sequence invisible.
            try {
                const shownId = win.connect('shown', () => {
                    try { win.disconnect(shownId); } catch (e) {}
                    data.shownSeen = true;
                    if (!this._windowData.has(win)) return;
                    if (data.restored) {
                        // Re-lookup: the title may have arrived by now,
                        // selecting a better per-title slot.
                        let appId = null;
                        try { appId = win.get_wm_class(); } catch (e) {}
                        const effective = (appId && this._geometryCache[appId])
                            ? appId : data.restoredAs;
                        const geo = this._lookupGeometry(win, effective);
                        if (geo) this._applyGeometry(win, effective, geo, data);
                    }
                    this._reveal(win, data);
                });
            } catch (e) {}

            const resolved = this._tryResolveRestore(win, data);
            let idNow = null;
            try { idNow = win.get_wm_class(); } catch (e) {}

            // Cloak when something will happen off-view: either a restore
            // already resolved (it must be re-applied post-placement) or the
            // identity is still unknown (a restore may yet resolve). Known
            // identity with nothing saved maps naturally, uncloaked.
            if (resolved || !idNow)
                this._cloak(win, data);

            if (!resolved)
                this._scheduleRestore(win, data, 0);
        }
    }

    _untrackWindow(win) {
        const data = this._windowData.get(win);
        if (!data) return;

        if (data.cloakTimerId) {
            GLib.source_remove(data.cloakTimerId);
            data.cloakTimerId = 0;
        }

        try {
            const actor = win.get_compositor_private();
            if (actor) {
                // A disable mid-fade/mid-cloak must not leave the window
                // translucent or off-screen
                actor.remove_transition('opacity');
                if (actor.opacity < 255) actor.opacity = 255;
                if (actor.translation_x !== 0) actor.translation_x = 0;
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
     * Identity resolution with ALIAS LEARNING.
     *
     * Several apps establish their final identity late (Firefox maps as
     * 'firefox' then becomes 'firefox_firefox'; Chrome and GTK4
     * single-instance apps behave similarly), which used to force waiting —
     * the window was already visible before restore could run, producing
     * the appear-then-move animation. The latency is learnable: whenever an
     * identity CHANGE is observed, the early->final mapping is persisted in
     * the cache under '__aliases__'. From the next launch on, the early
     * identity resolves through the alias IMMEDIATELY at window creation,
     * so the window is placed and sized before its first frame paints — no
     * animation at all.
     */
    _tryResolveRestore(win, data) {
        if (data.restored || !this._windowData.has(win)) return false;

        let appId = null;
        try { appId = win.get_wm_class(); } catch (e) {}
        if (!appId) return false;

        if (!data.firstId) {
            data.firstId = appId;
        } else if (appId !== data.firstId) {
            this._learnAlias(data.firstId, appId);
        }

        let effective = appId;
        if (!this._geometryCache[effective]) {
            const aliases = this._geometryCache['__aliases__'];
            const target = aliases?.[appId];
            if (target && this._geometryCache[target]) {
                log(`[Geometry] Alias hit: '${appId}' -> '${target}'`);
                effective = target;
            }
        }

        if (this._geometryCache[effective]) {
            this._beginRestore(win, data, effective);
            return true;
        }
        return false;
    }

    _learnAlias(earlyId, finalId) {
        if (!earlyId || !finalId || earlyId.startsWith('__')) return;
        const aliases = this._geometryCache['__aliases__'] ??
            (this._geometryCache['__aliases__'] = {});
        if (aliases[earlyId] !== finalId) {
            aliases[earlyId] = finalId;
            log(`[Geometry] Learned identity alias '${earlyId}' -> '${finalId}'`);
            this._queueSave();
        }
    }

    _scheduleRestore(win, data, attempt) {
        // React immediately if the identity changes mid-wait
        if (attempt === 0 && !data.wmClassSignalId) {
            try {
                data.wmClassSignalId = win.connect('notify::wm-class', () => {
                    this._tryResolveRestore(win, data);
                });
                data.signals.push(data.wmClassSignalId);
            } catch (e) {}
        }

        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            attempt === 0 ? 0 : WM_CLASS_POLL_MS, () => {
                data.timerId = 0;
                if (!this._windowData.has(win) || data.restored) return GLib.SOURCE_REMOVE;

                if (this._tryResolveRestore(win, data)) return GLib.SOURCE_REMOVE;

                // Identity known but nothing saved (and no alias): no
                // restore is coming — stop hiding the window.
                if (data.cloaked) {
                    let idNow = null;
                    try { idNow = win.get_wm_class(); } catch (e) {}
                    if (idNow && !this._geometryCache['__aliases__']?.[idNow])
                        this._reveal(win, data);
                }

                if (attempt < WM_CLASS_MAX_TRIES) {
                    this._scheduleRestore(win, data, attempt + 1);
                } else {
                    let appId = null;
                    try { appId = win.get_wm_class(); } catch (e) {}
                    log(`[Geometry] No saved entry for '${appId ?? 'unknown'}' — tracking only`);
                    this._reveal(win, data);
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
        data.restoredAs = appId;
        const geo = this._lookupGeometry(win, appId);
        this._applyGeometry(win, appId, geo, data);
        if (data.shownSeen) {
            // Placement already ran — this apply is authoritative
            this._reveal(win, data);
        }
        // else: the 'shown' handler reapplies post-placement and reveals
        this._verifyRestore(win, data, appId, 0);
    }

    _verifyRestore(win, data, appId, tries) {
        data.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, VERIFY_DELAY_MS, () => {
            data.timerId = 0;
            if (!this._windowData.has(win)) return GLib.SOURCE_REMOVE;

            const geo = this._lookupGeometry(win, appId);
            if (geo && tries < VERIFY_MAX_TRIES && !this._matchesGeometry(win, geo)) {
                log(`[Geometry] ${appId} moved itself after restore; reapplying (${tries + 1}/${VERIFY_MAX_TRIES})`);
                // data omitted deliberately: verify corrections are INSTANT.
                // Fading each retry made apps that re-assert their own size
                // (Chrome) flash 2-4 times in place at launch.
                this._applyGeometry(win, appId, geo, null);
                this._verifyRestore(win, data, appId, tries + 1);
            } else {
                // Last resort: some apps insist on their own SIZE, but on
                // Wayland no app can position itself — a final move_frame
                // always sticks, so at least the position is honored.
                if (geo && !geo.max && !this._matchesGeometry(win, geo) &&
                    !isMaximized(win) && !win.is_fullscreen()) {
                    try {
                        const t = this._clampToWorkArea(win, geo);
                        log(`[Geometry] ${appId} kept its own size; enforcing position only`);
                        // Instant for the same reason as verify retries
                        win.move_frame(true, t.x, t.y);
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
            if (this.getSettings().get_boolean('geometry-restore-workspace') &&
                Number.isInteger(geo.ws) && !win.is_on_all_workspaces() &&
                win.get_workspace()?.index() !== Math.min(geo.ws, 35))
                return false;
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

    /**
     * MONITOR IDENTITY. Coordinates are stored monitor-relative together
     * with the monitor's index and geometry fingerprint. On restore, the
     * fingerprint is matched first (survives index shuffles after
     * docking/undocking), then the index, then the current monitor. A
     * missing monitor falls back gracefully to absolute coordinates
     * clamped to the current work area.
     */
    _monitorInfoFor(win, frame) {
        try {
            const idx = win.get_monitor();
            const m = Main.layoutManager.monitors[idx];
            if (!m) return {};
            return {
                mi: idx,
                mr: [m.x, m.y, m.width, m.height],
                rx: frame.x - m.x,
                ry: frame.y - m.y,
            };
        } catch (e) {
            return {};
        }
    }

    _resolveMonitor(geo) {
        try {
            const monitors = Main.layoutManager.monitors;
            if (geo.mr) {
                const m = monitors.find(mm =>
                    mm.x === geo.mr[0] && mm.y === geo.mr[1] &&
                    mm.width === geo.mr[2] && mm.height === geo.mr[3]);
                if (m) return m;
            }
            if (Number.isInteger(geo.mi) && monitors[geo.mi])
                return monitors[geo.mi];
        } catch (e) {}
        return null;
    }

    _clampToWorkArea(win, geo) {
        let { x, y, w, h } = geo;
        try {
            const mon = this._resolveMonitor(geo);
            let wa = null;
            if (mon && Number.isFinite(geo.rx)) {
                // Remembered monitor is present: place relative to it
                x = mon.x + geo.rx;
                y = mon.y + geo.ry;
                wa = win.get_work_area_for_monitor(mon.index);
            } else {
                wa = win.get_work_area_current_monitor();
            }
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
     * CLOAK: the reason restores used to be visible as a "fly" is that
     * GNOME's map animation shows the window from its very first frame,
     * while app identities often resolve 50-250ms later — so the
     * relocation happened in plain sight. macOS/Windows never show this
     * because the window isn't displayed until it's placed. Same here:
     * windows whose identity is unknown at creation are slid off-screen
     * via actor translation (a property the map animation never touches,
     * unlike opacity/scale), placed while off-view, and revealed AT the
     * restored geometry. The corners shadow is translation-bound to its
     * window, so it cloaks and reveals in sync automatically.
     */
    _cloak(win, data) {
        try {
            const actor = win.get_compositor_private();
            if (!actor) return;
            actor.translation_x = CLOAK_OFFSET;
            data.cloaked = true;

            data.cloakTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLOAK_MAX_MS, () => {
                data.cloakTimerId = 0;
                // Identity never resolved in time — show the window where
                // it spawned; if a restore lands later it uses the fade.
                this._reveal(win, data);
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {}
    }

    _reveal(win, data) {
        if (!data.cloaked) return;
        data.cloaked = false;

        if (data.cloakTimerId) {
            GLib.source_remove(data.cloakTimerId);
            data.cloakTimerId = 0;
        }

        try {
            const actor = win.get_compositor_private();
            if (!actor) return;
            actor.translation_x = 0;

            // If the shell's map animation is already over, an abrupt pop
            // is jarring — soften with a short fade (opacity is
            // uncontested once the map effect has finished).
            const elapsed = (GLib.get_monotonic_time() - data.createdAt) / 1000;
            if (elapsed > 300 && !actor.get_transition('opacity')) {
                actor.opacity = 0;
                actor.ease({
                    opacity: 255,
                    duration: REVEAL_FADE_MS,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            }
        } catch (e) {}
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
            // FIX: if a fade is already in flight, its captured 'prev' is the
            // resting opacity — starting a second fade here would capture a
            // PARTIAL value (e.g. 200) and "restore" the window to permanent
            // semi-transparency. Apply follow-up corrections instantly instead.
            if (actor.get_transition('opacity')) {
                applyFn();
                return;
            }

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

    /**
     * WORKSPACE MEMORY. Windows return to the workspace they were closed
     * on. With dynamic workspaces the remembered index may no longer exist;
     * change_workspace_by_index with append=true recreates it. Gated by
     * 'geometry-restore-workspace' since some people prefer new windows on
     * the current workspace.
     */
    _applyWorkspace(win, geo) {
        try {
            if (!this.getSettings().get_boolean('geometry-restore-workspace')) return;
            if (!Number.isInteger(geo.ws)) return;
            if (win.is_on_all_workspaces()) return;
            const current = win.get_workspace()?.index();
            const target = Math.min(geo.ws, 35);
            if (current !== target) {
                log(`[Geometry] Moving window to workspace ${target}`);
                win.change_workspace_by_index(target, true);
            }
        } catch (e) {}
    }

    _applyGeometry(win, appId, geo, data = null) {
        if (win.is_fullscreen()) return;

        try {
            this._applyWorkspace(win, geo);
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
        if (!appId || appId.startsWith('__')) return;

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

        // Workspace + monitor identity captured alongside the rect
        let ws = null;
        try {
            if (!win.is_on_all_workspaces())
                ws = win.get_workspace()?.index() ?? null;
        } catch (e) {}
        const monInfo = this._monitorInfoFor(win, rect);

        const snapshot = {
            x: rect.x, y: rect.y, w: rect.width, h: rect.height,
            max: false, ws, ...monInfo,
        };

        const entry = this._geometryCache[appId] || {};
        Object.assign(entry, snapshot, { last_seen: Date.now() });
        this._writeTitleGeo(entry, win, snapshot);
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
            this._lastWrittenJson = json; // so the changed:: observer can
                                          // tell our writes from external ones
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
            const aliases = this._geometryCache['__aliases__'];
            let entries = Object.entries(this._geometryCache)
                .filter(([key]) => !key.startsWith('__'))
                .filter(([, geo]) => !geo.last_seen || (now - geo.last_seen) < maxAge);

            if (entries.length > PRUNE_MAX_ENTRIES) {
                entries.sort((a, b) => (b[1].last_seen || 0) - (a[1].last_seen || 0));
                entries = entries.slice(0, PRUNE_MAX_ENTRIES);
            }

            const pruned = Object.fromEntries(entries);
            if (aliases) pruned['__aliases__'] = aliases;
            const removed = Object.keys(this._geometryCache).length -
                Object.keys(pruned).length;
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
