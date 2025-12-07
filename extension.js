import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { log, logError } from './app/util/logger.js';
import { AppConfig } from './app/config.js';

// Modular Components
import { Indicator } from './app/panel/indicator.js';
import { WallpaperManager } from './app/ext/wallpaper.js';
import { StyleManager } from './app/ext/styles.js';
import { ShowAppsButton } from './app/panel/showapps.js';

export default class LesionExtension extends Extension {
    // Registry for active components (Managers, UI elements, etc.)
    _components = [];

    enable() {
        // 1. Initialize Configuration
        AppConfig.init(this.metadata, this.path, true);
        log("Enabling extension...");

        // 2. Register Components
        // Order matters if components depend on each other.
        this._components = [
            new WallpaperManager(this),
            new StyleManager(this),
            new Indicator(this),
            new ShowAppsButton(this)
        ];

        // 3. Enable All
        this._components.forEach(component => {
            try {
                if (typeof component.enable === 'function') {
                    component.enable();
                }
            } catch (e) {
                logError(`Failed to enable component ${component.constructor.name}`, e);
            }
        });
    }

    disable() {
        log("Disabling extension...");

        // Disable all components in reverse order (LIFO) usually safer
        // but for these independent components, order is less critical.
        // We iterate copy to allow modification if needed, though simple loop is fine.
        [...this._components].reverse().forEach(component => {
            try {
                if (typeof component.disable === 'function') {
                    component.disable();
                }
            } catch (e) {
                logError(`Failed to disable component ${component.constructor.name}`, e);
            }
        });

        // Clear registry
        this._components = [];
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
            return title === appName || title.includes(appName);
        });

        if (existingWindow) {
            existingWindow.activate(global.get_current_time());
        } else {
            try {
                GLib.spawn_command_line_async(`gnome-extensions prefs ${AppConfig.uuid}`);
            } catch (e) {
                logError("Failed to open preferences window", e);
            }
        }
    }

    toggleFeature() { log("Feature toggled (Stub)"); }
    openLogs() { log("Opening logs (Stub)"); }
}