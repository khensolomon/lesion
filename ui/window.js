const Adw = imports.gi.Adw;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const System = imports.system;

// --- Make imports reliable for all modules ---
const SCRIPT_DIR = GLib.path_get_dirname(System.programInvocationName);
const PAGES_DIR = GLib.build_filenamev([SCRIPT_DIR, 'pages']);
imports.searchPath.unshift(SCRIPT_DIR);
imports.searchPath.unshift(PAGES_DIR);

// --- Import our custom modules ---
const { pageRegistration } = imports.pageRegistration;
const { SizeConfiguration, StyleConfiguration } = imports.config;


// --- The Application Shell Window ---
const ExampleWindow = GObject.registerClass({
    GTypeName: 'ExampleWindow',
}, class ExampleWindow extends Adw.ApplicationWindow {

    _init(kwargs) {
        super._init(kwargs);

        this.sizeConfig = new SizeConfiguration();
        this.styleConfig = new StyleConfiguration();
        this.set_default_size(1000, 700);
        this._currentPageTitle = ''; // To store the current subtitle

        this.flap = new Adw.Flap({
            fold_policy: Adw.FlapFoldPolicy.AUTO,
            locked: true,
        });
        this.set_content(this.flap);
        
        this.sidebarBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        this.sidebarBox.set_size_request(this.sizeConfig.SIDEBAR_INITIAL_WIDTH, -1);
        this.sidebarBox.add_css_class('sidebar');
        
        const sidebarHeader = new Adw.HeaderBar({ show_end_title_buttons: false });
        sidebarHeader.add_css_class('flat');
        this.sidebarBox.append(sidebarHeader);

        const menuListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['navigation-sidebar'],
        });
        this.sidebarBox.append(menuListBox);

        const mainBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true });
        mainBox.add_css_class('main-content');
        
        this.mainHeader = new Adw.HeaderBar({ css_classes: ['flat'] });
        const toggleButton = new Gtk.ToggleButton({ icon_name: 'open-menu-symbolic', active: true });
        this.mainHeader.pack_start(toggleButton);

        this.windowTitle = new Adw.WindowTitle({ title: 'My App' });
        this.mainHeader.set_title_widget(this.windowTitle);
        mainBox.append(this.mainHeader);

        const viewStack = new Adw.ViewStack();
        mainBox.append(viewStack);
        
        this.flap.set_flap(this.sidebarBox);
        this.flap.set_content(mainBox);

        this.populateShell(pageRegistration, menuListBox, viewStack);

        this.flap.bind_property('reveal-flap', toggleButton, 'active', GObject.BindingFlags.BIDIRECTIONAL);
        this.flap.connect('notify::folded', this._onFlapFolded.bind(this));
        
        menuListBox.connect('row-activated', (box, row) => {
            const pageName = row.get_name();
            if (pageName) {
                viewStack.set_visible_child_name(pageName);
                
                const pageData = pageRegistration.find(p => p.name === pageName);
                if (pageData) {
                    const newTitle = pageData.title || '';
                    this.windowTitle.set_subtitle(newTitle);
                    this._currentPageTitle = newTitle; // Store the title
                }

                if (this.flap.get_folded()) {
                    this.flap.set_reveal_flap(false);
                }
            }
        });

        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data(this.styleConfig.CSS, -1);
        Gtk.StyleContext.add_provider_for_display(this.get_display(), cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    populateShell(registration, listBox, viewStack) {
        const rowMap = new Map();

        for (const item of registration) {
            try {
                if (item.type === 'group') {
                    const groupRow = new Gtk.ListBoxRow({
                        selectable: false,
                        activatable: false,
                    });

                    const groupLabel = new Gtk.Label({
                        label: item.title,
                        xalign: 0,
                        css_classes: ['menu-group-title'],
                        can_target: false,
                    });
                    
                    groupRow.set_child(groupLabel);
                    listBox.append(groupRow);

                } else if (item.type === 'page') {
                    const row = new Gtk.ListBoxRow({ name: item.name, css_classes: ['list-row'] });
                    const rowBox = new Gtk.Box({ spacing: 12 });
                    rowBox.append(new Gtk.Image({ icon_name: item.icon }));
                    rowBox.append(new Gtk.Label({ label: item.title, xalign: 0 }));
                    row.set_child(rowBox);

                    rowMap.set(item.name, row);
                    listBox.append(row);
                    
                    if (!item.content) throw new Error("Content class is missing.");
                    const contentWidget = new item.content();
                    viewStack.add_named(contentWidget, item.name);
                }
            } catch (e) {
                console.error(`Failed to load page: ${item.title || 'Unknown'}`, e);
            }
        }

        const firstPage = registration.find(p => p.type === 'page');
        if (firstPage) {
            viewStack.set_visible_child_name(firstPage.name);
            const firstRow = rowMap.get(firstPage.name);
            if (firstRow) {
                listBox.select_row(firstRow);
            }
            this.windowTitle.set_subtitle(firstPage.title);
            this._currentPageTitle = firstPage.title; // Store the initial title
        }
    }

    vfunc_size_allocate(width, height, baseline) {
        super.vfunc_size_allocate(width, height, baseline);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            // First, handle the responsive title logic
            if (width > this.sizeConfig.TITLE_COLLAPSE_THRESHOLD) {
                this.windowTitle.set_title('My App');
                this.windowTitle.set_subtitle(this._currentPageTitle);
            } else if (width > this.sizeConfig.TITLE_COLLAPSE_THRESHOLD_ULTRA) {
                this.windowTitle.set_title('My App');
                this.windowTitle.set_subtitle('');
            } else {
                this.windowTitle.set_title('');
                this.windowTitle.set_subtitle('');
            }

            // Next, handle the sidebar resizing logic
            if (this.flap && !this.flap.get_folded()) {
                // --- NEW --- If the setting is true, force the menu to show
                if (this.sizeConfig.showBasedOnWindowWidth) {
                    this.flap.set_reveal_flap(true);
                }
                // Apply proportional resizing
                let targetWidth = width * this.sizeConfig.SIDEBAR_PROPORTION;
                const newSidebarWidth = Math.max(this.sizeConfig.SIDEBAR_MIN_WIDTH, Math.min(this.sizeConfig.SIDEBAR_MAX_WIDTH, targetWidth));
                this.sidebarBox.set_size_request(Math.round(newSidebarWidth), -1);

            } else if (this.flap) {
                // This handles the overlay width when the menu is folded
                let newOverlayWidth;
                if (width <= this.sizeConfig.SIDEBAR_MAX_WIDTH) {
                    newOverlayWidth = width - this.sizeConfig.OVERLAY_MARGIN;
                } else {
                    newOverlayWidth = this.sizeConfig.SIDEBAR_MAX_WIDTH;
                }
                this.sidebarBox.set_size_request(Math.round(newOverlayWidth), -1);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _onFlapFolded() {
        if (this.flap.get_folded()) {
            this.sidebarBox.add_css_class('overlay-visible');
        } else {
            this.sidebarBox.remove_css_class('overlay-visible');
        }
    }
});


const MyApp = GObject.registerClass({ GTypeName: 'MyApp' },
    class MyApp extends Adw.Application {
        constructor() {
            super({ application_id: 'com.example.ShellApp', flags: Gio.ApplicationFlags.FLAGS_NONE });
            this.window = null;
        }
        vfunc_activate() {
            this.window = new ExampleWindow({ application: this });
            this.window.present();
        }
    }
);

const app = new MyApp();
app.run(null);

