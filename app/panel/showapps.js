import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { AppConfig } from '../config.js';
import { log, logError } from '../util/logger.js';

export class ShowAppsButton {
    constructor(ext) {
        this._extension = ext;
        this._settings = null;
        this._settingsSignals = [];
        
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
                // Note: We don't strictly need to listen to 'showapps-action' changes 
                // if we check the value dynamically inside the click handler.
            );

            this._sync();

        } catch (e) {
            logError("Failed to enable ShowAppsButton", e);
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
        
        // 1. Remove from container first
        if (this._button.get_parent() === this._container) {
            this._container.remove_child(this._button);
        }

        // 2. Find Activities Button Index
        let actIndex = 0;
        if (this._activitiesButton) {
            const children = this._container.get_children();
            actIndex = children.indexOf(this._activitiesButton);
            if (actIndex < 0) actIndex = 0; 
        }

        // 3. Get Setting (Enum: 0=Replace, 1=After, 2=Before)
        const position = this._settings.get_enum('showapps-position'); 
        
        if (position === 0) {
            // Mode: Replace
            if (this._activitiesButton) this._activitiesButton.hide();
            this._container.insert_child_at_index(this._button, actIndex);
        } else if (position === 1) {
            // Mode: After (Next to)
            if (this._activitiesButton) this._activitiesButton.show();
            this._container.insert_child_at_index(this._button, actIndex + 1);
        } else if (position === 2) {
            // Mode: Before
            if (this._activitiesButton) this._activitiesButton.show();
            // Insert at the same index as Activities currently is, pushing Activities to index+1
            this._container.insert_child_at_index(this._button, actIndex);
        }
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
                // If overview is visible AND app grid is active, we hide.
                // We rely on the standard Dash's "Show Apps" button state to know if we are in Grid mode.
                const isAppsOpen = Main.overview.visible && 
                                   Main.overview.dash && 
                                   Main.overview.dash.showAppsButton && 
                                   Main.overview.dash.showAppsButton.checked;

                if (isAppsOpen) {
                    Main.overview.hide();
                } else {
                    Main.overview.showApps();
                }
            } else {
                // Toggle Overview (Default behavior)
                Main.overview.toggle();
            }
            
            return Clutter.EVENT_STOP;
        });
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