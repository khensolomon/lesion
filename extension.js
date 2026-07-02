import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { log, logError } from "./app/util/logger.js";
import { AppConfig } from "./app/config.js";
import { getComponents } from "./app/components/index.js";

export default class LesionExtension extends Extension {
  _instances = [];

  enable() {
    AppConfig.init(this.metadata, this.path, true);
    log("System started.");

    this._instances = getComponents()
      .map((ComponentClass) => {
        try {
          const instance = new ComponentClass(this);
          if (typeof instance.enable === "function") {
            instance.enable();
          }
          return instance;
        } catch (e) {
          logError(`Failed to load component ${ComponentClass.name}`, e);
          return null;
        }
      })
      .filter((i) => i !== null);
  }

  disable() {
    log("System stopping.");
    [...this._instances].reverse().forEach((instance) => {
      try {
        if (typeof instance.disable === "function") {
          instance.disable();
        }
      } catch (e) {
        logError("Error disabling component", e);
      }
    });
    this._instances = [];
  }

  // 1. Find OUR specific preferences window
  _getPreferencesWindow() {
    const display = global.display;
    const appName = this.metadata.name; 
    return display.list_all_windows().find((w) => {
      if (!w || !w.get_title) return false;
      const title = w.get_title();
      return title === appName || (title && title.startsWith(appName));
    });
  }

  get isPreferencesOpen() {
    return !!this._getPreferencesWindow();
  }

  closePreferences() {
    const win = this._getPreferencesWindow();
    if (win) {
      win.delete(global.get_current_time());
    }
  }

  openPreferences(page) {
    // Save the requested page to settings so the prefs window can read it on load
    if (page) {
      try {
        const schema = AppConfig.schemaId || this.metadata["settings-schema"];
        const s = this.getSettings(schema);
        s.set_string("open-page", page);
      } catch (e) {}
    }
    
    // A. If OUR window is already open, just focus it
    const existingWindow = this._getPreferencesWindow();
    if (existingWindow) {
      existingWindow.activate(global.get_current_time());
      return;
    }

    // B. Open preferences, handling the async rejection (GNOME 45+ returns a
    // Promise; an unhandled rejection would spam the journal).
    // NOTE: deliberately no subprocess fallback and no closing of other apps'
    // windows here — killing the Extensions app window or spawning
    // `gnome-extensions prefs` is hostile to the user and rejected by EGO
    // review. If the prefs dialog is blocked by another open dialog, the most
    // we should do is tell the user.
    try {
      const result = super.openPreferences();
      if (result && typeof result.then === "function") {
        result.catch((err) => {
          logError("Failed to open preferences (another extension dialog may be open)", err);
        });
      }
    } catch (e) {
      logError("Failed to open preferences", e);
    }
  }
}