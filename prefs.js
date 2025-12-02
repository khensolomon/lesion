import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { createUI } from './app/window.js';

export default class GnomeSplitViewPrefs {
    fillPreferencesWindow(window) {
        // We override the default PreferencesWindow behavior to inject our 
        // custom SplitView UI directly, giving us full control over the layout.
        
        // Ensure the window is large enough to see the effect
        window.set_default_size(800, 600);
        
        // Create our custom UI
        const ui = createUI();

        // In a strict AdwPreferencesWindow, we usually add pages. 
        // However, to get the specific "Left Column Navigation" layout 
        // exactly as requested (which mimics the outer shell of Settings),
        // we replace the content or add a full-size page containing our view.
        
        // Strategy: Add a single PreferencesPage with a custom group 
        // that fills the space, or simpler: set the content if allowed.
        // AdwPreferencesWindow is a GtkWindow.
        
        window.set_content(ui);
    }
}