#!/usr/bin/env gjs

/**
 * A simple GNOME 46+ application (GTK4 + Libadwaita)
 * that detects and displays its own window size, written in GJS.
 *
 * You can run this file directly from your terminal:
 * $ gjs ./window_sizer.js
 *
 * Or by making it executable:
 * $ chmod +x ./window_sizer.js
 * $ ./window_sizer.js
 *
 * Make sure you have the GJS bindings for GTK4 and Libadwaita installed.
 * (e.g., gir1.2-gtk-4.0 and gir1.2-adw-1 on Debian/Ubuntu)
 */

// Set versions for GTK and Adwaita
imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

// Import modules using the 'imports' object
const Gtk = imports.gi.Gtk;
const Adw = imports.gi.Adw;
const GObject = imports.gi.GObject;
const System = imports.system;

// GObject.registerClass is the modern way to create GObject-based classes in JS
const WindowSizerWindow = GObject.registerClass(
class WindowSizerWindow extends Adw.ApplicationWindow {

    /**
     * Constructor for the main window.
     */
    _init(settings) {
        super._init(settings);

        // --- Window Properties ---
        this.set_title('GNOME Window Sizer (GJS)');
        this.set_default_size(450, 300);

        // --- Main UI Structure ---
        // Use Adw.ToolbarView to get the standard GNOME headerbar/content layout
        const mainView = new Adw.ToolbarView();
        this.set_content(mainView);

        // Add a header bar
        const headerBar = new Adw.HeaderBar();
        mainView.add_top_bar(headerBar);

        // --- Content Area ---
        // Create the label that will display the size
        // We store it as a class member `_sizeLabel` to access it in other methods
        this._sizeLabel = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            vexpand: true,
        });
        
        // Add a CSS class to make the text large and bold
        this._sizeLabel.add_css_class('title-1');
        
        // Add the label to the main view's content area
        mainView.set_content(this._sizeLabel);

        // --- Signal Connections ---
        // We will override the vfunc_size_allocate virtual function
        // instead of connecting to the signal.
        // this.connect('size-allocate', this._onSizeAllocated.bind(this));

        // --- Initial State ---
        // Call the update function once at startup to set the initial text
        this._updateTabVisibility();
    }

    /**
     * Override the GtkWidget.size_allocate virtual function.
     * This is called by GTK whenever the widget's size is allocated.
     */
    vfunc_size_allocate(width, height, baseline) {
        // IMPORTANT: Call the parent's implementation first
        super.vfunc_size_allocate(width, height, baseline);

        // Now, update our label
        this._updateTabVisibility();
    }

    /**
     * Signal handler for the "size-allocate" event.
     * (No longer used, as we are overriding the vfunc)
     */
    /*
    _onSizeAllocated() {
        this._updateTabVisibility();
    }
    */

    /**
     * Fetches the window's current size and updates the label.
     */
    _updateTabVisibility() {
        const width = this.get_allocated_width();
        const height = this.get_allocated_height();
        
        // Update the label's text
        this._sizeLabel.set_label(`${width} x ${height}`);
    }
});


const WindowSizerApplication = GObject.registerClass(
class WindowSizerApplication extends Adw.Application {
    
    /**
     * Constructor for the application.
     */
    _init() {
        super._init({
            application_id: 'com.example.windowsizer-gjs',
        });
        this._window = null;
    }

    /**
     * GObject virtual function called when the application is activated.
     */
    vfunc_activate() {
        // Create and present the main window
        if (!this._window) {
            this._window = new WindowSizerWindow({ application: this });
        }
        
        this._window.present();
    }
});

// --- Main Entry Point ---
// Create an instance of the app and run it
const app = new WindowSizerApplication();
app.run(System.programArgs);


