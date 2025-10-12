#!/usr/bin/gjs -m

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import { loadMetadata } from './core/config.js';
import { ThemeManagerUIShell } from './ui/shell.js';
import { Settings } from './core/settings.js';

// Proper GType registration is **mandatory** for Adw.Application subclasses.
const ThemeManagerApp = GObject.registerClass(
class ThemeManagerApp extends Adw.Application {
    _init() {
        const metadata = loadMetadata();
        super._init({
            application_id: metadata.applicationId,
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });

        this.metadata = metadata;
        this.settings = new Settings();
        this.ui = new ThemeManagerUIShell(this);
    }

    vfunc_activate() {
        this.ui.present();
    }
});

const app = new ThemeManagerApp();
app.run([]);
