// prefs.js

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib'; // Import GLib for getting home directory

import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ExtensionManager } from 'resource:///org/gnome/shell/misc/extensionManager.js';

const extensionManager = new ExtensionManager();

export default class MyThemeManagerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // --- NEW: Create a clamp for constraining the width ---
        const clamp = new Adw.Clamp({
            // Set your desired maximum width in pixels
            maximum_size: 500, 
        });
        // Add the clamp to the main window instead of the page
        window.add(clamp);

        // Create a new preferences page (as before)
        const page = new Adw.PreferencesPage();
        
        // --- NEW: Add the page as a child of the clamp ---
        clamp.set_child(page);

        // --- Section for Managing Extensions (Code is unchanged) ---
        const extGroup = new Adw.PreferencesGroup({
            title: 'Manage Extensions',
            description: 'Enable or disable other installed extensions.',
        });
        page.add(extGroup);

        const extensions = extensionManager.getExtensions();
        const userExtensions = Object.values(extensions)
            .filter(ext => !ext.isSystemExtension)
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const ext of userExtensions) {
            if (ext.uuid === this.uuid) continue;

            const row = new Adw.ActionRow({ title: ext.name, subtitle: ext.description });
            extGroup.add(row);

            const toggle = new Gtk.Switch({
                active: ext.state === extensionManager.extensionStates.ENABLED,
                valign: Gtk.Align.CENTER,
            });
            row.add_suffix(toggle);
            row.activatable_widget = toggle;

            toggle.connect('notify::active', (widget) => {
                if (widget.get_active()) {
                    extensionManager.enableExtension(ext.uuid);
                } else {
                    extensionManager.disableExtension(ext.uuid);
                }
            });
        }
        
        // --- Section for Managing GTK Themes (Code is unchanged) ---
        const themeGroup = new Adw.PreferencesGroup({
            title: 'Manage GTK Theme',
            description: 'Change the appearance of application windows.',
        });
        page.add(themeGroup);
        
        const themeRow = new Adw.ActionRow({ title: 'Application Theme' });
        themeGroup.add(themeRow);

        const settings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        const currentTheme = settings.get_string('gtk-theme');

        const themeDropdown = new Gtk.ComboBoxText();
        themeRow.add_suffix(themeDropdown);
        themeRow.activatable_widget = themeDropdown;

        const themeDirs = [
            Gio.File.new_for_path('/usr/share/themes'),
            Gio.File.new_for_path(`${GLib.get_home_dir()}/.themes`)
        ];
        
        let activeThemeIndex = 0;
        let index = 0;
        for (const dir of themeDirs) {
            if (!dir.query_exists(null)) continue;
            
            const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
            let fileInfo;
            while ((fileInfo = enumerator.next_file(null))) {
                const themeName = fileInfo.get_name();
                if (dir.get_child(themeName).get_child('gtk-3.0').query_exists(null)) {
                    themeDropdown.append_text(themeName);
                    if (themeName === currentTheme) {
                        activeThemeIndex = index;
                    }
                    index++;
                }
            }
        }
        
        themeDropdown.set_active(activeThemeIndex);

        themeDropdown.connect('changed', (widget) => {
            const selectedTheme = widget.get_active_text();
            if (selectedTheme) {
                settings.set_string('gtk-theme', selectedTheme);
            }
        });
    }
}