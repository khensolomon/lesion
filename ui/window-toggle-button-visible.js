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
        // Store flap and sidebarBox as instance properties to access them later
        this.flap = new Adw.Flap();
        this.set_content(this.flap);

        // --- Restore AUTO policy to enable native overlay behavior ---
        this.flap.set_fold_policy(Adw.FlapFoldPolicy.AUTO);
        // Lock the flap so the user cannot drag it.
        this.flap.set_locked(true);
        
        // --- 1. Build the Sidebar (Flap) Content ---
        this.sidebarBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        // Set the initial size using the correct GTK4 method
        this.sidebarBox.set_size_request(250, -1);
        this.sidebarBox.add_css_class('sidebar');

        const sidebarHeader = new Adw.HeaderBar({
            show_end_title_buttons: false,
        });
        sidebarHeader.add_css_class('flat');
        this.sidebarBox.append(sidebarHeader);

        const menuLabel = new Gtk.Label({
            label: 'Menu',
            halign: Gtk.Align.START,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        menuLabel.add_css_class('title-2');
        this.sidebarBox.append(menuLabel);


        // --- 2. Build the Main Content Area ---
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true, // This is crucial for the content to fill the space
        });
        mainBox.add_css_class('main-content');

        const mainHeader = new Adw.HeaderBar();
        mainHeader.add_css_class('flat');

        const toggleButton = new Gtk.ToggleButton({
            icon_name: 'open-menu-symbolic',
            active: true, // Start in the 'active' state to match the flap
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
        this.flap.set_flap(this.sidebarBox);
        this.flap.set_content(mainBox);


        // --- Connect Logic ---
        // Restore the two-way binding. This is the correct way to sync the button
        // and the flap, and it works perfectly with the AUTO fold policy.
        this.flap.bind_property('reveal-flap', toggleButton, 'active', GObject.BindingFlags.BIDIRECTIONAL);


        // --- Apply Custom Styling ---
        const cssProvider = new Gtk.CssProvider();
        const css = `
            flap > .separator {
                border-right: 1px solid @borders;
            }
            /* Use the slightly off-white headerbar color for the sidebar */
            .sidebar {
                background-color: @headerbar_bg_color;
            }
            /* Use the fully opaque window background for the main content */
            .main-content {
                background-color: @window_bg_color;
            }
        `;
        cssProvider.load_from_data(css, -1);
        Gtk.StyleContext.add_provider_for_display(
            this.get_display(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    // This method is called by GTK whenever the window size changes.
    vfunc_size_allocate(width, height, baseline) {
        // Always call the parent's implementation first.
        super.vfunc_size_allocate(width, height, baseline);

        // --- Custom Proportional Resizing Logic ---
        const SIDEBAR_MIN_WIDTH = 180;
        const SIDEBAR_MAX_WIDTH = 250;
        
        if (!this.flap.get_folded()) {
            // This logic runs when the sidebar is visible side-by-side.
            let targetWidth = width * 0.28;
            const newSidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, targetWidth));
            this.sidebarBox.set_size_request(Math.round(newSidebarWidth), -1);
        } else {
            // This logic runs when the sidebar is FOLDED (acting as an overlay).
            let newOverlayWidth;
            if (width <= SIDEBAR_MAX_WIDTH) {
                // If the window is very narrow, make the overlay almost full-width.
                newOverlayWidth = width - 10;
            } else {
                // Otherwise, cap the overlay width at its maximum.
                newOverlayWidth = SIDEBAR_MAX_WIDTH;
            }
            this.sidebarBox.set_size_request(Math.round(newOverlayWidth), -1);
        }
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

