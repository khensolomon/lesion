import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

import { ExtensionPreferences } from "resource:///org/gnome/shell/extensions/extension.js";
import { ExtensionManager } from "resource:///org/gnome/shell/misc/extensionManager.js";

// We get a reference to the built-in ExtensionManager
const extensionManager = new ExtensionManager();

export default class MyThemeManagerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    // Create a new preferences page
    const page = new Adw.PreferencesPage();
    window.add(page);

    // --- Section for Managing Extensions ---
    const extGroup = new Adw.PreferencesGroup({
      title: "Manage Extensions",
      description: "Enable or disable other installed extensions.",
    });
    page.add(extGroup);

    // Get all extensions, filter out the system ones, and sort them
    const extensions = extensionManager.getExtensions();
    const userExtensions = Object.values(extensions)
      .filter((ext) => !ext.isSystemExtension)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Loop through each user extension and create a row for it
    for (const ext of userExtensions) {
      // We don't want to manage ourselves!
      if (ext.uuid === this.uuid) continue;

      const row = new Adw.ActionRow({
        title: ext.name,
        subtitle: ext.description,
      });
      extGroup.add(row);

      const toggle = new Gtk.Switch({
        active: ext.state === extensionManager.extensionStates.ENABLED,
        valign: Gtk.Align.CENTER,
      });
      row.add_suffix(toggle);
      row.activatable_widget = toggle;

      // Connect the switch's 'notify::active' signal to a function
      toggle.connect("notify::active", (widget) => {
        const isEnabled = widget.get_active();
        if (isEnabled) {
          extensionManager.enableExtension(ext.uuid);
        } else {
          extensionManager.disableExtension(ext.uuid);
        }
      });
    }

    // --- Section for Managing GTK (Application) Themes ---
    const themeGroup = new Adw.PreferencesGroup({
      title: "Manage GTK Theme",
      description: "Change the appearance of application windows.",
    });
    page.add(themeGroup);

    const themeRow = new Adw.ActionRow({ title: "Application Theme" });
    themeGroup.add(themeRow);

    // Use GSettings to interact with system settings directly
    const settings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });
    const currentTheme = settings.get_string("gtk-theme");

    const themeDropdown = new Gtk.ComboBoxText();
    themeRow.add_suffix(themeDropdown);
    themeRow.activatable_widget = themeDropdown;

    // Populate the dropdown with themes from standard directories
    const themeDirs = [
      Gio.File.new_for_path("/usr/share/themes"),
      Gio.File.new_for_path(`${GLib.get_home_dir()}/.themes`),
    ];

    let activeThemeIndex = 0;
    let index = 0;
    for (const dir of themeDirs) {
      if (!dir.query_exists(null)) continue;

      const enumerator = dir.enumerate_children(
        "standard::name,standard::type",
        Gio.FileQueryInfoFlags.NONE,
        null
      );
      let fileInfo;
      while ((fileInfo = enumerator.next_file(null))) {
        const themeName = fileInfo.get_name();
        // A simple check to see if it's a valid theme folder
        if (dir.get_child(themeName).get_child("gtk-3.0").query_exists(null)) {
          themeDropdown.append_text(themeName);
          if (themeName === currentTheme) {
            activeThemeIndex = index;
          }
          index++;
        }
      }
    }

    themeDropdown.set_active(activeThemeIndex);

    // When a new theme is selected, apply it using GSettings
    themeDropdown.connect("changed", (widget) => {
      const selectedTheme = widget.get_active_text();
      if (selectedTheme) {
        settings.set_string("gtk-theme", selectedTheme);
      }
    });
  }
}
