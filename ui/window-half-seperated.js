const Adw = imports.gi.Adw;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

// Define the Window class using the correct Libadwaita pattern
const ExampleWindow = GObject.registerClass({
    GTypeName: 'ExampleWindow',
}, class ExampleWindow extends Adw.ApplicationWindow {

    _init(kwargs) {
        super._init(kwargs);

        this.set_default_size(1000, 700);

        // --- Create Main Layout Widget ---
        // Adw.ToolbarView is the correct container for a headerbar and content
        const toolbarView = new Adw.ToolbarView();

        // The window's main content is the ToolbarView
        this.set_content(toolbarView);


        // --- Create Other Widgets ---
        const flap = new Adw.Flap();
        flap.set_fold_policy(Adw.FlapFoldPolicy.AUTO);

        const toggleButton = new Gtk.ToggleButton({
            icon_name: 'open-menu-symbolic',
            active: true,
        });

        const headerBar = new Adw.HeaderBar();
        const windowTitle = new Adw.WindowTitle({
            title: 'My App',
            subtitle: 'GNOME UI (Corrected)',
        });
        headerBar.set_title_widget(windowTitle);
        headerBar.pack_start(toggleButton);

        const sidebarBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            width_request: 280,
        });
        sidebarBox.add_css_class('sidebar');
        const menuLabel = new Gtk.Label({
            label: 'Menu',
            halign: Gtk.Align.START,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        menuLabel.add_css_class('title-2');
        sidebarBox.append(menuLabel);

        const mainContentLabel = new Gtk.Label({
            label: 'Main Content Area',
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            vexpand: true,
        });
        mainContentLabel.add_css_class('title-1');


        // --- Assemble the UI ---

        // Add the HeaderBar to the top of the ToolbarView
        toolbarView.add_top_bar(headerBar);
        // Set the Flap as the main content of the ToolbarView
        toolbarView.set_content(flap);

        flap.set_flap(sidebarBox);
        flap.set_content(mainContentLabel);


        // --- Connect Logic ---
        toggleButton.bind_property('active', flap, 'reveal-flap', GObject.BindingFlags.BIDIRECTIONAL);
    }
});


// --- Application Boilerplate (Unchanged) ---
const MyApp = GObject.registerClass({
    GTypeName: 'MyApp',
}, class MyApp extends Adw.Application {
    constructor() {
        super({
            application_id: 'com.example.MyApp.CodeOnly',
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });
        this.window = null;
    }

    vfunc_activate() {
        this.window = new ExampleWindow({ application: this });
        this.window.present();
    }
});

const app = new MyApp();
app.run(null);

