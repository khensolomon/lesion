import GLib from "gi://GLib";
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

  // 2. Find ANY conflicting "Extensions" app window
  _findConflictingWindow() {
    const display = global.display;
    return display.list_all_windows().find((w) => {
      if (!w || typeof w.get_wm_class !== 'function') return false;
      const wmClass = w.get_wm_class();
      // Check for official GNOME Extensions app or Extension Manager
      return wmClass && (
        wmClass.includes("org.gnome.Extensions") || 
        wmClass.includes("com.mattjakeman.ExtensionManager") ||
        wmClass.includes("gnome-extensions-app")
      );
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

    // B. If a conflicting "Extensions" window is open, CLOSE IT first.
    // This prevents the "Single Instance" blocking bug.
    const conflict = this._findConflictingWindow();
    if (conflict) {
        conflict.delete(global.get_current_time());
    }

    // C. Open new preferences with error handling
    const fallbackOpen = () => {
        try {
          // Use command line as last resort - usually works even if DBus fails
          GLib.spawn_command_line_async(`gnome-extensions prefs ${this.uuid}`);
        } catch (err) {
          logError("Failed to spawn preferences manually", err);
        }
    };

    try {
        // We capture the result of super.openPreferences()
        const result = super.openPreferences();
        
        // If it returns a Promise (GNOME 45+), we MUST handle rejection
        if (result && typeof result.then === 'function') {
            result.catch(err => {
                // This catch block suppresses the "Unhandled promise rejection" warning
                // log("Async openPreferences failed, attempting fallback..."); 
                fallbackOpen();
            });
        }
    } catch (e) {
        // If it throws synchronously (older GNOME), we catch it here
        // log("Sync openPreferences failed, attempting fallback...");
        fallbackOpen();
    }
  }
}