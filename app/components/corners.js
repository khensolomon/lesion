import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

/**
 * Manages the application of custom corner radii to GNOME Shell and GTK applications.
 * Handles the generation of CSS and safe injection into user config files.
 * @extends ExtensionComponent
 */
export class CornersManager extends ExtensionComponent {
    
    /**
     * Called when the extension component is enabled.
     * Initializes configuration paths and sets up settings listeners.
     */
    onEnable() {
        /** @type {Gio.File|null} Reference to the generated shell CSS file */
        this._cssFile = null;
        
        /** @type {string} Name of the generated CSS file */
        this._generatedFile = 'dynamic-corners.css';
        
        // Marker tags to safely edit user files without deleting other configs
        this.BLOCK_START = '/* LESION-CORNERS-START */';
        this.BLOCK_END = '/* LESION-CORNERS-END */';

        // Apply settings immediately
        this._sync();

        // Watch for changes
        this.observe('changed::corners-enabled', () => this._sync());
        this.observe('changed::corners-radius', () => this._sync());
        this.observe('changed::corners-flat', () => this._sync());
    }

    /**
     * Called when the extension component is disabled.
     * Reverts all changes to Shell and GTK configurations.
     */
    onDisable() {
        this._unloadShellStyles();
        this._cleanupShellFile();
        this._cleanGtkConfig(); 
    }

    /**
     * Synchronizes the current settings with the applied styles.
     * Decides whether to apply styles or clean them up based on the 'corners-enabled' key.
     * @private
     */
    _sync() {
        const settings = this.getSettings();
        const enabled = settings.get_boolean('corners-enabled');

        if (!enabled) {
            this._unloadShellStyles();
            this._cleanGtkConfig();
            return;
        }

        const isFlat = settings.get_boolean('corners-flat');
        const radius = isFlat ? 0 : settings.get_int('corners-radius');

        // 1. Update GNOME Shell (Overview, Panel, etc.)
        this._syncShell(radius, isFlat);

        // 2. Update Applications (GTK3 & GTK4)
        this._syncGtk(radius);
    }

    /**
     * Generates and loads the CSS for GNOME Shell elements.
     * @param {number} radius - The border radius in pixels.
     * @param {boolean} isFlat - Whether to force flat corners on specific elements like panels.
     * @private
     */
    _syncShell(radius, isFlat) {
        this._unloadShellStyles();

        const cssContent = `
            .window-clone-border, 
            .modal-dialog, 
            .popup-menu-content, 
            .workspace-thumbnail-indicator,
            .search-section-content,
            .switcher-list {
                border-radius: ${radius}px !important;
            }
            ${isFlat ? `.panel-button { border-radius: 0px !important; }` : ''}
        `;

        try {
            const path = GLib.build_filenamev([this._extension.path, 'style', this._generatedFile]);
            const file = Gio.File.new_for_path(path);
            
            // Replace contents asynchronously or synchronously - keeping sync for simplicity in settings callback
            file.replace_contents(cssContent, null, false, Gio.FileCreateFlags.NONE, null);

            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            const theme = themeContext.get_theme();
            theme.load_stylesheet(file);
            this._cssFile = file;
            themeContext.set_theme(theme);
        } catch (e) {
            logError("Failed to apply shell corners", e);
        }
    }

    /**
     * Unloads the previously loaded stylesheet from the GNOME Shell theme.
     * @private
     */
    _unloadShellStyles() {
        if (this._cssFile) {
            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            const theme = themeContext.get_theme();
            theme.unload_stylesheet(this._cssFile);
            this._cssFile = null;
            themeContext.set_theme(theme);
        }
    }

    /**
     * Deletes the temporary CSS file generated for GNOME Shell.
     * @private
     */
    _cleanupShellFile() {
        try {
            const path = GLib.build_filenamev([this._extension.path, 'style', this._generatedFile]);
            const file = Gio.File.new_for_path(path);
            if (file.query_exists(null)) file.delete(null);
        } catch(e) {}
    }

    /**
     * Prepares the CSS content for GTK applications and injects it into user config.
     * @param {number} radius - The border radius in pixels.
     * @private
     */
    _syncGtk(radius) {
        // Stronger selectors to override system themes
        const gtkCss = `
${this.BLOCK_START}
/* Force radius on main window elements */
window, 
.background, 
.window-frame, 
.decoration,
decoration {
    border-radius: ${radius}px !important;
}

/* Fix bottom corners specifically for Libadwaita/Adwaita */
window.csd, 
.window-frame.csd, 
.solid-csd {
    border-bottom-left-radius: ${radius}px !important;
    border-bottom-right-radius: ${radius}px !important;
}

/* Popovers and Menus */
menu, .csd.popup {
    border-radius: ${radius}px !important;
}
${this.BLOCK_END}
`;
        // Apply to both GTK 4 (Libadwaita apps) and GTK 3 (Older apps)
        this._writeUserGtkConfig('gtk-4.0', gtkCss);
        this._writeUserGtkConfig('gtk-3.0', gtkCss);
    }

    /**
     * Removes the extension's CSS blocks from GTK configurations.
     * @private
     */
    _cleanGtkConfig() {
        // Write empty string to remove our block
        this._writeUserGtkConfig('gtk-4.0', ''); 
        this._writeUserGtkConfig('gtk-3.0', ''); 
    }

    /**
     * Writes (or cleans) specific CSS blocks in the user's GTK configuration file.
     * Performs a check to avoid writing to disk if the content hasn't changed.
     * * @param {string} gtkVersionDir - The GTK directory name (e.g., 'gtk-3.0', 'gtk-4.0').
     * @param {string} newContent - The CSS content to insert (or empty string to remove).
     * @private
     */
    _writeUserGtkConfig(gtkVersionDir, newContent) {
        try {
            const configDir = GLib.get_user_config_dir();
            const gtkPath = GLib.build_filenamev([configDir, gtkVersionDir, 'gtk.css']);
            const file = Gio.File.new_for_path(gtkPath);

            let content = '';
            let originalContent = '';
            
            // Read existing file if it exists
            if (file.query_exists(null)) {
                const [success, raw] = file.load_contents(null);
                if (success) {
                    originalContent = new TextDecoder().decode(raw);
                    content = originalContent;
                }
            }

            // Regex to remove ONLY our previous block, keeping user's other configs safe
            const regex = new RegExp(`${this._escapeRegExp(this.BLOCK_START)}[\\s\\S]*?${this._escapeRegExp(this.BLOCK_END)}\\n?`, 'g');
            content = content.replace(regex, '');

            // Append new content if provided
            if (newContent) {
                if (content.length > 0 && !content.endsWith('\n')) content += '\n';
                content += newContent;
            }

            // OPTIMIZATION: If the content hasn't changed, do nothing.
            // This prevents "doing something" when disabled if the file is already clean.
            if (content === originalContent) {
                return;
            }

            // Ensure directory exists
            const parent = file.get_parent();
            if (!parent.query_exists(null)) parent.make_directory_with_parents(null);

            file.replace_contents(content, null, false, Gio.FileCreateFlags.NONE, null);
            log(`Updated ${gtkVersionDir}/gtk.css`);

        } catch (e) {
            logError(`Failed to write config for ${gtkVersionDir}`, e);
        }
    }

    /**
     * Escapes special characters for use in a Regular Expression.
     * @param {string} string - The string to escape.
     * @returns {string} The escaped string.
     * @private
     */
    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}