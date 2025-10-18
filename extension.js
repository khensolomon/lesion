import St from 'gi://St';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class LesionExtension extends Extension {
    enable() {
        this._settings = this.getSettings('dev.lethil.lesion');
        this._cssDir = `${this.path}/style`;
        // We need to store the actual Gio.File objects to unload them later
        this._stylesheetFiles = [];
        this._applyStyles();

        this._settingsChangedId = this._settings.connect(
            'changed::enabled-styles',
            () => this._applyStyles()
        );

        log('[Lesion] Extension enabled');
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        this._removeStyles();
        this._settings = null;

        log('[Lesion] Extension disabled');
    }

    _applyStyles() {
        // It's safer to remove old styles before applying new ones
        this._removeStyles();

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();
        const enabledFiles = this._settings.get_strv('enabled-styles') ?? [];
     
        for (const cssFile of enabledFiles) {
            const cssPath = `${this._cssDir}/${cssFile}`;
            const file = Gio.File.new_for_path(cssPath);

            if (!file.query_exists(null)) {
                log(`[Lesion] Missing CSS file: ${cssPath}`);
                continue;
            }

            try {
                // Step 1: Load the stylesheet into the current theme object.
                // This makes the theme aware of the file, but doesn't apply it yet.
                theme.load_stylesheet(file);

                // Keep a reference to the Gio.File object for removal on disable
                this._stylesheetFiles.push(file);
                log(`[Lesion] Loaded ${cssFile}`);

            } catch (e) {
                log(`[Lesion] Error loading ${cssPath}: ${e}`);
            }
        }

        // ✅ Step 2: The CRITICAL missing step.
        // We assign the modified theme back to the theme context. This forces
        // the shell to re-evaluate its styles and apply our changes.
        themeContext.set_theme(theme);
    }

    _removeStyles() {
        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const theme = themeContext.get_theme();

        for (const file of this._stylesheetFiles) {
            // Unload the stylesheet from the theme object
            theme.unload_stylesheet(file);
        }

        // Reset the array
        this._stylesheetFiles = [];

        // Also critical: Apply the "cleaned" theme back to the shell
        // to make the removal visible.
        themeContext.set_theme(theme);
    }
}

