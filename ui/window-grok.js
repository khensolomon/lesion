#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';

const { GObject, Gtk, Gdk } = imports.gi;
const System = imports.system;

// ---------------------------------------------------------------------
// Helper: create a tab widget (Gtk.Button that contains label + close)
function createTabWidget(title = 'New Tab', onSwitch, onClose) {
    const label = new Gtk.Label({
        label: title,
        halign: Gtk.Align.CENTER,
        margin_start: 12,
        margin_end: 8,
        ellipsize: imports.gi.Pango.EllipsizeMode.END,
    });

    const closeBtn = Gtk.Button.new_from_icon_name('window-close-symbolic');
    closeBtn.has_frame = false;
    closeBtn.tooltip_text = 'Close tab';

    const innerBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 0,
    });
    innerBox.append(label);
    innerBox.append(closeBtn); // <-- THIS WAS COMMENTED OUT

    const tabBtn = new Gtk.Button();
    tabBtn.has_frame = false;
    tabBtn.set_child(innerBox);
    tabBtn.get_style_context().add_class('tab-button');

    // Switch page
    tabBtn.connect('clicked', onSwitch);

    // Close – stop propagation so the tab isn’t switched first
    closeBtn.connect('clicked', (btn) => {
        btn.stop_propagation();
        onClose();
    });

    return { tabBtn, label, closeBtn };
}

// ---------------------------------------------------------------------
// Main Application
const FirefoxLikeTabsInHeader = GObject.registerClass({
    GTypeName: 'FirefoxLikeTabsInHeader',
}, class FirefoxLikeTabsInHeader extends Gtk.Application {
    _init() {
        super._init({ application_id: 'org.example.FirefoxLikeTabsInHeader' });
        this.connect('activate', () => this._onActivate());
    }

    _onActivate() {
        if (!this._window) this._buildUI();
        this._window.present();
    }

    _buildUI() {
        // ------------------- Window -------------------
        this._window = new Gtk.Window({
            title: 'Firefox-Like Tabs in Header',
            default_width: 1000,
            default_height: 680,
            // Set a reasonable minimum width for the window
            // min_width: 360, // <--- THIS CAUSES THE CRASH
        });
        this._window.set_application(this);
        // Set minimum size correctly using the method:
        this._window.set_size_request(360, -1); // (width, height) -1 means default

        // ------------------- HeaderBar -------------------
        const header = new Gtk.HeaderBar();
        header.show_title_buttons = true;
        this._window.set_titlebar(header);

        // ------------------- Tab List Popover (for narrow mode) -------------------
        // Moved this definition up so menuBtn can use it.
        this._tabListPopover = new Gtk.Popover();
        this._tabListMenuBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
        });
        this._tabListPopover.set_child(this._tabListMenuBox);

        // Left: Menu button (NOW ALSO THE TAB LIST)
        const menuBtn = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
            popover: this._tabListPopover,
            tooltip_text: 'Menu / Tab List',
        });
        menuBtn.has_frame = false;
        header.pack_start(menuBtn);

        // ------------------- Main Content Area -------------------
        // !!! THIS WAS MISSING !!!
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._notebook = new Gtk.Notebook();
        this._notebook.show_tabs = false; // We are handling tabs in the headerbar
        this._notebook.vexpand = true;

        contentBox.append(this._notebook);
        this._window.set_child(contentBox);

        // ------------------- Tab List Popover (for narrow mode) -------------------
        /* MOVED UP */

        /* REMOVED tabListButton - We are using menuBtn now.
        const tabListButton = new Gtk.MenuButton({
            icon_name: 'view-list-symbolic',
            popover: this._tabListPopover,
            tooltip_text: 'Show Tabs',
        });
        tabListButton.has_frame = false;
        */

        // ------------------- Tab Container (for wide mode) -------------------
        this._tabContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                hexpand: true,
                halign: Gtk.Align.FILL,
        });

        // This was forcing the window to grow. Removing it allows tabs
        // to use their natural width and allows our overflow logic to work.
        // this._tabContainer.homogeneous = true;

        // +++ ADDED ScrolledWindow to hold the tab container +++
        /* REMOVED ScrolledWindow - User does not want scrolling
        const tabScroll = new Gtk.ScrolledWindow();
        tabScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER);
        tabScroll.vexpand = false;
        tabScroll.hexpand = true;
        tabScroll.set_min_content_height(48);
        tabScroll.set_propagate_natural_height(true);
        tabScroll.set_child(this._tabContainer);
        */

        // ------------------- Tab Switcher Stack -------------------
        // This stack holds the main tab bar ('tabs') and the
        // dropdown menu button ('menu'). We switch between them.
        this._tabSwitcherStack = new Gtk.Stack();
        this._tabSwitcherStack.add_named(this._tabContainer, 'tabs');

        // This is the button that REPLACES the tab bar when narrow
        const tabOverflowButton = new Gtk.MenuButton({
            icon_name: 'view-list-symbolic',
            popover: this._tabListPopover, // Use the SAME popover as the main menu
            tooltip_text: 'Show Tabs',
            hexpand: true, // Allow it to center
            halign: Gtk.Align.CENTER,
        });
        tabOverflowButton.has_frame = false;
        this._tabSwitcherStack.add_named(tabOverflowButton, 'menu');
        this._tabSwitcherStack.set_visible_child_name('tabs');

        // Center the ScrolledWindow containing the tabs
        // header.set_title_widget(tabScroll);
        // Center the Stack containing the tabs OR the menu button
        header.set_title_widget(this._tabSwitcherStack);


        // Right: New-tab button
        const newTabBtn = Gtk.Button.new_from_icon_name('tab-new-symbolic');
        newTabBtn.has_frame = false;
        newTabBtn.tooltip_text = 'New Tab (Ctrl+T)';
        header.pack_end(newTabBtn);

        // ------------------- CSS – Firefox look -------------------
        const cssProvider = new Gtk.CssProvider();
