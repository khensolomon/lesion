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
        // Adw.Flap is now the direct content of the window to create the split view
        const flap = new Adw.Flap();
        this.set_content(flap);
        flap.set_fold_policy(Adw.FlapFoldPolicy.AUTO);

        // --- 1. Build the Sidebar (Flap) Content ---
        const sidebarBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            width_request: 280,
        });
        // Add a CSS class to target the sidebar for styling
        sidebarBox.add_css_class('sidebar');

        // The sidebar gets its own header, without window controls
        const sidebarHeader = new Adw.HeaderBar({
            show_end_title_buttons: false,
        });
        sidebarHeader.add_css_class('flat');
        sidebarBox.append(sidebarHeader);

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


        // --- 2. Build the Main Content Area ---
        const mainBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        // The main content gets its own header, which will hold window controls
        const mainHeader = new Adw.HeaderBar();
        mainHeader.add_css_class('flat');

        const toggleButton = new Gtk.ToggleButton({
            icon_name: 'open-menu-symbolic',
            active: true,
        });
        mainHeader.pack_start(toggleButton);

        const windowTitle = new Adw.WindowTitle({
            title: 'My App',
            subtitle: 'GNOME UI (Split Header)',
        });
        mainHeader.set_title_widget(windowTitle);
        mainBox.append(mainHeader);

        const mainContentLabel = new Gtk.Label({
            label: 'Main Content Area',
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            vexpand: true,
        });
        mainContentLabel.add_css_class('title-1');
        mainBox.append(mainContentLabel);


        // --- Assemble the Flap ---
        flap.set_flap(sidebarBox);
        flap.set_content(mainBox);


        // --- Connect Logic ---
        toggleButton.bind_property('active', flap, 'reveal-flap', GObject.BindingFlags.BIDIRECTIONAL);

        // --- Apply Custom Styling ---
        const cssProvider = new Gtk.CssProvider();
        const css = `
            /* Add a visible border to the flap's separator */
            flap > .separator {
                border-right: 1px solid @borders;
            }

            /* Give the sidebar a distinct background color */
            .sidebar {
                background-color: @headerbar_bg_color;
            }
        `;
        // The -1 argument is deprecated, but GJS doesn't have an alternative.
        cssProvider.load_from_data(css, -1); 
        Gtk.StyleContext.add_provider_for_display(
            this.get_display(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
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

