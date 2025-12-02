const Adw = imports.gi.Adw;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib; // Added GLib for file operations

// --- A custom class to hold all layout configuration values ---
const SizeConfiguration = class {
    constructor() {
        this.SIDEBAR_MIN_WIDTH = 180;
        this.SIDEBAR_MAX_WIDTH = 250;
        this.SIDEBAR_INITIAL_WIDTH = 250;
        this.SIDEBAR_PROPORTION = 0.28; // Represents 28% of the window width
        this.WINDOW_MIN_WIDTH_OFFSET = 120;
        this.OVERLAY_MARGIN = 10;
    }
};

// --- A custom class to hold all styling information ---
const StyleConfiguration = class {
    constructor() {
        // This property can now be initially empty if you move all styles to the file.
        this.CSS = '';

        // --- Load and merge external CSS file ---
        try {
            // Construct the path relative to where the script is run
            const cssPath = GLib.build_filenamev([GLib.get_current_dir(), 'ui', 'window.css']);
            const cssFile = Gio.File.new_for_path(cssPath);

            if (cssFile.query_exists(null)) {
                const [ok, contents] = cssFile.load_contents(null);
                if (ok) {
                    const decoder = new TextDecoder('utf-8');
                    const externalCss = decoder.decode(contents);
                    // Append the file's content to the existing CSS
                    this.CSS += '\n' + externalCss;
                }
            }
        } catch (e) {
            logError(e, 'Could not load external CSS file.');
        }
    }
};

// Define the Window class using the correct Libadwaita pattern
const ExampleWindow = GObject.registerClass({
    GTypeName: 'ExampleWindow',
}, class ExampleWindow extends Adw.ApplicationWindow {

    _init(kwargs) {
        super._init(kwargs);

        // Create instances of the configuration classes for this window
        this.sizeConfig = new SizeConfiguration();
        this.styleConfig = new StyleConfiguration();

        this.set_default_size(1000, 700);

        // Set the window's minimum width constraint using the config object.
        this.set_size_request(this.sizeConfig.SIDEBAR_MAX_WIDTH + this.sizeConfig.WINDOW_MIN_WIDTH_OFFSET, -1);

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
        // Set the initial size using the config object
        this.sidebarBox.set_size_request(this.sizeConfig.SIDEBAR_INITIAL_WIDTH, -1);
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

        // Connect to the 'folded' property to dynamically apply a CSS class
        this.flap.connect('notify::folded', this._onFlapFolded.bind(this));


        // --- Apply Custom Styling ---
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data(this.styleConfig.CSS, -1);
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
        
        if (!this.flap.get_folded()) {
            // This logic runs when the sidebar is visible side-by-side.
            let targetWidth = width * this.sizeConfig.SIDEBAR_PROPORTION;
            const newSidebarWidth = Math.max(this.sizeConfig.SIDEBAR_MIN_WIDTH, Math.min(this.sizeConfig.SIDEBAR_MAX_WIDTH, targetWidth));
            this.sidebarBox.set_size_request(Math.round(newSidebarWidth), -1);
        } else {
            // This logic runs when the sidebar is FOLDED (acting as an overlay).
            let newOverlayWidth;
            if (width <= this.sizeConfig.SIDEBAR_MAX_WIDTH) {
                // If the window is very narrow, make the overlay almost full-width.
                newOverlayWidth = width - this.sizeConfig.OVERLAY_MARGIN;
            } else {
                // Otherwise, cap the overlay width at its maximum.
                newOverlayWidth = this.sizeConfig.SIDEBAR_MAX_WIDTH;
            }
            this.sidebarBox.set_size_request(Math.round(newOverlayWidth), -1);
        }
    }

    _onFlapFolded() {
        // This function is called whenever the flap transitions between folded/unfolded.
        if (this.flap.get_folded()) {
            // Add the CSS class when the sidebar becomes an overlay.
            this.sidebarBox.add_css_class('overlay-visible');
        } else {
            // Remove it when the sidebar is side-by-side.
            this.sidebarBox.remove_css_class('overlay-visible');
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

