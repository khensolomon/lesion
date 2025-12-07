import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import { log, logError } from '../util/logger.js';
import { AppConfig } from '../config.js';

export class StyleManager {
    /**
     * @param {Extension} ext - The main extension instance.
     */
    constructor(ext) {
        this._extension = ext;
        this._stylesheetFiles = [];
        this._settings = null;
        this._signals = [];
    }

    /**
     * Initializes settings and applies styles.
     */
    enable() {
        // Initialize settings logic locally since it pertains to styles
        try {
            try {
                this._settings = this._extension.getSettings(AppConfig.schemaId);
            } catch (e) {
                log(`Explicit schema '${AppConfig.schemaId}' not found. Trying default...`);
                this._settings = this._extension.getSettings(); 
            }
            
            // Initial application
            this._applyStyles();

            // Connect signals
            const sig1 = this._settings.connect('changed::enabled-styles', () => {
                log("Setting changed: enabled-styles");
                this._applyStyles();
            });
            
            const sig2 = this._settings.connect('changed::custom-styles', () => {
                log("Setting changed: custom-styles");
                this._applyStyles();
            });

            this._signals.push(sig1, sig2);
        } catch (e) {
            logError("Failed to initialize StyleManager settings", e);
        }
    }

    disable() {
        if (this._settings) {
            this._signals.forEach(id => this._settings.disconnect(id));
        }
        this._signals = [];
        this._settings = null;

        this._removeStyles();
    }

    _applyStyles() {
        this._removeStyles();

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();
        const cssDir = GLib.build_filenamev([this._extension.path, 'style', 'bundled']);

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
}