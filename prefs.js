'use strict';

const { Adw, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

function fillPreferencesWindow(window) {
    const settings = Settings.getSettings();
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({ title: 'Lesion CSS Manager' });

    const label = new Gtk.Label({
        label: 'All CSS files inside ~/dev/lesion/style/ are automatically applied.\nYou can modify them live and see results instantly.',
        wrap: true,
        xalign: 0
    });

    group.add(label);
    page.add(group);
    window.add(page);
}

function init() {}

function buildPrefsWidget() {
    const window = new Adw.PreferencesWindow();
    fillPreferencesWindow(window);
    return window;
}
