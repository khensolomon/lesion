#!/usr/bin/env gjs

imports.gi.versions.Gtk = "4.0";
imports.gi.versions.Adw = "1";
const { Gtk, Adw } = imports.gi;

Adw.init();

class MainWindow extends Gtk.ApplicationWindow {
    constructor(app) {
        super._init({
            application: app,
            title: "Test Window",
            default_width: 400,
            default_height: 300
        });

        // Example content
        let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        this.set_child(box);

        // Example Adw header bar
        let header = new Adw.HeaderBar({ title: "My App" });
        box.append(header);
    }
}

class MyApp extends Gtk.Application {
    _init() {
        super._init({ application_id: "com.example.MyApp" });
    }

    vfunc_activate() {
        let win = new MainWindow(this);
        win.present();
    }
}

let app = new MyApp();
app.run([]);
