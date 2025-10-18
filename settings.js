'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export function getSettings() {
    const extension = Extension.lookupByURL(import.meta.url);
    return extension.getSettings('dev.lethil.lesion');
}

export function listStyleFiles(extensionPath) {
    const dir = Gio.File.new_for_path(GLib.build_filenamev([extensionPath, 'style']));
    const enumerator = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    const files = [];
    let info;

    while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name();
        if (name.endsWith('.css')) files.push(name);
    }

    enumerator.close(null);
    return files;
}
