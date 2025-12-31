import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { AppConfig } from '../config.js';
import { log, logError } from '../util/logger.js';

// Renamed class from ShowAppsButton to AppButton for brevity and clarity
export class AppButton {
    constructor(ext) {
        this._extension = ext;
        this._settings = null;
        this._settingsSignals = [];
        this._overviewSignals = []; // Store signal objects {obj, id} for clean removal
        
        this._button = null;
        this._activitiesButton = Main.panel.statusArea['activities'];
        this._container = Main.panel._leftBox; 
    }

    enable() {
        try {
            try {
                this._settings = this._extension.getSettings(AppConfig.schemaId);
            } catch {
                this._settings = this._extension.getSettings();
            }

            this._settingsSignals.push(
                this._settings.connect('changed::showapps-enabled', () => this._sync()),
                this._settings.connect('changed::showapps-position', () => this._sync()),
                this._settings.connect('changed::showapps-custom-icon', () => this._updateIcon()),
                this._settings.connect('changed::showapps-action', () => this._updateState())
            );

            // --- State Monitoring (Fixes visual feedback issue) ---
            
            // Helper to safely connect signals and store them for cleanup
            const addSignal = (obj, signal, callback) => {
                if (obj) {
                    const id = obj.connect(signal, callback);
                    this._overviewSignals.push({ obj, id });
                }
            };

            // Monitor Overview transition states to update button appearance immediately
            addSignal(Main.overview, 'showing', () => this._updateState());
            addSignal(Main.overview, 'hiding', () => this._updateState());
            addSignal(Main.overview, 'shown', () => this._updateState());
            addSignal(Main.overview, 'hidden', () => this._updateState());

            // Monitor Dash's internal button state
            // This is crucial for distinguishing between "Window Picker" and "App Grid" modes
            if (Main.overview.dash && Main.overview.dash.showAppsButton) {
                addSignal(Main.overview.dash.showAppsButton, 'notify::checked', () => this._updateState());
            }

            this._sync();

        } catch (e) {
            logError("Failed to enable AppButton", e);
        }
    }

    disable() {
        if (this._activitiesButton) {
            this._activitiesButton.show();
        }

        if (this._button) {
            this._button.destroy();
            this._button = null;
        }

        if (this._settings) {
            this._settingsSignals.forEach(id => this._settings.disconnect(id));
            this._settingsSignals = [];
            this._settings = null;
        }

        // Clean up external signals
        this._overviewSignals.forEach(sig => {
            try {
                sig.obj.disconnect(sig.id);
            } catch (e) {
                // Ignore errors if object was already destroyed
            }
        });
        this._overviewSignals = [];
    }

    _sync() {
        const enabled = this._settings.get_boolean('showapps-enabled');

        if (!enabled) {
            if (this._button) {
                this._button.destroy();
                this._button = null;
            }
            if (this._activitiesButton) this._activitiesButton.show();
            return;
        }

        if (!this._button) {
            this._createButton();
        }

        // --- Positioning Logic ---
        
        // 1. Remove from container first to ensure clean insertion
        if (this._button.get_parent()) {
            this._button.get_parent().remove_child(this._button);
        }

        // 2. Get Settings and References
        const position = this._settings.get_enum('showapps-position'); // 0=Replace, 1=After, 2=Before
        const actBtn = this._activitiesButton;
        
        // 3. Handle Activities Button Visibility
        // We do this before calculating indices to ensure state is consistent, 
        // though visibility doesn't strictly affect child index in Clutter, it's good practice.
        if (actBtn) {
            if (position === 0) { // Replace
                actBtn.hide();
            } else {
                actBtn.show();
            }
        }

        // 4. Calculate Insertion Index
        let insertIndex = 0; 
        
        // Check if activities button is valid and in the correct container
        if (actBtn && actBtn.get_parent() === this._container) {
            const children = this._container.get_children();
            const actIndex = children.indexOf(actBtn);

            if (actIndex >= 0) {
                if (position === 1) { 
                    // Mode: After
                    // Insert at index + 1 to appear after the activities button
                    insertIndex = actIndex + 1;
                } else {
                    // Mode: Before OR Replace
                    // Insert at actIndex to appear before (or strictly 'at' the spot of) the activities button
                    insertIndex = actIndex;
                }
            }
        }

        // 5. Insert Button
        this._container.insert_child_at_index(this._button, insertIndex);

        // Ensure state is correct after sync
        this._updateState();
    }

    _createButton() {
        this._button = new St.Bin({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            x_expand: false,
            y_expand: false,
            track_hover: true
        });

        this._iconBin = new St.Bin();
        this._button.set_child(this._iconBin);
        this._updateIcon();

        // Click Handler
        this._button.connect('button-press-event', () => {
            if (!this._settings) return Clutter.EVENT_PROPAGATE;

            // Check action setting dynamically
            // 0 = Toggle Overview, 1 = Show Apps
            const action = this._settings.get_enum('showapps-action');

            if (action === 1) {
                // Show App Grid (Toggle behavior)
                // If Overview is already active (either Window Picker OR Grid), close it.
                // This ensures the button always toggles the view off if it's open.
                if (Main.overview.visible) {
                    Main.overview.hide();
                } else {
                    // If Grid is NOT open (Desktop), open Apps.
                    Main.overview.showApps();
                }
            } else {
                // Toggle Overview (Standard behavior)
                Main.overview.toggle();
            }
            
            return Clutter.EVENT_STOP;
        });
    }

    // New method to handle visual feedback
    _updateState() {
        if (!this._button || !this._settings) return;

        const action = this._settings.get_enum('showapps-action');
        let isActive = false;

        if (action === 1) {
            // Mode: Show Apps
            // Button is active ONLY if the Application Grid is actually visible
            const dashButton = Main.overview.dash.showAppsButton;
            isActive = dashButton && dashButton.checked;
        } else {
            // Mode: Toggle Overview
            // Button is active if Overview is visible (either Window Picker OR Grid)
            isActive = Main.overview.visible;
        }

        // Apply visual classes
        if (isActive) {
            this._button.add_style_class_name('active');
            this._button.add_style_pseudo_class('active');
            this._button.add_style_pseudo_class('checked');
        } else {
            this._button.remove_style_class_name('active');
            this._button.remove_style_pseudo_class('active');
            this._button.remove_style_pseudo_class('checked');
        }
    }

    _updateIcon() {
        if (!this._button) return;

        const customPath = this._settings.get_string('showapps-custom-icon');
        let gicon = null;

        if (customPath && customPath.length > 0) {
            try {
                const file = Gio.File.new_for_path(customPath);
                if (file.query_exists(null)) {
                    gicon = new Gio.FileIcon({ file: file });
                }
            } catch (e) {
                logError("Failed to load custom showapps icon", e);
            }
        }

        if (!gicon) {
            gicon = Gio.icon_new_for_string('start-here-symbolic');
        }

        const icon = new St.Icon({
            gicon: gicon,
            style_class: 'system-status-icon',
            icon_size: 16
        });

        this._iconBin.set_child(icon);
    }
}