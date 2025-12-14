import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

export class CornersManager extends ExtensionComponent {
    
    onEnable() {
        this._cssFile = null;
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

    onDisable() {
        // Clean up everything when disabled
        this._unloadShellStyles();
        this._cleanupShellFile();
        this._cleanGtkConfig(); 
    }

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

    // --- GNOME SHELL STYLING ---
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

    _unloadShellStyles() {
        if (this._cssFile) {
            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            const theme = themeContext.get_theme();
            theme.unload_stylesheet(this._cssFile);
            this._cssFile = null;
            themeContext.set_theme(theme);
        }
    }

    _cleanupShellFile() {
        try {
            const path = GLib.build_filenamev([this._extension.path, 'style', this._generatedFile]);
            const file = Gio.File.new_for_path(path);
            if (file.query_exists(null)) file.delete(null);
        } catch(e) {}
    }

    // --- APPLICATION STYLING (Safe CSS Injection) ---
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

    _cleanGtkConfig() {
        // Write empty string to remove our block
        this._writeUserGtkConfig('gtk-4.0', ''); 
        this._writeUserGtkConfig('gtk-3.0', ''); 
    }

    _writeUserGtkConfig(gtkVersionDir, newContent) {
        try {
            const configDir = GLib.get_user_config_dir();
            const gtkPath = GLib.build_filenamev([configDir, gtkVersionDir, 'gtk.css']);
            const file = Gio.File.new_for_path(gtkPath);

            let content = '';
            
            // Read existing file if it exists
            if (file.query_exists(null)) {
                const [success, raw] = file.load_contents(null);
                if (success) content = new TextDecoder().decode(raw);
            }

            // Regex to remove ONLY our previous block, keeping user's other configs safe
            const regex = new RegExp(`${this._escapeRegExp(this.BLOCK_START)}[\\s\\S]*?${this._escapeRegExp(this.BLOCK_END)}\\n?`, 'g');
            content = content.replace(regex, '');

            // Append new content
            if (newContent) {
                if (content.length > 0 && !content.endsWith('\n')) content += '\n';
                content += newContent;
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

    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}