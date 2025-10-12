#!/usr/bin/env gjs --module
imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { Adw, Gtk, Gio, GObject } = imports.gi;
Adw.init();

// ───────────────────────────────────────────────
// Pure JS logic (no GObject, just structure)
// ───────────────────────────────────────────────
class ThemeManager {
  constructor(appWindow) {
    this.window = appWindow;
    this.buildUI();
  }

  buildUI() {
    const page = new Adw.StatusPage({
      icon_name: 'preferences-desktop-theme-symbolic',
      title: 'Theme Manager',
      description: 'Clean architecture demo using GJS + Libadwaita',
    });
    this.window.set_content(page);
  }
}

// ───────────────────────────────────────────────
// Minimal GObject wrapper for GTK/libadwaita
// ───────────────────────────────────────────────
const AppShell = GObject.registerClass(
class AppShell extends Adw.Application {
  _init() {
    super._init({
      application_id: 'dev.lethil.thememanager',
      flags: Gio.ApplicationFlags.FLAGS_NONE,
    });
  }

  vfunc_activate() {
    if (!this._window) {
      this._window = new Adw.ApplicationWindow({
        application: this,
        title: 'Theme Manager',
        default_width: 900,
        default_height: 600,
      });

      // Pass window to your logic class
      this._themeManager = new ThemeManager(this._window);
    }

    this._window.present();
  }
});

// ───────────────────────────────────────────────
// Entry point
// ───────────────────────────────────────────────
new AppShell().run([]);
