import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { log, logError } from './app/util/logger.js';
import { AppConfig } from './app/config.js';
import { Indicator } from './app/panel/indicator.js';

export default class LesionExtension extends Extension {
    _indicators = [];
    _settings = null;
    _stylesheetFiles = [];
    _settingsSignalEnabled = null;
    _settingsSignalCustom = null;

    enable() {
        AppConfig.init(this.metadata, this.path, true);
        log("Enabling extension...");

        // 2. Initialize Settings & Styles
        try {
            try {
                this._settings = this.getSettings(AppConfig.schemaId);
            } catch (e) {
                log(`Explicit schema '${AppConfig.schemaId}' not found. Trying default...`);
                this._settings = this.getSettings(); 
            }
            
            this._applyStyles();

            this._settingsSignalEnabled = this._settings.connect('changed::enabled-styles', () => {
                log("Setting changed: enabled-styles");
                this._applyStyles();
            });
            
            this._settingsSignalCustom = this._settings.connect('changed::custom-styles', () => {
                log("Setting changed: custom-styles");
                this._applyStyles();
            });

        } catch (e) {
            logError("Failed to initialize settings or styles", e);
        }

        // 3. Create Indicators
        try {
            const indicator = new Indicator(this);
            indicator.init();
            this._indicators.push(indicator);
        } catch (e) {
            logError("Failed to create indicator", e);
        }
    }

    disable() {
        log("Disabling extension...");

        if (this._settings) {
            if (this._settingsSignalEnabled) this._settings.disconnect(this._settingsSignalEnabled);
            if (this._settingsSignalCustom) this._settings.disconnect(this._settingsSignalCustom);
            this._settingsSignalEnabled = null;
            this._settingsSignalCustom = null;
        }

        this._removeStyles();
        this._settings = null;

        this._indicators.forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this._indicators = [];
    }

    _applyStyles() {
        this._removeStyles();

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();
        const cssDir = GLib.build_filenamev([this.path, 'style', 'bundled']);

        // A. Load Bundled Styles
        const enabledBundled = this._settings.get_strv('enabled-styles') || [];
        for (const cssFile of enabledBundled) {
            try {
                const path = GLib.build_filenamev([cssDir, cssFile]);
                const file = Gio.File.new_for_path(path);
                if (file.query_exists(null)) {
                    theme.load_stylesheet(file);
                    this._stylesheetFiles.push(file);
                    log(`Applied bundled style: ${cssFile}`);
                }
            } catch (e) {
                logError(`Error loading bundled style ${cssFile}`, e);
            }
        }

        // B. Load Custom User Styles
        try {
            const customStyles = this._settings.get_value('custom-styles').deep_unpack();
            for (const [uri, enabled] of customStyles) {
                if (enabled) {
                    try {
                        const file = Gio.File.new_for_uri(uri);
                        if (file.query_exists(null)) {
                            theme.load_stylesheet(file);
                            this._stylesheetFiles.push(file);
                            log(`Applied custom style: ${uri}`);
                        }
                    } catch (e) {
                        logError(`Error loading custom style ${uri}`, e);
                    }
                }
            }
        } catch (e) {
            logError("Error parsing custom-styles", e);
        }

        themeContext.set_theme(theme);
    }

    _removeStyles() {
        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();

        for (const file of this._stylesheetFiles) {
            theme.unload_stylesheet(file);
        }
        this._stylesheetFiles = [];
        themeContext.set_theme(theme);
    }

    openPreferences(page = "") {
        if (page) {
            try {
                const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });
                settings.set_string("open-page", page);
            } catch (e) {
                logError("Failed to set preferences open-page", e);
            }
        }

        const display = global.display;
        const allWindows = display.list_all_windows();
        const appName = AppConfig.name;

        const existingWindow = allWindows.find((w) => {
            if (!w || !w.get_title) return false;
            const title = w.get_title() || "";
            // Check exact match or if title contains app name (e.g. "Page Name - App Name")
            return title === appName || title.includes(appName);
        });

        if (existingWindow) {
            existingWindow.activate(global.get_current_time());
        } else {
            try {
                // Use standard gnome-extensions tool to launch prefs for this UUID
                GLib.spawn_command_line_async(`gnome-extensions prefs ${AppConfig.uuid}`);
            } catch (e) {
                logError("Failed to open preferences window", e);
            }
        }
    }

    toggleFeature() { log("Feature toggled (Stub)"); }
    openLogs() { log("Opening logs (Stub)"); }
}