# Changelog

Notable changes to the Lesion extension. Version names follow `yy.mm.dd`
(EGO `version-name` allows letters, numbers, spaces, and periods only).

## 26.07.18.2 (version 32)

### Window geometry: smart data recycling
- Entries now track a usage count, incremented on RESTORE (the event that
  proves an entry's value; saves fire constantly and measure nothing).
  No settings-schema change: the data lives inside the geometry-data JSON
  and entries self-upgrade.
- Pruning is now frequency-aware with a recency floor: entries used within
  the last 14 days are never evicted (a brand-new app must not lose to an
  old high-count one); beyond the floor, cap eviction removes the
  least-used first with recency as tiebreak. Entries unseen for 180 days
  drop regardless of count, and title sub-slots keep their LRU eviction.
- Pruning also runs opportunistically whenever the store meaningfully
  exceeds the cap between shell restarts, not only at enable.

## 26.07.18 (version 31)

### Window Effects (renamed from Corners)
- The page and component now match their scope: rounding, shadows, smart
  edges, and transparency. Renamed `app/components/corners.js` ->
  `effects.js` (CornersManager -> EffectsManager), `app/page/corners.js`
  -> `effects.js`, page id `window-corners` -> `window-effects`, menu
  title "Corners" -> "Window Effects", and the Dashboard nav row.
  Settings keys are unchanged (corners-*, transparency-*), so no dconf
  migration is needed.

### Geometry page
- "Reset Storage" retitled "Clear Saved Geometry" with an honest subtitle
  (entries rebuild through normal use), and the clear button dropped its
  destructive red styling — the wording and alarm level now match what
  the action actually does.
- Restore logging now records the frame-buffer delta, to diagnose the
  reported shadow strip on edge-snapped Firefox/Chrome restores (a
  nonzero delta at restore time would confirm the app's CSD shadow
  extents were still in floating mode when measured).

## 26.07.16.4 (version 30)

### Bundled icons (end of the icon-theme roulette)
- The extension now ships its own symbolic icons (icon/lesion-*.svg) and
  registers the directory as a GTK icon search path in preferences.
  Recent adwaita-icon-theme trims kept removing symbolics the UI relied
  on (edit-undo, view-refresh, link showed as the generic fallback).
  Distinct visuals per action: Reset All Settings = circular reset arrow
  (destructive red), Geometry Clear All = trash, Reset Style = eraser,
  About documentation links = external-link arrow.

### Window geometry
- Fixed windows flashing 2-4 times in place at launch (most visible with
  Chrome, also when opening links from About): each verify retry against
  an app re-asserting its own size ran the fade animation — fade-out/in
  at the same position is a flash. Verify corrections and the
  position-only fallback are now instant; the fade remains only for a
  first-time late restore.

## 26.07.16.3 (version 29)

### Window geometry: workspace memory and monitor identity
- Windows now reopen on the workspace they were closed on
  (`geometry-restore-workspace`, default on, toggleable on the Geometry
  page). With dynamic workspaces, a trimmed workspace is recreated. A
  wrong workspace counts as a verify mismatch, so it self-corrects.
- Coordinates are now stored monitor-relative alongside the monitor's
  index and geometry fingerprint. On restore, the fingerprint is matched
  first (survives index shuffles after docking/undocking), then the
  index; a missing monitor falls back to absolute coordinates clamped to
  the current work area. Existing entries without monitor data keep
  working via the fallback and upgrade themselves on the next save.

### Dashboard
- Reset All Settings is now a labeled destructive "Reset..." button per
  the HIG — and immune to the icon-theme availability issues that ate two
  icon attempts.

## 26.07.16.2 (version 28)

### Dashboard
- Reset All Settings icon fixed (edit-undo-symbolic did not render on the
  system theme; replaced with view-refresh-symbolic, verified in use
  elsewhere in the UI).
- Window Geometry added to the Features quick-access list, using the same
  icon and target as its menu registration.

## 26.07.16 (version 27)

### Window geometry: restore AFTER Mutter placement (journal-diagnosed)
- Journal analysis showed every restore followed by "moved itself after
  restore; reapplying" — a 100% rate, meaning systematic: Mutter runs its
  own placement when a window is first SHOWN, discarding geometry applied
  earlier. Being early was why restores lost. The authoritative apply now
  happens in a one-shot 'shown' handler (post-placement), re-looking up the
  per-title slot (titles often arrive by then), while the cloak keeps the
  entire sequence off-view; the early apply remains as a hint only.
  Windows are now cloaked whenever a restore resolved pre-shown OR the
  identity is still pending; known apps with nothing saved map naturally.
- User interaction is authoritative: 'grab-op-end' immediately settles a
  window and saves its rect. Previously a new window stayed unsettled for
  up to ~3 seconds (identity polling + grace), silently discarding the
  user's first drags — and a fast drag could be lost to the save debounce.

## 26.07.15.2 (version 26)

### Window geometry: cloak-until-placed (the fly is dead)
- Root cause finally identified: GNOME's map animation shows a window from
  its very first frame, while app identities resolve 50-250ms later — so
  every restore in that gap relocated a window that was already visible
  and mid-zoom. The 250ms "too early to animate" threshold was built on a
  false assumption; nothing after the first frame is invisible.
- Windows whose identity is unknown at creation are now CLOAKED: the actor
  is slid off-screen via translation (a property the map animation never
  contests, unlike opacity/scale), placed while off-view, and revealed at
  the restored geometry — the window's first visible moment IS its saved
  position and size, exactly like the built-in behavior on other systems.
  The corners shadow is translation-bound and cloaks in sync automatically.
- Reveal triggers: restore applied; identity resolved with nothing saved
  (no restore coming); 350ms deadline (identity never resolved — show at
  spawn, any later restore uses the fade); and untrack/disable, which also
  resets translation so no window can be left off-screen.
- Reveals landing after the map animation has ended get a 120ms fade so
  the appearance is soft rather than a pop.

## 26.07.15 (version 25)

### Window geometry: store desync fixed (the root of "still flying")
- The shell-side manager read `geometry-data` once at enable and never
  again, while the preferences window edits it directly. Consequences:
  "Forget This Window" / "Clear All" only appeared to work (the stale
  in-memory cache kept restoring forgotten entries), and any window move
  wrote the whole stale cache back to disk, resurrecting the cleared list.
  The manager now reloads whenever the store changes externally,
  recognizing its own writes to avoid loops. This desync also poisoned the
  identity-alias learning that makes restores instant, which is why
  launches kept animating.
- The first restore attempt now runs synchronously inside window-created
  (instead of one main-loop iteration later), placing known apps before
  the compositor paints their first frame.

## 26.07.14.9 (version 24)

### Window geometry: instant restores via identity aliases
- The appear-then-move launch experience is eliminated for late-identity
  apps from their second launch onward. Observed identity changes (e.g.
  'firefox' -> 'firefox_firefox') are persisted as aliases in the geometry
  store ('__aliases__'), so the early identity resolves the saved entry
  IMMEDIATELY at window creation — the window is sized and positioned
  before its first frame paints, with no animation at all. A one-shot
  first-frame trigger catches identities landing between creation and
  first paint. Pruning preserves the alias table; the save path refuses
  reserved keys.

### Preferences UI
- About shows `version-name` (with the integer release in parentheses)
  instead of the bare integer.
- `page/panels.js` renamed to `page/style.js`; its reset is retitled
  "Reset Style" with scope-clarifying wording (it only ever covered
  styling keys). A confirmed "Reset All Settings" — every schema key —
  now lives in Dashboard -> Data Management.
- Icon audit against the current Adwaita symbolic set: replaced four icons
  absent from GNOME 48+ themes (external-link -> link, desktop-theme ->
  desktop-appearance, applications-development -> view-grid,
  text-x-script -> text-x-generic).

## 26.07.14.8 (version 23)

### Preferences UI
- `page/home.js` renamed to `page/dashboard.js` (page id `home` ->
  `dashboard`); the Dashboard is now a pure action hub: indicator settings,
  quick navigation, and data management.
- The hero row (name, version, session, UUID copy) moved off the Dashboard:
  identity content already lived on the About page, and the two useful
  diagnostics — session type and the UUID copy button — now join it there
  in a new System group.
- Window Corners added to the Dashboard's quick-access module list.

### Metadata
- Rewrote the metadata.json description from the placeholder ("Demo
  extension with personalized settings") to an informative summary of the
  panel styling and presets, clock, app buttons, window geometry, rounded
  corners, transparency, custom CSS, and wallpaper features.

## 26.07.14.7 (version 22)

### Window Corners / Transparency
- Fixed the "focused window looks transparent" bug: it was not opacity at
  all. Mutter restacks window actors on focus/raise, but the replacement
  shadow actors kept their old depth, so a stale shadow could sit ABOVE a
  newly raised window and paint a dark rim over its edges — reading as
  translucency. Shadows now re-sort directly below their windows on every
  `restacked` signal (same approach as Rounded Window Corners Reborn).
- New Focused Opacity setting (`transparency-focused-opacity`, default
  100): the focused window can now optionally be made translucent too,
  with its own percentage, while the default keeps it fully opaque.

## 26.07.14.6 (version 21)

### Window Corners: smart screen edges
- Corners flush against a screen (work area) edge now stay square while
  interior-facing corners remain rounded (`corners-smart-edges`, default
  on). Side-by-side windows at the screen edges read as tiles: square
  outer corners, rounded inner ones. Implemented as a per-corner mask
  uniform in the shader (TL/TR/BL/BR), an edge-flush test against the
  window's work area (within 2px, where GNOME snap places windows), and
  matching per-corner radii on the replacement shadow body so a squared
  window corner never sits on a rounded shadow.
- Windows now also refresh on position changes, since moving a window
  onto or off a screen edge changes its corner mask without any resize.

## 26.07.14.5 (version 20)

### Window Transparency
- Hardened the focused-window guarantee: if focus changed while a geometry
  fade animation was in flight on a window, the fade could restore a stale
  opacity and the correction was skipped. Transparency updates now retry
  once after an in-flight fade completes, and pending retries are cleaned
  up on detach.

## 26.07.14.4 (version 19)

### Build tooling
- `build.py --ego` builds an extensions.gnome.org submission package:
  excludes all development tooling (build/install/dev scripts, ui mockups,
  notes, the standalone app.js runner), strips nonstandard keys from
  metadata.json inside the zip (debug, links, license_type, prefs-page,
  developer-name \u2014 the runtime falls back safely, so debug is
  automatically off in EGO builds), and names the file
  `<uuid>.shell-extension.zip` per the `gnome-extensions pack` convention.

### Window Transparency (new, on the Corners page)
- Opt-in unfocused-window transparency (`transparency-enabled`, default
  off; `transparency-opacity`, default 92%). The focused window always
  stays fully opaque, so the window being actively worked in \u2014 a
  graphics editor during visual inspection \u2014 is never dimmed; only
  background windows are. Works independently of Uniform Rounded Corners
  (transparency alone attaches no GPU effect or shadow machinery), defers
  to in-flight geometry fade animations, and restores full opacity on
  detach/disable.

## 26.07.14.3 (version 18)

### Schema migration (BREAKING for existing settings)
- GSettings schema id renamed from `dev.lethil.lesion` to
  `org.gnome.shell.extensions.lethil` (EGO publication requirement; also
  the ecosystem convention). Updated everywhere: the schema XML filename,
  schema id, all enum ids, the dconf path (now
  `/org/gnome/shell/extensions/lethil/`), gettext-domain, metadata.json
  `settings-schema`, and the AppConfig fallbacks.
- Existing settings live under the old dconf path and are NOT migrated
  automatically. To carry them over once:
  `dconf dump /dev/lethil/lesion/ | dconf load /org/gnome/shell/extensions/lethil/`
  Afterwards the old tree can be removed with
  `dconf reset -f /dev/lethil/lesion/`, and any globally installed old
  schema in `~/.local/share/glib-2.0/schemas/` can be deleted and
  recompiled.

## 26.07.14.2 (version 17)

### Compatibility
- Added GNOME Shell 50 to supported versions. The GNOME 50 porting guide
  lists no relevant changes to metadata, extension.js, or prefs.js, and no
  changes to the APIs Lesion uses; all breaking changes from 46-49
  (get_maximized, MaximizeFlags, St.BoxLayout vertical, Clutter blur) are
  already isolated in app/util/compat.js. Note: GNOME 50 removed X11
  sessions; Xwayland clients remain and the X11 client handling in the
  corners component stays valid.

### Fixes
- Dashboard navigation: the "Window Styles" quick-access row targeted the
  page id 'styles' while the CSS page is registered as 'css'.
- Window Corners now skips Desktop Icons NG (ships with Ubuntu), which
  manages the desktop itself as a window; rounding it and replacing its
  shadow would deform the desktop.

## 26.07.14 (version 16)

### Window Corners
- Fixed windows rendering as half a window after Maximize -> Restore: the
  mask uniforms were baked while the actor still had its maximized
  allocation, so the outside-the-frame deletion erased everything past the
  midpoint. Uniforms now also refresh when the effect target's own size
  settles (notify::size).
- Shadow actor property bindings reduced to exact parity with Rounded
  Window Corners Reborn (dropped the extra 'opacity' binding).

### Window geometry
- Fixed windows left permanently semi-transparent ("a bit of transparent"):
  a second fade-move starting while one was mid-flight captured a partial
  opacity as the resting value and restored the window to it. Follow-up
  corrections during a fade now apply instantly instead of stacking fades,
  and untracking restores any partial opacity to full.

## 26.07.12.4 (version 15)

### Window Corners (shadow architecture, ported from RWC Reborn)
- The corner marks are the window's OWN drop shadow: apps draw their shadow
  shaped for the original corners, hugging them densely, and cutting a
  rounded corner exposes the shadow hiding underneath — visible over light
  backgrounds, invisible over dark ones (which is why the purple terminal
  looked correct). No mask tuning can fix this; the shadow itself must be
  replaced. Following Rounded Window Corners Reborn's architecture:
  - The mask shader now removes everything outside the frame bounds (the
    app's entire in-buffer shadow) in addition to rounding the corners.
  - Each rounded window gets a replacement shadow actor below it, shaped
    for the rounded window: a white rounded box casting a CSS box-shadow,
    with a second shader erasing the white body so only the shadow remains.
  - The shadow tracks the window through moves, resizes, animations,
    minimize, and focus changes (stronger shadow when focused), and hides
    for maximized/fullscreen windows.

## 26.07.12.3 (version 14)

### Window Corners (mask math ported from Rounded Window Corners Reborn)
- Fixed the corner marks becoming MORE visible in the last two builds: the
  inward-biased antialiasing band was sitting over the window's brighter
  interior pixels instead of its already-antialiased edge pixels, so each
  inward step made the arc brighter. The mask now uses the field-proven
  approach from Rounded Window Corners Reborn: an antialiasing band centered
  exactly on the curve (radius +/- 0.5px) with a linear falloff, plain
  multiply, and no fragment discard.
- Removed the opacity-254 "culling" clamps on window and surface actors:
  the misdiagnosed mechanism they addressed does not exist (RWC ships no
  such workaround), and they added signal churn for nothing.
- X11 clients (e.g. VSCode/Electron under Xwayland) now get the effect on
  the surface child actor rather than the window actor, matching RWC —
  the probable reason some applications appeared entirely unaffected.

## 26.07.12.2 (version 13)

### Window Corners
- Further reduced the faint light arc remaining at corners of bright
  windows over dark backgrounds: CSD windows draw a ~1px bright border
  along their perimeter, and cutting exactly at the frame corner left that
  border's arc at partial alpha. The cut is now biased half a pixel inward,
  strongly attenuating the border arc without creating a jog where the
  curve meets the straight edges.

## 26.07.12 (version 12)

### Window Corners
- Fixed light "marks" at window corners (visible over dark backgrounds,
  including on windows that were already rounded). Two causes addressed in
  the mask shader: the antialiasing band was centered ON the curve, leaving
  the boundary pixels of edges and corners at ~50% alpha (a light fringe
  for bright windows); and any premultiplied-alpha mismatch could leak the
  window color at partial weight in the cut region. The mask is now gated
  strictly to the four corner squares (straight edges are never touched),
  the antialiasing is biased fully inward so nothing survives at or outside
  the mathematical curve, and fully-cut fragments are discarded — a
  discarded fragment writes nothing, making the cut immune to blend-mode
  and premultiplication differences.

## 26.07.11.2 (version 11)

### Window Corners
- Fixed rounded corners still revealing an unpainted background: Mutter's
  opaque-region culling checks the SURFACE actor's opacity (the child
  holding the window texture), not the window actor that was previously
  clamped. Both actors are now clamped to 254 while the effect is active
  and restored on detach.

### Window geometry
- Fixed the repeated animation storm when pasting files over existing ones
  in Files: conflict dialogs report type NORMAL with no transient parent at
  window-created (both are set moments later), so each dialog was tracked
  as a new app window, animated to the app's saved position, and then saved
  its own dialog geometry into the app slot. The window's nature is now
  re-validated at restore time and on every save; late-identified dialogs
  are untracked instead.
- Restore animation is now a fade-through instead of a slide: the window
  fades out (~90ms), moves while invisible, and fades back in at its
  destination, eliminating the visible travel from the arbitrary spawn
  position. A disable mid-fade restores full opacity.

## 26.07.11 (version 10)

### Window Corners
- Fixed rounded corners revealing a white/unpainted region instead of the
  window behind when overlapping: Mutter's opaque-region culling skips
  painting whatever lies under a fully opaque window, so the transparent
  corners exposed an unrendered area. The window actor's opacity is now
  clamped to 254 while the effect is attached (visually indistinguishable,
  disables the culling); the clamp is re-applied on notify::opacity because
  the shell's map animation eases opacity back to 255, and 255 is restored
  on detach.
- Attach/skip decisions and frame/buffer rects are now logged in debug mode
  to diagnose windows the effect does not reach; if the actor is not ready
  at window-created, attachment retries on 'shown'.

## 26.07.03.2 (version 9)

### Window Corners (re-enabled, rewritten)
- Uniform rounded corners for application windows: all four corners get the
  same antialiased rounding (new keys `corners-enabled`, `corners-radius`,
  default 12), fixing the rounded-top/flat-bottom look of legacy apps.
  Maximized and fullscreen windows are automatically square.
- The mask is now computed against the frame rect INSIDE the actor buffer;
  the previous shader rounded the actor's corners, which for client-side
  decorated apps meant rounding the invisible drop-shadow margins instead
  of the window. Ported from the legacy Clutter.ShaderEffect path to a
  Shell.GLSLEffect fragment snippet with smoothstep antialiasing (the old
  'discard' produced jagged edges).
- Removed the "Flatten Windows" (square) mode: apps draw their own rounded
  top corners and the pixels outside that curve do not exist, so an effect
  can only remove pixels, never invent content. The preferences page states
  this limitation. Also removed the shell-CSS injection that fought
  PanelsManager with !important rules on the same selectors.

## 26.07.03 (version 8)

### Window geometry
- Per-title memory within each app: windows of one app sharing a wm_class
  (Nautilus Files vs Trash vs mounted drives) previously shared a single
  slot, so the last-touched window's geometry leaked onto its siblings.
  Distinctly titled windows now get their own sub-slot (up to 10 per app,
  oldest pruned); apps with volatile titles such as browsers fall back to
  the app-level slot.
- Restore no longer feels like remote control: the first attempt now runs
  immediately (fast apps get placed while the map animation still covers
  the window), and any correction applied to an already-visible window
  glides there over 220ms instead of teleporting. Sub-8px corrections are
  not animated; size changes remain instant to avoid distorting window
  contents. Glide state is reset if a window is untracked mid-animation.

## 26.07.02.6 (version 7)

### Window geometry
- Fixed restore never firing for apps that establish or change their
  identity after mapping (Firefox 'firefox' -> 'firefox_firefox', Chrome,
  and GTK4 single-instance apps such as Nautilus, Text Editor, Settings,
  and Boxes). Saves run under the final identity, but restore looked up the
  cache with the first non-null wm_class and silently missed. Restore now
  waits until the identity matches a saved entry (up to ~3s), reacts to
  wm-class change notifications, and only then applies.
- Verification extended to 4 passes; if an app insists on its own size, the
  final pass enforces at least the saved position (position-only moves
  always stick on Wayland since clients cannot position themselves).
- Saves are now logged (debug mode) with identity and geometry for easier
  diagnosis.

## 26.07.02.5 (version 6)

### Defaults
- Panel Buttons: Corner Radius now defaults to 6, Natural Padding to 4
  (Min Padding stays 4). The Default (GNOME) preset matches.

### Panel buttons
- Buttons now stay highlighted while their menu is open (active background),
  including the extension indicator, which swallows press events for its
  custom click handling and previously never highlighted. Menu-open ranks
  above hover, so moving the pointer into an open menu no longer clears the
  highlight.

### Clock
- Restored hover and active feedback on the clock: neutralizing the theme's
  inner pill had removed its only hover styling. The clock stylesheet now
  provides hover/active/checked backgrounds using the configured colors
  (or a shell-like overlay when the hover effect is disabled).

### Window geometry
- Maximized state is now saved and restored: an app closed maximized reopens
  maximized, and unmaximizing returns it to the last remembered floating
  size and position.
- Restore now verifies itself and reapplies up to two times, beating apps
  that asynchronously restore their own size after mapping (libadwaita
  apps, browsers, terminals) and previously overrode the extension's
  placement.

## 26.07.02.4 (version 5)

### Defaults
- Show Apps, Favorites, Running, Disks, and Trash buttons are now enabled by
  default on fresh installs.

### Style -> Presets (reworked)
- Removed Daylight and Neon Cyber. Presets are now: Default (GNOME),
  macOS Light, macOS Dark, Windows 11 Light, Windows 11 Dark, tuned to the
  real platform values (macOS: heavy-blur translucent bar, no border or
  shadow, 5px selection rounding, 10px menus with soft large shadows,
  status-items-only bar; Windows 11: bottom Mica bar with hairline edge
  divider, 6px hover rounding, 8px flyouts with tight shadows, Start +
  pinned + running on the bar).
- Every preset now sets all visual keys, so switching presets is
  deterministic and leaves no residue from the previous one.
- Fixed preset application crashes: `panel-bg-gradient-dir` (a plain int
  key) was written via set_enum, and app position enum keys were written
  via set_int; both threw mid-batch.

## 26.07.02.3 (version 4)

### App buttons
- New Apps -> Item Padding setting (`apps-btn-padding`, default 4px): custom
  app/disk/trash buttons keep their own inner spacing even when the global
  Style -> Panel Buttons padding is 0. Previously the global button styler
  overwrote the buttons' hardcoded padding, leaving icons with no space.

### Clock button styling
- Corner Radius and padding are now enforced on the clock via a loaded
  stylesheet covering all pseudo-states (:hover/:active/:checked), since the
  theme's pill rules could not be reliably overridden with inline actor
  styles across GNOME versions and themes. The stylesheet is unloaded when
  panel styling is disabled.

## 26.07.02.2 (version 3)

### Clock button styling
- The clock now follows Style -> Panel Buttons -> Corner Radius and the
  configured padding like every other button. The stock GNOME theme zeroes
  the clock button's own padding and draws a fixed-radius pill on the inner
  `.clock` label; the button styler now gives the clock button explicit
  symmetric padding and neutralizes the inner pill, restoring both when
  styling is disabled.

## 26.07.02 (version 2)

### Panel layout
- Default button order is now: Show Apps, Overview, Favorites, Running on
  the left; Disks, Trash, Indicator on the right (before native indicators,
  clock, and system menu).
- Multi-button groups (Disks, Favorites) no longer swallow the items placed
  after them: Trash offsets past the Disks group and Running past the
  Favorites group, so static index settings keep their logical meaning.
- The rebuild order now builds groups before the items positioned after them.

### Clock
- Fixed the double hover background on the custom clock. The inner clock box
  is now a passive container; the enclosing dateMenu button owns hover,
  active state, click handling, and the roundness/background styling applied
  to `.panel-button`, matching every other panel button.

### Window geometry (rewritten)
- No longer restores already-open windows on enable; GNOME re-enables
  extensions on every unlock and shell restart, which previously snapped all
  open windows back to their saved slots.
- Fixed the save/restore race: a new window's own initial self-placement can
  no longer overwrite the saved slot before restore reads it.
- Restore now waits briefly for `wm_class` (often set late on Wayland).
- Only normal, non-transient windows participate; dialogs sharing an app's
  `wm_class` no longer corrupt the app's saved geometry.
- Restored geometry is clamped to the current work area so disconnected or
  not-yet-configured monitors cannot push windows off-screen.
- The geometry store is pruned by age (180 days) and size (300 apps).
- Pending geometry saves are flushed on disable instead of dropped.

### Compatibility (GNOME 46-49)
- New `app/util/compat.js` isolates version-sensitive shell APIs.
- `Meta.Window.get_maximized()` (removed in GNOME 49) replaced via compat
  helper using `is_maximized()`.
- Deprecated `St.BoxLayout` `vertical` property replaced with `orientation`
  via compat helper (clock, apps identity dialog).
- Wallpaper blur switched from legacy `Clutter.BlurEffect` to
  `Shell.BlurEffect`.

### Settings and stability
- All settings objects are now resolved from the extension's own `schemas/`
  directory via `AppConfig.getSettings()`; the schema no longer needs to be
  installed globally, and backend/preferences can no longer read diverging
  schemas.
- Removed `run_dispose()` on shared `Gio.Settings`; signals are tracked and
  disconnected properly.
- Component signal cleanup is resilient to already-disposed objects.
- The apps update debounce timer is removed on disable so it cannot fire
  against destroyed buttons.

### Wallpaper
- Backup moved from the extension directory (read-only for system installs,
  wiped on updates) to the user state directory, with one-time migration.
- Blur/brightness effects are re-applied after monitor changes instead of
  silently disappearing.

### Behavior and review compliance
- "Disable Extension" now goes through the GNOME extension manager instead
  of calling `disable()` directly (which desynced shell state and destroyed
  the menu mid-signal).
- Opening preferences no longer force-closes other applications' windows or
  spawns `gnome-extensions prefs` as a subprocess.

## 1.34-beta (version 1)

- Initial development versions.
