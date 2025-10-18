'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Lists all .css files in the style/ subdirectory of the extension.
 * This is a utility function safe to be called from both extension.js and prefs.js.
 *
 * @param {string} extensionPath - The path to the extension's root directory.
 * @returns {string[]} An array of CSS filenames.
 */
export function listStyleFiles(extensionPath) {
    const cssDir = GLib.build_filenamev([extensionPath, 'style']);
    const dir = Gio.File.new_for_path(cssDir);

    // Gracefully handle the case where the style directory might not exist.
    if (!dir.query_exists(null)) {
        log(`[Lesion] Style directory not found at: ${cssDir}`);
        return [];
    }

    const files = [];
    try {
        const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            if (name.endsWith('.css')) {
                files.push(name);
            }
        }
        enumerator.close(null);
    } catch (e) {
        logError(e, '[Lesion] Could not list style files');
    }

    return files;
}

