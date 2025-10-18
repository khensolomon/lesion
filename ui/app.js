#!/usr/bin/env gjs

imports.gi.versions.Gtk = "4.0";
imports.gi.versions.Adw = "1";

const { Gtk, Gdk, Adw } = imports.gi;
Adw.init();

function loadCss() {
    let cssProvider = new Gtk.CssProvider();
    cssProvider.load_from_path('./style.css');
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );
}

class MainWindow extends Adw.ApplicationWindow {
    constructor(app) {
        super._init({ application: app, title: "My App", default_width: 1200, default_height: 800 });

        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
        this.set_content(hbox);

        let menu_revealer = new Gtk.Revealer({ reveal_child: true, transition_type: Gtk.RevealerTransitionType.SLIDE_RIGHT });
        let menu_box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
        menu_box.set_name("menu-box");
        menu_box.set_size_request(250, -1);
        menu_revealer.set_child(menu_box);

        let separator = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
        separator.set_name("vertical-separator");

        let content_box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });

        hbox.append(menu_revealer);
        hbox.append(separator);
        hbox.append(content_box);

        let header_bar = new Adw.HeaderBar({ show_title_buttons: true });
        let toggle_button = new Gtk.Button({ icon_name: "open-menu-symbolic" });
        toggle_button.connect("clicked", () => menu_revealer.set_reveal_child(!menu_revealer.get_reveal_child()));
        header_bar.pack_start(toggle_button);
        this.set_titlebar(header_bar);

        this.connect("size-allocate", (widget, allocation) => {
            if (allocation.width <= 800) menu_revealer.set_reveal_child(false);
            else menu_revealer.set_reveal_child(true);
        });
    }
}

class MyApp extends Adw.Application {
    _init() {
        super._init({ application_id: "com.example.MyApp" });
    }

    vfunc_activate() {
        loadCss();
        let win = new MainWindow(this);
        win.present();
    }
}

let app = new MyApp();
app.run([]);
