'use strict';

import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LesionPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('dev.lethil.lesion');
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'Custom CSS Styles' });
        page.add(group);
        window.add(page);

        const cssDir = `${this.path}/style`;
        const cssFiles = this._listStyleFiles(cssDir);
        const enabled = settings.get_strv('enabled-styles');

        for (const cssFile of cssFiles) {
            const row = new Adw.ActionRow({ title: cssFile });
            const check = new Gtk.Switch({ active: enabled.includes(cssFile), valign: Gtk.Align.CENTER });
            row.add_suffix(check);
            group.add(row);

            check.connect('state-set', (sw, state) => {
                const list = settings.get_strv('enabled-styles');
                const i = list.indexOf(cssFile);
                if (state && i === -1)
                    list.push(cssFile);
                else if (!state && i > -1)
                    list.splice(i, 1);
                settings.set_strv('enabled-styles', list);
                return false;
            });
        }
    }

    _listStyleFiles(cssDir) {
        const dir = Gio.File.new_for_path(cssDir);
        const files = [];
        try {
            const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();
                if (name.endsWith('.css'))
                    files.push(name);
            }
        } catch (e) {
            logError(e);
        }
        return files;
    }
}
