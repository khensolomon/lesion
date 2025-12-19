import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import { AppConfig } from "../config.js";

export function createClockUI() {
  const page = new Adw.PreferencesPage();
  const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

  // --- GROUP 1: POSITIONING ---
  const posGroup = new Adw.PreferencesGroup({
    title: "Positioning",
    description: "Change location",
  });
  page.add(posGroup);

  const enableRow = new Adw.SwitchRow({ title: "Move Clock" });
  settings.bind(
    "clock-move-enabled",
    enableRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  posGroup.add(enableRow);

  const targetRow = new Adw.ComboRow({
    title: "Target Side",
    model: new Gtk.StringList({ strings: ["Left Panel", "Right Panel"] }),
  });
  settings.bind(
    "clock-move-enabled",
    targetRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT
  );
  targetRow.set_selected(settings.get_enum("clock-target"));
  targetRow.connect("notify::selected", () =>
    settings.set_enum("clock-target", targetRow.selected)
  );
  posGroup.add(targetRow);

  const placeRow = new Adw.ComboRow({
    title: "Placement",
    model: new Gtk.StringList({ strings: ["Before Anchor", "After Anchor"] }),
  });
  settings.bind(
    "clock-move-enabled",
    placeRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT
  );
  placeRow.set_selected(settings.get_enum("clock-position"));
  placeRow.connect("notify::selected", () =>
    settings.set_enum("clock-position", placeRow.selected)
  );
  posGroup.add(placeRow);

  // --- GROUP 2: FORMATTING ---
  const formatGroup = new Adw.PreferencesGroup({
    title: "Appearance",
    description: "Customize layout and text",
  });
  page.add(formatGroup);

  const multiRow = new Adw.SwitchRow({
    title: "Two-Line Clock",
    subtitle: "Time top, Date bottom",
  });
  settings.bind(
    "clock-multiline",
    multiRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  formatGroup.add(multiRow);

  const dimRow = new Adw.SwitchRow({ title: "Dim Separators" });
  settings.bind(
    "clock-dim-separator",
    dimRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  formatGroup.add(dimRow);

  const modeRow = new Adw.ComboRow({
    title: "Format Mode",
    model: new Gtk.StringList({ strings: ["System Default", "Custom Format"] }),
  });
  modeRow.set_selected(settings.get_enum("clock-format-mode"));
  modeRow.connect("notify::selected", () =>
    settings.set_enum("clock-format-mode", modeRow.selected)
  );
  formatGroup.add(modeRow);

  // Custom Entry
  const formatEntryRow = new Adw.EntryRow({
    title: "Format String",
    show_apply_button: true,
  });
  settings.bind(
    "clock-custom-format",
    formatEntryRow,
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );
  formatGroup.add(formatEntryRow);

  // Presets (flat, same level as Format String)
  const presets = [
    // Originals
    { name: "Single: Standard", value: "%H:%M %a %d %b" },
    { name: "Single: Full", value: "%H:%M %A, %B %d" },
    { name: "Double: Standard", value: "%H:%M%n%A, %B %d" },
    { name: "Double: Compact", value: "%H:%M%n%a %d %b" },
    { name: "Double: Big Day", value: "%A%n%H:%M" },
    { name: "Double: EU Compact", value: "%H:%M %d.%m.%y" },
    { name: "Double: EU Full", value: "%H:%M:%S %a %d.%m.%Y" },

    // New single-line presets
    { name: "Single: Compact", value: "%H:%M %a %d" },
    { name: "Single: With Seconds", value: "%H:%M:%S %a %d %b" },
    { name: "Single: With Year", value: "%H:%M %a %d %b %Y" },
    { name: "Single: 12-Hour", value: "%I:%M %p %a %d %b" },
    { name: "Single: 12-Hour Full", value: "%I:%M %p %A, %B %d" },
    { name: "Single: Date First", value: "%a %d %b %H:%M" },

    // New double-line presets
    { name: "Double: With Seconds", value: "%H:%M:%S%n%A, %B %d" },
    { name: "Double: With Year", value: "%H:%M%n%A, %B %d, %Y" },
    { name: "Double: Big Month", value: "%B %d%n%H:%M" },
    { name: "Double: 12-Hour", value: "%I:%M %p%n%A, %B %d" },
    { name: "Double: 12-Hour Compact", value: "%I:%M %p%n%a %d %b" },
    { name: "Double: Time Top Big", value: "%H:%M%n%a %d %b %Y" },

    // Triple-line presets (for more vertical layouts)
    { name: "Triple: Time + Day + Date", value: "%H:%M%n%A%n%B %d, %Y" },
    { name: "Triple: With Seconds", value: "%H:%M:%S%n%A%n%B %d" },
    { name: "Triple: 12-Hour Full", value: "%I:%M %p%n%A%n%B %d, %Y" },

    // Extra creative ones
    { name: "Single: Minimal", value: "%H:%M" },
    { name: "Double: Day Focus", value: "%A %d%n%H:%M" },
    { name: "Single: ISO-ish", value: "%Y-%m-%d %H:%M" },
  ];
  const presetRow = new Adw.ComboRow({
    title: "Select a Preset",
    model: new Gtk.StringList({ strings: presets.map((p) => p.name) }),
  });
  formatGroup.add(presetRow);

  // 1. Get the current value from settings
  const currentFormat = settings.get_string("clock-custom-format");

  // 2. Find the index of this format in your presets array
  const initialIndex = presets.findIndex((p) => p.value === currentFormat);

  // 3. If a match is found, update the UI selection
  if (initialIndex !== -1) {
    presetRow.selected = initialIndex;
  } else {
    // OPTIONAL: If the current format is NOT in your list (it's custom),
    // AdwComboRow will default to index 0.
    // If you want to indicate it is custom, you would need to add
    // a "Custom" entry to your presets array dynamically here.
    // For now, it will just show the first item if no match is found.
  }

  presetRow.connect("notify::selected", () => {
    const val = presets[presetRow.selected].value;
    formatEntryRow.set_text(val);
    settings.set_string("clock-custom-format", val);
  });

  // Visibility Logic
  const updateVis = () => {
    const isCustom = settings.get_enum("clock-format-mode") === 1;
    formatEntryRow.visible = isCustom;
    presetRow.visible = isCustom;
  };
  settings.connect("changed::clock-format-mode", updateVis);
  updateVis();

  // return page;
  // --- GROUP 3: GUIDE (Collapsible) ---
  const guideGroup = new Adw.PreferencesGroup({ title: "", description: "" });
  page.add(guideGroup);

  const guideExpander = new Adw.ExpanderRow({
    title: "Formatting Guide",
    subtitle: "How custom date &amp; time formatting works",
  });

  guideGroup.add(guideExpander);

  // Content box
  const guideBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
  });

  const guideLabel = new Gtk.Label({
    label: `You can customize the clock using standard strftime format codes.

Examples:
• %H:%M — 24-hour time → 14:30
• %I:%M %p — 12-hour time with AM/PM → 02:30 PM
• %A — Full weekday name → Saturday
• %a — Short weekday name → Sat
• %B — Full month name → December
• %b — Short month name → Dec
• %d — Day of month (01-31) → 13
• %n — New line (useful for multi-line clocks)

Additional useful codes:
• %H:%M:%S — 24-hour time with seconds → 14:30:45 (example with :45 seconds)
• %I:%M:%S %p — 12-hour time with seconds → 02:30:45 PM
• %Y — Full year → 2025
• %y — Two-digit year → 25
• %m — Month as number (01-12) → 12
• %% — Literal percent sign → %
• %p — AM/PM indicator (uppercase) → PM

Common combinations:
• %A, %B %d, %Y — Full date → Saturday, December 13, 2025
• %a %b %d — Compact date → Sat Dec 13
• %Y-%m-%d — ISO date → 2025-12-13
• %H:%M   %a %d %b — Your standard single-line example → 14:30   Sat 13 Dec`,

    wrap: true,
  });

  guideBox.append(guideLabel);

  // Add content without extra row padding
  const contentRow = new Adw.ActionRow({ title: "", activatable: false });
  contentRow.add_suffix(guideBox);
  guideExpander.add_row(contentRow);

  // .................

  const group = new Adw.PreferencesGroup({ title: "a", description: "b" });

  const clamp = new Adw.Clamp({
    // maximum_size: 1600,
    tightening_threshold: 600,
    // orientation: Gtk.Orientation.HORIZONTAL,
    // unit: Adw.LengthUnit.PX,
    // vexpand: true,
    // hexpand: true
  });

  const list = new Gtk.ListBox({
    selection_mode: Gtk.SelectionMode.SINGLE,
    activate_on_single_click: true,
    css_classes: ["boxed-list"],
  });

  clamp.set_child(list);
  group.add(clamp);

  list.append(
    makeExpander("Advanced", [
      makeSwitch("Enable IPv6"),
      makeSwitch("Debug logging"),
    ])
  );

  list.append(
    makeExpander("Testing", [
      makeSwitch("Enable IPv6"),
      makeSwitch("Debug logging"),
    ])
  );

  list.connect("row-activated", (_list, row) => {
    if (row._toggle) row._toggle();
  });
  page.add(group);
  // .................

  return page;
}

// function makeExpander(title, children) {
//   const row = new Gtk.ListBoxRow();
//   const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
//   row.set_child(box);

//   const header = new Gtk.Button({
//     label: title,
//     css_classes: ['flat'],
//     halign: Gtk.Align.START,
//   });

//   const revealer = new Gtk.Revealer({
//     transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
//   });

//   const content = new Gtk.Box({
//     orientation: Gtk.Orientation.VERTICAL,
//     spacing: 4,
//     margin_start: 12,
//   });

//   children.forEach(w => content.append(w));
//   revealer.set_child(content);

//   header.connect('clicked', () => {
//     revealer.reveal_child = !revealer.reveal_child;
//   });

//   box.append(header);
//   box.append(revealer);

//   return row;
// }

// function makeExpander(title, children) {
//   const row = new Gtk.ListBoxRow();
//   const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });
//   row.set_child(box);

//   const header = new Gtk.Button({
//     css_classes: ['flat'],
//   });

//   const headerBox = new Gtk.Box({ spacing: 6 });

//   const arrow = new Gtk.Image({
//     icon_name: 'pan-end-symbolic',
//   });

//   const label = new Gtk.Label({
//     label: title,
//     xalign: 0,
//     hexpand: true,
//     css_classes: ['title-4'],
//   });

//   headerBox.append(arrow);
//   headerBox.append(label);
//   header.set_child(headerBox);

//   const revealer = new Gtk.Revealer({
//     transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
//   });

//   const content = new Gtk.Box({
//     orientation: Gtk.Orientation.VERTICAL,
//     spacing: 4,
//     margin_start: 18,
//   });

//   children.forEach(w => content.append(w));
//   revealer.set_child(content);

//   header.connect('clicked', () => {
//     const expanded = !revealer.reveal_child;
//     revealer.reveal_child = expanded;
//     arrow.icon_name = expanded
//       ? 'pan-down-symbolic'
//       : 'pan-end-symbolic';
//   });

//   box.append(header);
//   box.append(revealer);

//   return row;
// }

function makeExpander(title, children) {
  const row = new Gtk.ListBoxRow();

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    // spacing: 10,
    margin_top: 12,
    margin_bottom: 12,
    margin_start: 25,
    margin_end: 25,
  });

  row.set_child(box);

  const header = new Gtk.Box({ spacing: 6, hexpand: true });

  const label = new Gtk.Label({
    label: title,
    xalign: 0,
    hexpand: true,
    css_classes: ["title-4"],
  });

  const arrow = new Gtk.Image({
    icon_name: "pan-down-symbolic",
  });

  header.append(label);
  header.append(arrow);

  const revealer = new Gtk.Revealer({
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
  });

  const content = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    margin_top: 6,
    margin_start: 16,
  });

  children.forEach((w) => content.append(w));
  revealer.set_child(content);

  // expose a toggle method on the row
  row._toggle = () => {
    const expanded = !revealer.reveal_child;
    revealer.reveal_child = expanded;
    arrow.icon_name = expanded ? "pan-up-symbolic" : "pan-down-symbolic";
  };

  box.append(header);
  box.append(revealer);

  return row;
}

function makeSwitch(label) {
  const box = new Gtk.Box({ spacing: 12 });

  box.append(
    new Gtk.Label({
      label,
      xalign: 0,
      hexpand: true,
    })
  );

  box.append(new Gtk.Switch());

  return box;
}
