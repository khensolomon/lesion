import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
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
    this.button.tooltip_text = nameId;

    // Create Icon Bin
    this._iconBin = new St.Bin();
    this.button.add_child(this._iconBin);
    
    // Set Initial Icon
    this._updateIcon();

    this._buildMenu();

    const role = AppConfig.uuid || "lesion-indicator";
    Main.panel.addToStatusArea(role, this.button);
  }

  _destroyButton() {
      if (this.button) {
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
          const iconPath = GLib.build_filenamev([this.extension.path, 'app', 'icon', 'panel-symbolic.svg']);
          gicon = Gio.icon_new_for_string(iconPath);
      }

      const icon = new St.Icon({
          gicon: gicon,
          style_class: "system-status-icon symbolic",
      });

      this._iconBin.set_child(icon);
  }

  _buildMenu() {
    if (!this.button) return;
    const menu = this.button.menu;

    const prefsItem = new PopupMenu.PopupMenuItem("Show Preferences");
    prefsItem.connect("activate", () => {
      this.extension.openPreferences();
    });
    menu.addMenuItem(prefsItem);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const quitItem = new PopupMenu.PopupMenuItem("Disable Extension");
    quitItem.connect("activate", () => {
      this.extension.disable();
    });
    menu.addMenuItem(quitItem);

    const submenu = new PopupMenu.PopupSubMenuMenuItem("Options");
    submenu.menu.addAction("Toggle Feature", () => this.extension.toggleFeature());
    submenu.menu.addAction("Open Logs", () => this.extension.openLogs());
    menu.addMenuItem(submenu);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const aboutItem = new PopupMenu.PopupMenuItem("About");
    aboutItem.connect("activate", () => {
      this.extension.openPreferences("about");
    });
    menu.addMenuItem(aboutItem);
  }
}