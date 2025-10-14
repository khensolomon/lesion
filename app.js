#!/usr/bin/gjs -m

// Set the versions for all required GTK libraries
imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';
imports.gi.versions.Gdk = '4.0';

// Import all necessary modules
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

// Import our custom modules
import { loadMetadata } from './core/config.js';
import { ThemeManagerUIShell } from './ui/shell.js';
import { Settings } from './core/settings.js';
import { StyleManager } from './core/styleManager.js';

// Define and register the main Application class
const ThemeManagerApp = GObject.registerClass(
class ThemeManagerApp extends Adw.Application {
    /**
     * The constructor for the application. It's called when the application is first launched.
     */
    _init() {
        const metadata = loadMetadata();
        super._init({
            application_id: metadata.applicationId,
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });

        this.metadata = metadata;
        this.settings = new Settings();
        this.ui = new ThemeManagerUIShell(this);

        // Prefix with an underscore to mark it as a standard JS property, not a GObject property.
        this._styleManager = null;
    }

    /**
     * This function is called when the application is activated (e.g., launched from the menu).
     * It's responsible for showing the main window.
     */
    vfunc_activate() {
        // Create the StyleManager on the first activation.
        // This ensures the display is ready before we try to access it.
        if (!this._styleManager && this.settings.settings) {
            this._styleManager = new StyleManager(this.settings);
        }
        
        this.ui.present();
    }
});

// Create an instance of our application and run it
const app = new ThemeManagerApp();
app.run([]);

