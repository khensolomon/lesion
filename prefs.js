import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Import the shared function to find bundled CSS files
import { listStyleFiles } from './settings.js';

export default class LesionPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings('dev.lethil.lesion');
        window.set_size_request(600, 700);

        const page = new Adw.PreferencesPage();
        window.add(page);

        this._addBundledStylesGroup(page);
        this._addCustomStylesGroup(page, window);
    }

    _addBundledStylesGroup(page) {
        const group = new Adw.PreferencesGroup({ title: 'Bundled CSS Style' });
        page.add(group);

        const cssFiles = listStyleFiles(this.path);
        const enabled = this._settings.get_strv('enabled-styles');

        if (cssFiles.length === 0) {
            const row = new Adw.ActionRow({
                title: 'No Styles Found',
                subtitle: `No .css files were found in ${this.path}/style`,
            });
            group.add(row);
            return;
        }

        for (const cssFile of cssFiles) {
            const row = new Adw.ActionRow({ title: cssFile });
            const toggle = new Gtk.Switch({ active: enabled.includes(cssFile), valign: Gtk.Align.CENTER });
            row.add_suffix(toggle);
            group.add(row);

            toggle.connect('state-set', (sw, state) => {
                const list = this._settings.get_strv('enabled-styles');
                const i = list.indexOf(cssFile);
                if (state && i === -1) {
                    list.push(cssFile);
                } else if (!state && i > -1) {
                    list.splice(i, 1);
                }
                this._settings.set_strv('enabled-styles', list);
                return false;
            });
        }
    }

    _addCustomStylesGroup(page, window) {
        const group = new Adw.PreferencesGroup({
            title: 'Custom CSS Style',
            description: 'Add your own CSS files from anywhere on your computer.'
        });
        page.add(group);

        const listbox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        group.add(listbox); // Add listbox to group first

        // ✅ FIX: Use a standard Gtk.Button aligned to the start (left)
        const addButton = new Gtk.Button({
            label: 'Add CSS Style',
            halign: Gtk.Align.START,
        });
        addButton.set_margin_top(12);
        group.add(addButton); // Add button to group last

        addButton.connect('clicked', () => this._onAddClicked(window));
        this._settings.connect('changed::custom-styles', () => this._populateCustomStyles(listbox));
        this._populateCustomStyles(listbox);
    }

    _populateCustomStyles(listbox) {
        listbox.remove_all();
        const customStyles = this._settings.get_value('custom-styles').deep_unpack();
        if (customStyles.length === 0) {
            listbox.hide(); // Hide the listbox if it's empty
        } else {
            listbox.show(); // Show it if it has items
            for (const [uri, enabled] of customStyles) {
                listbox.append(this._createCustomStyleRow(uri, enabled));
            }
        }
    }

    _createCustomStyleRow(uri, enabled) {
        const file = Gio.File.new_for_uri(uri);
        const basename = file.get_basename();

        const row = new Adw.ActionRow({
            title: basename || 'Invalid File',
            subtitle: file.get_path() || uri,
        });

        const toggle = new Gtk.Switch({ active: enabled, valign: Gtk.Align.CENTER });
        row.add_suffix(toggle);

        const buttonBox = new Gtk.Box({ spacing: 6, valign: Gtk.Align.CENTER });
        row.add_suffix(buttonBox);

        const openButton = new Gtk.Button({
            icon_name: 'document-open-symbolic',
            tooltip_text: 'Open File',
        });
        buttonBox.append(openButton);

        const removeButton = new Gtk.Button({
            icon_name: 'edit-delete-symbolic',
            tooltip_text: 'Remove From List',
            css_classes: ['destructive-action'],
        });
        buttonBox.append(removeButton);

        toggle.connect('state-set', (_, state) => {
            const allStyles = this._settings.get_value('custom-styles').deep_unpack();
            const newStyles = allStyles.map(([u, e]) => (u === uri) ? [u, state] : [u, e]);
            this._settings.set_value('custom-styles', new GLib.Variant('a(sb)', newStyles));
            return false;
        });

        openButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri_async(uri, null, null, null);
        });

        removeButton.connect('clicked', () => {
            const allStyles = this._settings.get_value('custom-styles').deep_unpack();
            const newStyles = allStyles.filter(([u]) => u !== uri);
            this._settings.set_value('custom-styles', new GLib.Variant('a(sb)', newStyles));
        });

        return row;
    }

    _onAddClicked(parentWindow) {
        const dialog = new Gtk.FileChooserDialog({
            title: 'Select Custom CSS Files',
            action: Gtk.FileChooserAction.OPEN,
            transient_for: parentWindow,
            modal: true,
        });
        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button('Add', Gtk.ResponseType.ACCEPT);
        dialog.set_select_multiple(true);

        const filter = new Gtk.FileFilter();
        filter.set_name('CSS Files');
        filter.add_pattern('*.css');
        dialog.add_filter(filter);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const files = dlg.get_files();
                const newEntries = [];
                for (let i = 0; i < files.get_n_items(); i++) {
                    const file = files.get_item(i);
                    newEntries.push([file.get_uri(), true]);
                }

                if (newEntries.length > 0) {
                    const currentStyles = this._settings.get_value('custom-styles').deep_unpack();
                    const uniqueNew = newEntries.filter(([uri1]) => !currentStyles.some(([uri2]) => uri1 === uri2));
                    if (uniqueNew.length > 0) {
                        this._settings.set_value('custom-styles', new GLib.Variant('a(sb)', currentStyles.concat(uniqueNew)));
                    }
                }
            }
            dlg.destroy();
        });
        dialog.show();
    }
}


