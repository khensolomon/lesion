import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

export class StyleManager extends ExtensionComponent {
    
    onEnable() {
        this._stylesheetFiles = [];
        
        // Apply immediately
        this._applyStyles();

        // Watch settings using the base class 'observe' helper
        this.observe('changed::enabled-styles', () => {
            log("Setting changed: enabled-styles");
            this._applyStyles();
        });
        
        this.observe('changed::custom-styles', () => {
            log("Setting changed: custom-styles");
            this._applyStyles();
        });
    }

    onDisable() {
        this._removeStyles();
        this._stylesheetFiles = [];
    }

    _applyStyles() {
        this._removeStyles();

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();
        const cssDir = GLib.build_filenamev([this._extension.path, 'style', 'bundled']);
        const settings = this.getSettings();

        // A. Load Bundled Styles
        const enabledBundled = settings.get_strv('enabled-styles') || [];
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
            const customStyles = settings.get_value('custom-styles').deep_unpack();
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