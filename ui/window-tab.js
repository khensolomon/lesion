// This script creates a native GNOME application using GJS and the modern Adwaita
// widgets (`Adw.ViewSwitcherTitle` and `Adw.ViewStack`) for a seamless, native tabbed interface.
// To run: gjs window.js

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';
const { GObject, Gio, Gtk, Adw } = imports.gi;

var MyApplication = GObject.registerClass(
class MyApplication extends Adw.Application {
    _init() {
        super._init({
            application_id: 'org.example.ChromeTabs',
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });
        this.connect('activate', this._onActivate.bind(this));
    }

    _onActivate() {
        if (!this.window) this.window = new MyWindow({ application: this });
        this.window.present();
    }
});

var MyWindow = GObject.registerClass(
class MyWindow extends Adw.ApplicationWindow {
    _init(params) {
        super._init(params);
        this.tabCounter = 0;
        this.set_default_size(1000, 650);
        this.set_title("");

        // --- Main ViewStack ---
        const viewStack = new Adw.ViewStack();
        viewStack.add_css_class('chrome-body');

        // --- ViewSwitcher (Tabs) ---
        const viewSwitcher = new Adw.ViewSwitcherTitle({
            stack: viewStack,
            // Removed halign from here as it wasn't working
        });
        viewSwitcher.add_css_class('tab-switcher');

        // --- NEW FIX: Wrap switcher in a Box to force left alignment ---
        const titleBox = new Gtk.Box();
        titleBox.set_halign(Gtk.Align.START); // Align the box itself to the left
        titleBox.append(viewSwitcher); // Add the switcher to the box

        // --- HeaderBar ---
        const headerBar = new Adw.HeaderBar({
            // REMOVED: title_widget: titleBox,
            // REMOVED: centering_policy: Adw.CenteringPolicy.LOOSE,
        });
        // Add a "new tab" button
        const newTabButton = new Gtk.Button({ icon_name: 'list-add-symbolic' });
        newTabButton.connect('clicked', () => this._addTab(viewStack));
        headerBar.pack_end(newTabButton);

        // const openMenuButton = new Gtk.Button({ icon_name: 'open-menu-symbolic' });
        // headerBar.pack_start(openMenuButton);
        
        // THE REAL FIX:
        // Pack the titleBox (with the tabs) right after the menu button
        // instead of using set_title_widget()
        headerBar.pack_start(titleBox);
        
        headerBar.add_css_class('chrome-headerbar');


        // --- ToolbarView (no gaps) ---
        // const toolbarView = new Adw.ToolbarView();
        // toolbarView.add_top_bar(headerBar);
        // toolbarView.set_content(viewStack);
        // this.set_content(toolbarView);

// --- True seamless Chrome-like layout ---
const mainBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
});
mainBox.add_css_class('chrome-main');
mainBox.append(headerBar);
viewStack.add_css_class('chrome-body');
mainBox.append(viewStack);
this.set_content(mainBox);

// --- CSS ---
const css = `
box.chrome-main > stack.chrome-body {
    border-radius: 8px;

}

/* Other styling for headerbar, tabs, and content */
headerbar.chrome-headerbar,
headerbar.chrome-headerbar:backdrop {

    background-color: @borders;
 
    box-shadow: none;
    margin: 0;
    padding: 0;
}

decoration {
    box-shadow: none;
    margin: 0;
}

.tab-switcher button {
    border: none;
    margin-bottom: -7px;
    padding: 0px 1px;
    border-radius: 5px 5px 0 0;
}

.tab-switcher button:checked {
    
    background: @window_bg_color;

    box-shadow: 0px -0.2px 0.5px rgba(0,0,0,0.5);
}

stack.chrome-body {


}

`;
const cssProvider = new Gtk.CssProvider();
cssProvider.load_from_string(css);
Gtk.StyleContext.add_provider_for_display(
    this.get_display(),
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
);


        // --- Demo Tabs ---
        this._addTab(viewStack);
        this._addTab(viewStack);
        this._addTab(viewStack);
    }

    _addTab(stack) {
        this.tabCounter++;
        const pageName = `page-${this.tabCounter}`;
        const pageTitle = `Tab ${this.tabCounter}`;

        const content = new Adw.StatusPage({
            icon_name: 'tab-new-symbolic',
            title: `This is ${pageTitle}`,
            description: 'Active tab and body are unified in color, Chrome-style.',
        });

        const page = stack.add_titled(content, pageName, pageTitle);
        page.set_icon_name('tab-new-symbolic');
        stack.set_visible_child_name(pageName);
    }
});

const app = new MyApplication();
app.run(null);


