# Changelog

Notable changes to the Lesion extension. Version names follow `yy.mm.dd`
(EGO `version-name` allows letters, numbers, spaces, and periods only).

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
