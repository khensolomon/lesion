import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { log, logError } from '../util/logger.js';

export class WallpaperManager {
    /**
     * @param {Extension} ext - The main extension instance.
     */
    constructor(ext) {
        this._extension = ext;
        this.backupFile = 'wallpaper-backup.json';
    }

    /**
     * Backs up the current GNOME background settings if no backup exists.
     */
    enable() {
        try {
            const backupPath = GLib.build_filenamev([this._extension.path, this.backupFile]);
            
            if (!GLib.file_test(backupPath, GLib.FileTest.EXISTS)) {
                const bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
                
                const backupData = {
                    'picture-uri': bgSettings.get_string('picture-uri'),
                    'picture-uri-dark': bgSettings.get_string('picture-uri-dark'),
                    'primary-color': bgSettings.get_string('primary-color'),
                    'secondary-color': bgSettings.get_string('secondary-color'),
                    'picture-options': bgSettings.get_string('picture-options')
                };

                const jsonString = JSON.stringify(backupData, null, 2);
                const file = Gio.File.new_for_path(backupPath);
                file.replace_contents(jsonString, null, false, Gio.FileCreateFlags.NONE, null);
                
                log("Wallpaper config backed up.");
            }
        } catch (e) {
            logError("Failed to backup wallpaper settings", e);
        }
    }

    /**
     * Restores the background settings from the backup file.
     */
    disable() {
        try {
            const backupPath = GLib.build_filenamev([this._extension.path, this.backupFile]);
            const file = Gio.File.new_for_path(backupPath);

            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const backupData = JSON.parse(decoder.decode(contents));
                    const bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });

                    if (backupData['picture-uri']) bgSettings.set_string('picture-uri', backupData['picture-uri']);
                    if (backupData['picture-uri-dark']) bgSettings.set_string('picture-uri-dark', backupData['picture-uri-dark']);
                    if (backupData['primary-color']) bgSettings.set_string('primary-color', backupData['primary-color']);
                    if (backupData['secondary-color']) bgSettings.set_string('secondary-color', backupData['secondary-color']);
                    if (backupData['picture-options']) bgSettings.set_string('picture-options', backupData['picture-options']);

                    log("Wallpaper config restored.");
                    file.delete(null);
                }
            }
        } catch (e) {
            logError("Failed to restore wallpaper settings", e);
        }
    }
}