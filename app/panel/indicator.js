import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { AppConfig } from "../config.js";

/**
 * indicator.js
 * Manages the top bar (panel) indicator for the extension.
 */
export class Indicator {
  /**
   * @param {Extension} ext - The main extension instance.
   */
  constructor(ext) {
    this.extension = ext;

    // Use AppConfig for name (fallback to metadata)
    const nameId = AppConfig.name || "Lesion Extension";

    this.button = new PanelMenu.Button(0.5, nameId, false);
    this.button.tooltip_text = nameId;

    // === Add Icon ===
    // Build path to: [extension_root]/app/icon/panel-symbolic.svg
    const iconPath = GLib.build_filenamev([this.extension.path, 'app', 'icon', 'panel-symbolic.svg']);
    
    const icon = new St.Icon({
      gicon: Gio.icon_new_for_string(iconPath),
      style_class: "system-status-icon symbolic",
    });
    
    // Fallback if file doesn't exist
    // Note: In Shell, we can't easily check file existence synchronously without warnings 
    // unless we use Gio.File, but usually we assume the asset exists.
    
    this.button.add_child(icon);

    // === Build Menu ===
    this._buildMenu();
  }

  _buildMenu() {
    const menu = this.button.menu;

    // 1. Preferences
    const prefsItem = new PopupMenu.PopupMenuItem("Show Preferences");
    prefsItem.connect("activate", () => {
      this.extension.openPreferences();
    });
    menu.addMenuItem(prefsItem);

    // Separator
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // 2. Quit/Disable
    const quitItem = new PopupMenu.PopupMenuItem("Disable Extension");
    quitItem.connect("activate", () => {
      this.extension.disable();
    });
    menu.addMenuItem(quitItem);

    // 3. Submenu (Options)
    const submenu = new PopupMenu.PopupSubMenuMenuItem("Options");

    submenu.menu.addAction("Toggle Feature", () => {
      this.extension.toggleFeature();
    });

    submenu.menu.addAction("Open Logs", () => {
      this.extension.openLogs();
    });

    menu.addMenuItem(submenu);

    // Separator
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // 4. About (Deep Link)
    const aboutItem = new PopupMenu.PopupMenuItem("About");
    aboutItem.connect("activate", () => {
      // Pass 'about' as the page ID to open
      this.extension.openPreferences("about");
    });
    menu.addMenuItem(aboutItem);
  }

  init() {
    // Add to panel
    const role = AppConfig.uuid || "lesion-indicator";
    Main.panel.addToStatusArea(role, this.button);
  }

  destroy() {
    if (this.button) {
      this.button.destroy();
      this.button = null;
    }
  }
}