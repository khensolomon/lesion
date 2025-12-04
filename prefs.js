import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createUI, installLayout } from './app/window.js';
import { AppConfig } from './app/config.js';
import { log } from './app/util/logger.js';

export default class GnomeSplitViewPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // 1. Initialize Configuration
        // 'this.path' is the directory of the extension, provided by GNOME Shell
        AppConfig.init(this.metadata, this.path, true);

        log("Preferences window opening...");

        window.set_default_size(
            AppConfig.defaults.window.width,
            AppConfig.defaults.window.height
        );
        
        const ui = createUI();
        window.set_content(ui);
        
        installLayout(window, ui);
    }
}