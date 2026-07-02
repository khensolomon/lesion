import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { AppConfig } from "../config.js";
import { log, logError } from '../util/logger.js';

export class Indicator {
  constructor(ext) {
    this.extension = ext;
    this.button = null;
    this._settings = null;
    this._settingsSignals = [];
    this._menuSignals = [];
  }

  enable() {
    // 1. Initialize Settings
    try {
        try {
            this._settings = this.extension.getSettings(AppConfig.schemaId);
        } catch {
            this._settings = this.extension.getSettings();
        }

        this._settingsSignals.push(
            this._settings.connect('changed::indicator-enabled', () => this._sync()),
            this._settings.connect('changed::indicator-custom-icon', () => this._updateIcon())
        );
    } catch(e) {
        logError("Failed to init indicator settings", e);
    }

    // 2. Initial Sync
    this._sync();
  }

  disable() {
    this._destroyButton();

    if (this._settings) {
        this._settingsSignals.forEach(id => this._settings.disconnect(id));
        this._settingsSignals = [];
        this._settings = null;
    }
  }

  _sync() {
      // Check if enabled
      const enabled = this._settings ? this._settings.get_boolean('indicator-enabled') : true;

      if (!enabled) {
          this._destroyButton();
          return;
      }

      if (!this.button) {
          this._createButton();
      }
  }

  _createButton() {
    const nameId = AppConfig.name || "Lesion Extension";
    this.button = new PanelMenu.Button(0.5, nameId, false);
    // Note: St widgets have no 'tooltip_text' (that's GTK); setting it here
    // was a silent no-op, so it has been removed.

    // Create Icon Bin
    this._iconBin = new St.Bin();
    this.button.add_child(this._iconBin);
    
    // Set Initial Icon
    this._updateIcon();

    // 1. Custom Click Handling
    this.button.connect('event', (actor, event) => {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            
            // Left Click: Open Preferences
            if (button === Clutter.BUTTON_PRIMARY) {
                this.extension.openPreferences();
                return Clutter.EVENT_STOP;
            }
            
            // Right Click: Toggle Menu
            if (button === Clutter.BUTTON_SECONDARY) {
                this.button.menu.toggle();
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    });

    // 2. Dynamic Menu Handling
    this._menuSignals.push(
        this.button.menu.connect('open-state-changed', (menu, open) => {
            if (open) {
                this._updateMenu();
            }
        })
    );

    // Initial build (populate static items if any, or just wait for open)
    this._updateMenu();

    const role = AppConfig.uuid || "lesion-indicator";
    // Default slot: right box, after Disks (0) and Trash (1) per the
    // default layout — Disks, Trash, Indicator, native items, clock, system menu.
    Main.panel.addToStatusArea(role, this.button, 2, 'right');
  }

  _destroyButton() {
      if (this.button) {
          this._menuSignals.forEach(id => this.button.menu.disconnect(id));
          this._menuSignals = [];
          
          this.button.destroy();
          this.button = null;
          this._iconBin = null;
      }
  }

  _updateIcon() {
      if (!this._iconBin) return;

      const customPath = this._settings ? this._settings.get_string('indicator-custom-icon') : '';
      let gicon = null;

      // Try custom icon
      if (customPath && customPath.length > 0) {
          try {
              const file = Gio.File.new_for_path(customPath);
              if (file.query_exists(null)) {
                  gicon = new Gio.FileIcon({ file: file });
              }
          } catch (e) {
              logError("Failed to load custom indicator icon", e);
          }
      }

      // Default Icon
      if (!gicon) {
          const iconPath = GLib.build_filenamev([this.extension.path, 'icon', 'hornbill-symbolic.svg']);
          gicon = Gio.icon_new_for_string(iconPath);
      }

      const icon = new St.Icon({
          gicon: gicon,
          style_class: "system-status-icon symbolic",
      });

      this._iconBin.set_child(icon);
  }

  _updateMenu() {
    if (!this.button) return;
    const menu = this.button.menu;
    
    // Clear existing items to rebuild based on state
    menu.removeAll();

    // Check if extension has a state flag for prefs window
    const isPrefsOpen = this.extension.isPreferencesOpen === true;

    // If NOT open, add "Open" at the top
    if (!isPrefsOpen) {
        const prefsItem = new PopupMenu.PopupMenuItem("Preferences");
        prefsItem.connect("activate", () => {
            try {
                this.extension.openPreferences();
            } catch (err) {
                logError("Failed to spawn preferences", err);
            }
        //   this.extension.openPreferences();
        });
        menu.addMenuItem(prefsItem);
    }

    // Add About
    const aboutItem = new PopupMenu.PopupMenuItem("About");
    aboutItem.connect("activate", () => {
      this.extension.openPreferences("about");
    });
    menu.addMenuItem(aboutItem);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const submenu = new PopupMenu.PopupSubMenuMenuItem("Options");
    // Example toggles
    if (this.extension.toggleFeature) {
        submenu.menu.addAction("Toggle Feature", () => this.extension.toggleFeature());
    }
    if (this.extension.openLogs) {
        submenu.menu.addAction("Open Logs", () => this.extension.openLogs());
    }
    menu.addMenuItem(submenu);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const quitItem = new PopupMenu.PopupMenuItem("Disable Extension");
    quitItem.connect("activate", () => {
      // FIX: calling this.extension.disable() directly desyncs GNOME Shell's
      // extension manager (the shell still believes the extension is enabled,
      // and re-enabling misbehaves). Go through the extension manager instead,
      // and defer it to idle: disabling destroys this very menu while its
      // 'activate' signal is still being emitted, which can crash the shell.
      const uuid = this.extension.uuid;
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        try {
          Main.extensionManager.disableExtension(uuid);
        } catch (e) {
          logError("Failed to disable extension", e);
        }
        return GLib.SOURCE_REMOVE;
      });
    });
    menu.addMenuItem(quitItem);

    // If open, add "Close" at the bottom
    if (isPrefsOpen) {
        const closeItem = new PopupMenu.PopupMenuItem("Close");
        closeItem.connect("activate", () => {
             // Assuming you implement closePreferences in your extension class
             if (typeof this.extension.closePreferences === 'function') {
                 this.extension.closePreferences();
             } else {
                 // Fallback if no close method exists: just toggle prefs
                 this.extension.openPreferences();
             }
        });
        menu.addMenuItem(closeItem);
    }
  }
}