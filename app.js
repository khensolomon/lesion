#!/usr/bin/env -S gjs --module
/**
 * ./app.js
 * gjs -m app.js
 */

import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0'; // Required for Display access
import Adw from 'gi://Adw?version=1';
import GLib from 'gi://GLib';
import { createUI } from './app/window.js';

const loop = new GLib.MainLoop(null, false);

// Define App ID as a constant to ensure it matches the icon filename
const APP_ID = 'com.example.GnomeSplitViewDemo';

const app = new Adw.Application({
    application_id: APP_ID,
    flags: 0 // GApplicationFlags.FLAGS_NONE
});

app.connect('activate', () => {
    // --- Icon Setup ---
    // Get the default display and the associated Icon Theme
    const display = Gdk.Display.get_default();
    if (display) {
        const iconTheme = Gtk.IconTheme.get_for_display(display);
        
        // Add the current working directory to the icon search path.
        // This allows GTK to find 'com.example.GnomeSplitViewDemo.svg' in this folder.
        const currentDir = GLib.get_current_dir();
        iconTheme.add_search_path(currentDir);
    }

    const window = new Adw.ApplicationWindow({
        application: app,
        title: 'GNOME Settings Style Demo',
        default_width: 800,
        default_height: 600,
        // Explicit minimum size is required when using AdwBreakpoints
        width_request: 360,
        height_request: 200,
        // Set the icon name to match your SVG file (without .svg extension)
        icon_name: APP_ID 
    });

    // Create the content from our shared window module
    const content = createUI();
    window.set_content(content);

    window.present();
});

// Run the application
app.run([]);