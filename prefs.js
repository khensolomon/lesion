import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/extension.js';
// import { ExtensionManager } from 'resource:///org/gnome/shell/misc/extensionManager.js';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ExtensionManager } from 'resource:///org/gnome/Shell/Misc/extensionManager.js';

const extensionManager = new ExtensionManager();

// Helper function to create the page for managing extensions
function createExtensionsPage() {
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
        title: 'Manage Extensions',
        description: 'Enable or disable other installed extensions.',
    });
    page.add(group);

    const extensions = extensionManager.getExtensions();
    const userExtensions = Object.values(extensions)
        .filter(ext => !ext.isSystemExtension)
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const ext of userExtensions) {
        if (ext.uuid === 'theme-manager-extension@lethil"') continue;

        const row = new Adw.ActionRow({ title: ext.name, subtitle: ext.description });
        group.add(row);
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
    return page;
}

// Helper function to create the page for managing themes
function createThemesPage() {
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
        title: 'Manage GTK Theme',
        description: 'Change the appearance of application windows.',
    });
    page.add(group);
    
    const row = new Adw.ActionRow({ title: 'Application Theme' });
    group.add(row);

    const settings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
    const currentTheme = settings.get_string('gtk-theme');
    const dropdown = new Gtk.ComboBoxText();
    row.add_suffix(dropdown);
    row.activatable_widget = dropdown;

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
                dropdown.append_text(themeName);
                if (themeName === currentTheme) activeThemeIndex = index;
                index++;
            }
        }
    }
    dropdown.set_active(activeThemeIndex);
    dropdown.connect('changed', (widget) => {
        const selectedTheme = widget.get_active_text();
        if (selectedTheme) settings.set_string('gtk-theme', selectedTheme);
    });
    return page;
}


export default class MyThemeManagerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const splitView = new Adw.NavigationSplitView();
        splitView.set_collapsed(false);
        window.add(splitView);

        const sidebar = new Gtk.ListBox();
        sidebar.set_selection_mode(Gtk.SelectionMode.SINGLE);
        
        const extensionsRow = new Gtk.ListBoxRow();
        extensionsRow.set_child(new Gtk.Label({ label: 'Extensions', halign: Gtk.Align.START, margin_start: 12, margin_top: 6, margin_bottom: 6 }));
        extensionsRow.set_name('page_extensions');
        sidebar.append(extensionsRow);

        const themesRow = new Gtk.ListBoxRow();
        themesRow.set_child(new Gtk.Label({ label: 'Themes', halign: Gtk.Align.START, margin_start: 12, margin_top: 6, margin_bottom: 6 }));
        themesRow.set_name('page_themes');
        sidebar.append(themesRow);

        const sidebarPage = new Adw.NavigationPage({ title: 'Controls', child: sidebar });
        splitView.set_sidebar(sidebarPage);

        const contentStack = new Gtk.Stack();
        contentStack.add_named(createExtensionsPage(), 'page_extensions');
        contentStack.add_named(createThemesPage(), 'page_themes');
        
        const contentPage = new Adw.NavigationPage({ title: 'Settings', child: contentStack });
        splitView.set_content(contentPage);

        sidebar.connect('row-selected', (box, row) => {
            if (row) {
                contentStack.set_visible_child_name(row.get_name());
            }
        });
        sidebar.select_row(extensionsRow);
    }
}