const css = `
window {
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    headerbar {
        min-height: 48px;
        padding: 0 8px;
        border-bottom: none;
        box-shadow: none;

        background: alpha(@theme_fg_color, 0.1);
        border-radius: 12px 12px 0 0;
    }

    headerbar button.image-button {
        padding: 8px;
        margin: 0 4px;
        min-width: 32px;
        min-height: 32px;
    }

    /* TAB BUTTON: Flexible width */
    headerbar button.tab-button {
        min-width: 50px;           /* ← MIN WIDTH */
        max-width: 200px;           /* ← MAX WIDTH */
        /* width: 50px; */         /* ← REMOVED to allow flex */
        padding: 0;
        margin: 4px 1px 0 1px;
        border-radius: 8px 8px 0 0;
        background: transparent;
        transition: all 150ms ease;
        overflow: hidden;
        ellipsize: end;
    }

    headerbar button.tab-button:hover {
        background: alpha(@theme_fg_color, 0.08);
    }

    headerbar button.tab-button.active {
        background: @theme_bg_color;
        color: @theme_fg_color;
        border-bottom: 0px solid @accent_color;
        font-weight: 600;
    }

    headerbar button.tab-button label {
        margin: 0 8px;
        font-size: 0.9em;
        ellipsize: end;             /* ← Truncate long titles */
    }

    /* Force content bg */
    notebook, notebook > stack {
        background: @theme_bg_color;
    }

    /* Style for the active item in the popover menu */
    popover.background {
        background: @theme_bg_color;
    }
    popover.background .button.active {
        font-weight: 600;
        color: @accent_color;
    }
`.trim();

        cssProvider.load_from_data(css, css.length);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // ------------------- Interactions -------------------
        newTabBtn.connect('clicked', () => {
            const n = this._tabContainer.get_first_child() ? this._countTabs() + 1 : 1;
            this._addTab(`Tab ${n}`);
        });

        // Ctrl+T
        const ctrl = new Gtk.EventControllerKey();
        ctrl.connect('key-pressed', (_, keyval, __, state) => {
            if (keyval === Gdk.KEY_t && (state & Gdk.ModifierType.CONTROL_MASK)) {
                const n = this._tabContainer.get_first_child() ? this._countTabs() + 1 : 1;
                this._addTab(`Tab ${n}`);
                return true;
            }
            return false;
        });
        this._window.add_controller(ctrl);

        // Listen for resize events on the WINDOW itself.
        // Let's try the property notification signal for allocated-width.
        // this._window.connect('size-allocate', this._onWindowConfigure.bind(this));
        // this._window.connect('notify::allocated-width', this._onWindowConfigure.bind(this)); // REMOVED - Function is no longer used
        // RE-ADDED: Listen for size changes on the stack itself
        this._tabSwitcherStack.connect('notify::allocated-width', this._onWindowConfigure.bind(this));


        // Initial tab
        this._addTab('Home');
    }

    // -----------------------------------------------------------------
    // REMOVED _onWindowConfigure - No longer switching views.
    // RE-ADDED _onWindowConfigure
    // Check window size and swap tab bar for menu if needed
    _onWindowConfigure() {
        if (!this._tabContainer || !this._tabSwitcherStack) return;

        // Get the space the stack HAS
        const allocated_width = this._tabSwitcherStack.get_allocated_width();
        // Get the space the tab container WANTS
        const [min_width, natural_width] = this._tabContainer.get_preferred_size();

        // log(`Configure: Allocated: ${allocated_width}, Natural: ${natural_width}`);

        // Only switch if the allocated width is positive (window is visible)
        // and smaller than the naturally requested width.
        if (allocated_width > 0 && allocated_width < natural_width) {
            // Not enough space: show the 'menu' button
            if (this._tabSwitcherStack.visible_child_name !== 'menu') {
                // log('--> Switching to MENU');
                this._tabSwitcherStack.set_visible_child_name('menu');
            }
        } else {
            // Enough space: show the 'tabs' bar
            if (this._tabSwitcherStack.visible_child_name !== 'tabs') {
                // log('--> Switching to TABS');
                this._tabSwitcherStack.set_visible_child_name('tabs');
            }
        }
    }
    // -----------------------------------------------------------------
    // Count tabs – works because Gtk.Box implements Gtk.Widget list methods
    _countTabs() {
        let count = 0;
        let child = this._tabContainer.get_first_child();
        while (child) {
            count++;
            child = child.get_next_sibling();
        }
        return count;
    }

    // -----------------------------------------------------------------
    _addTab(title) {
        // ----- content page -----
        const content = new Gtk.Label({
            label: `<big>${title}</big>\n\nThis is the content area.\nDrop any widget here.`,
            use_markup: true,
            vexpand: true,
            hexpand: true,
            margin_top: 20,
            margin_start: 20,
            margin_end: 20,
            margin_bottom: 20,
        });
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_child(content);
        const idx = this._notebook.append_page(scrolled, null);

        // ----- tab list menu item (for narrow mode) -----
        const menuItemButton = new Gtk.Button({
            label: title,
            halign: Gtk.Align.START,
        });
        menuItemButton.has_frame = false;


        // ----- tab widget (for wide mode) -----
        const tab = createTabWidget(title,
            () => { // onSwitch
                this._notebook.set_current_page(idx);
                this._updateActiveTab();
                // Get the title from the tab's label
                const currentTitle = tab.label.get_label();
                this._window.title = `${currentTitle} — Firefox-Like`;
            },
            () => { // onClose
                this._notebook.remove_page(idx);
                tab.tabBtn.destroy();
                menuItemButton.destroy(); // Remove from popover list
                if (this._notebook.n_pages === 0) Gtk.main_quit();
                this._updateActiveTab();
                // Re-check if we need to switch view
                // this._onWindowConfigure(); // REMOVED
                this._onWindowConfigure(); // RE-ADDED
            }
        );

        // ----- Connect menu item click -----
        menuItemButton.connect('clicked', () => {
            this._notebook.set_current_page(idx);
            this._updateActiveTab();
            // Get the title from the tab's label
            const currentTitle = tab.label.get_label();
            this._window.title = `${currentTitle} — Firefox-Like`;
            // Close the popover
            this._tabListPopover.popdown();
        });

        // Add the buttons to their respective containers
        this._tabListMenuBox.append(menuItemButton);
        this._tabContainer.append(tab.tabBtn);

        // Set new tab as active
        this._notebook.set_current_page(idx);
        this._updateActiveTab();
        this._window.title = `${title} — Firefox-Like`;
        
        // Re-check if we need to switch view after adding a tab
        // this._onWindowConfigure(); // REMOVED
        this._onWindowConfigure(); // RE-ADDED
    }

    // -----------------------------------------------------------------
    _updateActiveTab() {
        const cur = this._notebook.get_current_page();

        // Update main tab bar
        let child = this._tabContainer.get_first_child();
        let i = 0;
        while (child) {
            const ctx = child.get_style_context();
            if (i === cur) ctx.add_class('active');
            else ctx.remove_class('active');
            child = child.get_next_sibling();
            i++;
        }

        // Update tab list menu (in the popover)
        let listChild = this._tabListMenuBox.get_first_child();
        let j = 0;
        while (listChild) {
            const ctx = listChild.get_style_context();
            if (j === cur) ctx.add_class('active');
            else ctx.remove_class('active');
            listChild = listChild.get_next_sibling();
            j++;
        }
    }
});

// ---------------------------------------------------------------------
// Run
(new FirefoxLikeTabsInHeader()).run([System.programPath, ...ARGV]);







