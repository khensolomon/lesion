import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createUI, installLayout } from './app/window.js'; // Import helper
import { AppConfig } from './app/config.js';

export default class GnomeSplitViewPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        AppConfig.init(this.metadata, true);

        window.set_default_size(
            AppConfig.defaults.window.width,
            AppConfig.defaults.window.height
        );
        
        const ui = createUI();
        window.set_content(ui);
        
        // NEW: Attach breakpoint logic explicitly to the preferences window
        installLayout(window, ui);
    }
}