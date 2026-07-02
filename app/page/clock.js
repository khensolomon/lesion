import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Pango from "gi://Pango";
import { AppConfig } from "../config.js";

/**
 * Creates the Clock Settings UI page.
 * @returns {Adw.PreferencesPage} The constructed preferences page.
 */
export function createClockUI() {
  /**
   * Creates an expandable list row for the formatting guide.
   * @param {string} title - The title of the row.
   * @param {Gtk.Widget[]} children - Array of widgets to display in the expanded content.
   * @returns {Gtk.ListBoxRow} The constructed list box row.
   */
  const createExpandableSection = (title, children) => {
    const row = new Gtk.ListBoxRow();
    // Disable selection so the background doesn't stay highlighted
    row.set_selectable(false);

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 15,
      margin_end: 15,
    });
    row.set_child(box);

    const header = new Gtk.Box({ spacing: 6, hexpand: true });
    
    // Title label with wrapping enabled for small screens
    const label = new Gtk.Label({
      label: title,
      xalign: 0,
      hexpand: true,
      css_classes: ["title-5"],
      wrap: true,
      wrap_mode: Pango.WrapMode.WORD,
    });
    
    const arrow = new Gtk.Image({ icon_name: "pan-down-symbolic" });

    header.append(label);
    header.append(arrow);

    const revealer = new Gtk.Revealer({
      transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    });

    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
      margin_top: 12,
      margin_start: 12,
    });
    children.forEach((w) => content.append(w));
    revealer.set_child(content);

    // Expose a toggle method on the row for the click handler
    row._toggle = () => {
      const expanded = !revealer.reveal_child;
      revealer.reveal_child = expanded;
      arrow.icon_name = expanded ? "pan-up-symbolic" : "pan-down-symbolic";
    };

    box.append(header);
    box.append(revealer);

    return row;
  };

  /**
   * Creates a simple label row for the formatting examples.
   * @param {string} text - The example text to display.
   * @returns {Gtk.Box} A box containing the label.
   */
  const createGuideEntry = (text) => {
    const box = new Gtk.Box({ spacing: 12 });
    box.append(
      new Gtk.Label({
        label: text,
        xalign: 0,
        hexpand: true,
        wrap: true, // Essential for resizing
        wrap_mode: Pango.WrapMode.WORD_CHAR, // Allows breaking long format strings if needed
        natural_wrap_mode: Gtk.NaturalWrapMode.NONE, // Ensures it shrinks to fit the container
      })
    );
    return box;
  };

  const page = new Adw.PreferencesPage();
  const settings = AppConfig.getSettings();

  // --- GROUP 1: POSITIONING ---
  const posGroup = new Adw.PreferencesGroup({
    title: "Positioning",
    description: "Control where the clock appears on the panel and its position relative to other elements.",
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
    description: "Adjust the visual style, format the date and time strings, or choose a preset layout.",
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

  // Presets
  const presets = [
    // Originals
    { name: "Single: Standard", value: "%H:%M %a %d %b" },
    { name: "Single: Full", value: "%H:%M %A, %B %d" },
    { name: "Double: Standard", value: "%H:%M%n%A, %B %d" },
    { name: "Double: Compact", value: "%H:%M%n%a %d %b" },
    { name: "Double: Big Day", value: "%A%n%H:%M" },
    { name: "Double: EU Compact", value: "%H:%M %d.%m.%y" },
    { name: "Double: EU Full", value: "%H:%M:%S %a %d.%m.%Y" },

    // Single-line
    { name: "Single: Compact", value: "%H:%M %a %d" },
    { name: "Single: With Seconds", value: "%H:%M:%S %a %d %b" },
    { name: "Single: With Year", value: "%H:%M %a %d %b %Y" },
    { name: "Single: 12-Hour", value: "%I:%M %p %a %d %b" },
    { name: "Single: 12-Hour Full", value: "%I:%M %p %A, %B %d" },
    { name: "Single: Date First", value: "%a %d %b %H:%M" },

    // Double-line
    { name: "Double: With Seconds", value: "%H:%M:%S%n%A, %B %d" },
    { name: "Double: With Year", value: "%H:%M%n%A, %B %d, %Y" },
    { name: "Double: Big Month", value: "%B %d%n%H:%M" },
    { name: "Double: 12-Hour", value: "%I:%M %p%n%A, %B %d" },
    { name: "Double: 12-Hour Compact", value: "%I:%M %p%n%a %d %b" },
    { name: "Double: Time Top Big", value: "%H:%M%n%a %d %b %Y" },

    // Triple-line
    { name: "Triple: Time + Day + Date", value: "%H:%M%n%A%n%B %d, %Y" },
    { name: "Triple: With Seconds", value: "%H:%M:%S%n%A%n%B %d" },
    { name: "Triple: 12-Hour Full", value: "%I:%M %p%n%A%n%B %d, %Y" },

    // Creative
    { name: "Single: Minimal", value: "%H:%M" },
    { name: "Double: Day Focus", value: "%A %d%n%H:%M" },
    { name: "Single: ISO-ish", value: "%Y-%m-%d %H:%M" },
  ];

  const presetRow = new Adw.ComboRow({
    title: "Select a Preset",
    model: new Gtk.StringList({ strings: presets.map((p) => p.name) }),
  });
  formatGroup.add(presetRow);

  // Sync preset selection with current format settings
  const currentFormat = settings.get_string("clock-custom-format");
  const initialIndex = presets.findIndex((p) => p.value === currentFormat);

  if (initialIndex !== -1) {
    presetRow.selected = initialIndex;
  }

  presetRow.connect("notify::selected", () => {
    const val = presets[presetRow.selected].value;
    formatEntryRow.set_text(val);
    settings.set_string("clock-custom-format", val);
  });

  // Visibility Logic for Custom Format controls
  const updateVis = () => {
    const isCustom = settings.get_enum("clock-format-mode") === 1;
    formatEntryRow.visible = isCustom;
    presetRow.visible = isCustom;
  };
  settings.connect("changed::clock-format-mode", updateVis);
  updateVis();

  // --- GROUP 3: FORMATTING GUIDE ---
  const formattingGuideGroup = new Adw.PreferencesGroup({
    title: "Formatting Guide",
    description: "Reference for standard 'strftime' codes used to build custom date and time formats.",
  });

  const formattingGuideClamp = new Adw.Clamp({
    tightening_threshold: 600,
  });

  const formattingGuideList = new Gtk.ListBox({
    selection_mode: Gtk.SelectionMode.SINGLE,
    activate_on_single_click: true,
    css_classes: ["boxed-list"],
  });

  formattingGuideClamp.set_child(formattingGuideList);
  formattingGuideGroup.add(formattingGuideClamp);

  // Guide: Examples Section
  formattingGuideList.append(
    createExpandableSection("Examples", [
      createGuideEntry("%H:%M — 24-hour time → 14:30"),
      createGuideEntry("%I:%M %p — 12-hour time with AM/PM → 02:30 PM"),
      createGuideEntry("%A — Full weekday name → Saturday"),
      createGuideEntry("%a — Short weekday name → Sat"),
      createGuideEntry("%B — Full month name → December"),
      createGuideEntry("%b — Short month name → Dec"),
      createGuideEntry("%d — Day of month (01-31) → 13"),
      createGuideEntry("%n — New line (useful for multi-line clocks)"),
    ])
  );

  // Guide: Additional Codes Section
  formattingGuideList.append(
    createExpandableSection("Additional useful codes", [
      createGuideEntry("%H:%M:%S — 24-hour time with seconds → 14:30:45"),
      createGuideEntry("%I:%M:%S %p — 12-hour time with seconds → 02:30:45 PM"),
      createGuideEntry("%Y — Full year → 2025"),
      createGuideEntry("%y — Two-digit year → 25"),
      createGuideEntry("%m — Month as number (01-12) → 12"),
      createGuideEntry("%% — Literal percent sign → %"),
      createGuideEntry("%p — AM/PM indicator (uppercase) → PM"),
    ])
  );

  // Guide: Common Combinations Section
  formattingGuideList.append(
    createExpandableSection("Common combinations", [
      createGuideEntry("%A, %B %d, %Y — Full date → Saturday, December 13, 2025"),
      createGuideEntry("%a %b %d — Compact date → Sat Dec 13"),
      createGuideEntry("%Y-%m-%d — ISO date → 2025-12-13"),
      createGuideEntry("%H:%M   %a %d %b — Standard single-line example → 14:30   Sat 13 Dec"),
    ])
  );

  formattingGuideList.connect("row-activated", (_list, row) => {
    if (row._toggle) row._toggle();
  });
  page.add(formattingGuideGroup);

  return page;
}