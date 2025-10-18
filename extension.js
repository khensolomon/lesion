'use strict';

const { Gio, GLib, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

class LesionExtension {
    constructor() {
        this._settings = Settings.getSettings();
        this._styleDir = GLib.build_filenamev([Me.path, 'style']);
        this._cssFiles = [];
        this._monitor = null;
    }

    enable() {
        this._loadAllCss();
        this._monitorDirectory();
        log('[Lesion] Enabled');
    }

    disable() {
        this._removeAllCss();
        if (this._monitor) {
            this._monitor.cancel();
            this._monitor = null;
        }
        log('[Lesion] Disabled');
    }

    _loadAllCss() {
        this._removeAllCss();
        const dir = Gio.File.new_for_path(this._styleDir);
        if (!dir.query_exists(null))
            return;

        const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.endsWith('.css')) {
                const path = GLib.build_filenamev([this._styleDir, name]);
                const file = Gio.File.new_for_path(path);
                if (file.query_exists(null)) {
                    const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
                    theme.load_stylesheet(file);
                    this._cssFiles.push(file);
                    log(`[Lesion] Loaded ${name}`);
                }
            }
        }
    }

    _removeAllCss() {
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        for (const file of this._cssFiles) {
            try {
                theme.unload_stylesheet(file);
            } catch (e) {
                logError(e);
            }
        }
        this._cssFiles = [];
    }

    _monitorDirectory() {
        const dir = Gio.File.new_for_path(this._styleDir);
        this._monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', () => {
            log('[Lesion] Detected style change — reloading');
            this._loadAllCss();
        });
    }
}

function init() {
    return new LesionExtension();
}
