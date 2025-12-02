#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { GObject, Adw, Gtk } = imports.gi;

Adw.init();

const app = new Adw.Application({ application_id: 'com.example.TextTabs' });

app.connect('activate', () => {
    const win = new Adw.ApplicationWindow({
        application: app,
        default_width: 400,
        default_height: 300
    });

    const stack = new Adw.ViewStack();
    stack.add_titled(new Gtk.Label({ label: 'Home Page' }), 'home', 'Home Very very Long Title of Home page');
    stack.add_titled(new Gtk.Label({ label: 'Settings Page' }), 'settings', 'Settings');
    stack.add_titled(new Gtk.Label({ label: 'About Page' }), 'about', 'About');

    // ViewSwitcher in header
    const switcher = new Adw.ViewSwitcher({
        stack,
        policy: Adw.ViewSwitcherPolicy.WIDE
    });

    // WindowTitle to control title visibility
    const windowTitle = new Adw.WindowTitle({
        title: 'TextTabs'
    });

    const header = new Adw.HeaderBar();
    header.set_title_widget(windowTitle);
    header.pack_start(switcher);  // Optional: align left

    // Bottom bar
    const switcherBar = new Adw.ViewSwitcherBar({ stack });
    switcherBar.add_css_class('custom-switcher-bar');

    // CORRECT: Bind WindowTitle.title-visible → ViewSwitcherBar.reveal
    windowTitle.bind_property(
        'title-visible',
        switcherBar,
        'reveal',
        GObject.BindingFlags.SYNC_CREATE
    );

    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    box.append(header);
    box.append(stack);
    box.append(switcherBar);

    win.set_content(box);
    win.present();
});

app.run([]);