import St from 'gi://St';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class LesionExtension extends Extension {
    enable() {
        this._settings = this.getSettings('dev.lethil.lesion');
        this._cssDir = `${this.path}/style`;
        this._stylesheetFiles = [];
        this._applyStyles();

        // Connect to changes for both keys
        this._settingsChangedId1 = this._settings.connect('changed::enabled-styles', () => this._applyStyles());
        this._settingsChangedId2 = this._settings.connect('changed::custom-styles', () => this._applyStyles());

        log('[Lesion] Extension enabled');
    }

    disable() {
        if (this._settingsChangedId1) {
            this._settings.disconnect(this._settingsChangedId1);
            this._settingsChangedId1 = null;
        }
        if (this._settingsChangedId2) {
            this._settings.disconnect(this._settingsChangedId2);
            this._settingsChangedId2 = null;
        }

        this._removeStyles();
        this._settings = null;

        log('[Lesion] Extension disabled');
    }

    _applyStyles() {
        this._removeStyles();

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();

        // --- 1. Load Bundled Styles ---
        const enabledBundled = this._settings.get_strv('enabled-styles') ?? [];
        for (const cssFile of enabledBundled) {
            try {
                const file = Gio.File.new_for_path(`${this._cssDir}/${cssFile}`);
                if (file.query_exists(null)) {
                    theme.load_stylesheet(file);
                    this._stylesheetFiles.push(file);
                    log(`[Lesion] Loaded bundled style: ${cssFile}`);
                }
            } catch (e) {
                log(`[Lesion] Error loading bundled style ${cssFile}: ${e}`);
            }
        }

        // --- 2. Load Custom User Styles ---
        const customStyles = this._settings.get_value('custom-styles').deep_unpack();
        for (const [uri, enabled] of customStyles) {
            if (enabled) {
                try {
                    const file = Gio.File.new_for_uri(uri);
                    if (file.query_exists(null)) {
                        theme.load_stylesheet(file);
                        this._stylesheetFiles.push(file);
                        log(`[Lesion] Loaded custom style: ${uri}`);
                    }
                } catch (e) {
                    log(`[Lesion] Error loading custom style ${uri}: ${e}`);
                }
            }
        }

        // --- 3. Apply the modified theme to the stage ---
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

