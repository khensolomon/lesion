// gjs chrome_tabs_final_fixed.js
imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';
const { GObject, Gio, Gtk, Adw, GLib } = imports.gi;

var MyApplication = GObject.registerClass(
class MyApplication extends Adw.Application {
    _init() {
        super._init({
            application_id: 'org.example.ChromeTabsCompact',
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });
        this.connect('activate', this._onActivate.bind(this));
    }

    _onActivate() {
        if (!this.window)
            this.window = new MyWindow({ application: this });
        this.window.present();
    }
});

var MyWindow = GObject.registerClass(
class MyWindow extends Adw.ApplicationWindow {
    _init(params) {
        super._init(params);
        this.tabCounter = 0;
        this._tabs = [];
        this._currentActions = [];

        this.set_default_size(1000, 650);
        this.set_title("Chrome Tabs - Compact Mode");

        // === Content stack ===
        this._viewStack = new Adw.ViewStack();
        this._viewStack.add_css_class('chrome-body');

        // === Tab bar ===
        this._tabBar = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 2,
            halign: Gtk.Align.START,
        });

        // === Overflow menu ===
        this._overflowButton = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
            tooltip_text: 'More tabs',
        });
        this._overflowMenu = new Gtk.PopoverMenu();
        this._overflowButton.set_popover(this._overflowMenu);

        // === HeaderBar ===
        const headerBar = new Adw.HeaderBar();
        headerBar.pack_start(this._overflowButton);
        headerBar.pack_start(this._tabBar);

        const newTabButton = new Gtk.Button({ icon_name: 'list-add-symbolic' });
        newTabButton.connect('clicked', () => this._addTab());
        headerBar.pack_end(newTabButton);
        headerBar.add_css_class('chrome-headerbar');

        // === Layout ===
        const mainBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
        mainBox.add_css_class('chrome-main');
        mainBox.append(headerBar);
        mainBox.append(this._viewStack);
        this.set_content(mainBox);

        // === CSS ===
        const css = `
box.chrome-main > stack.chrome-body {
    border-radius: 8px;
}

/* Header styling */
headerbar.chrome-headerbar,
headerbar.chrome-headerbar:backdrop {
    background-color: @borders;
    box-shadow: none;
    margin: 0;
    padding: 0;
}

/* Normal tab */
.toggle-tab {
    border: none;
    border-radius: 5px 5px 0 0;
    padding: 0 8px;
}

/* Active tab */
.toggle-tab:checked {
    background: @window_bg_color;
    box-shadow: 0px -0.2px 0.5px rgba(0,0,0,0.5);
}

/* Compact mode tab (icon-only) */
.toggle-tab.compact-tab {
    min-width: 40px;
    padding: 0 4px;
    font-size: 0; /* hide label text */
}
.toggle-tab.compact-tab image {
    margin: 0;
}
.toggle-tab.compact-tab:checked {
    background: @view_bg_color;
}
`;
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_string(css);
        Gtk.StyleContext.add_provider_for_display(
            this.get_display(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // === Add initial tabs ===
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._addTab();
            this._addTab();
            this._addTab();
            this._updateTabs(this.get_allocated_width());
            return GLib.SOURCE_REMOVE;
        });
    }

    vfunc_size_allocate(allocation, baseline, orientation) {
        super.vfunc_size_allocate(allocation, baseline, orientation);
        this._updateTabs(allocation.width);
    }

    _addTab() {
        this.tabCounter++;
        const pageName = `page-${this.tabCounter}`;
        const pageTitle = `Tab ${this.tabCounter}`;

        const page = new Adw.StatusPage({
            icon_name: 'tab-new-symbolic',
            title: `This is ${pageTitle}`,
            description: 'Active tab and body are unified in color, Chrome-style.',
        });
        this._viewStack.add_titled(page, pageName, pageTitle);

        // Tab button (icon + label)
        const icon = new Gtk.Image({ icon_name: 'tab-new-symbolic' });
        const label = new Gtk.Label({ label: pageTitle });
        const box = new Gtk.Box({ spacing: 4 });
        box.append(icon);
        box.append(label);

        const btn = new Gtk.ToggleButton();
        btn.set_child(box);
        btn.add_css_class('toggle-tab');
        btn.connect('clicked', () => {
            this._viewStack.set_visible_child(page);
            this._tabs.forEach(t => t.button.set_active(t.button === btn));
        });

        this._tabBar.append(btn);
        this._tabs.push({ button: btn, page, title: pageTitle, label });

        btn.set_active(true);
        this._viewStack.set_visible_child(page);
        this._updateTabs(this.get_allocated_width());
    }

    _updateTabs(windowWidth) {
        if (!this._tabBar.get_allocated_width()) return;

        const minTabWidth = 80;
        const spacing = 2;
        const tabBarWidth = this._tabBar.get_allocated_width();
        const overflowWidth = this._overflowButton.get_allocated_width() || 30;
        const availableWidth = tabBarWidth - overflowWidth;
        if (availableWidth <= 0) return;

        // Reset tab visibility
        this._tabs.forEach(t => {
            t.button.show();
            t.button.set_size_request(-1, -1);
        });

        // Measure total width
        let totalWidth = 0;
        for (let t of this._tabs) {
            let [min, nat] = t.button.measure(Gtk.Orientation.HORIZONTAL, -1);
            totalWidth += nat + spacing;
        }

        // Shrink tabs if needed
        if (totalWidth > availableWidth) {
            const tabWidth = Math.max(
                minTabWidth,
                Math.floor((availableWidth - spacing * this._tabs.length) / this._tabs.length)
            );
            this._tabs.forEach(t => t.button.set_size_request(tabWidth, -1));
        }

        // Hide overflowing tabs
        totalWidth = 0;
        const hiddenTabs = [];
        this._tabs.forEach(t => {
            let [min, nat] = t.button.measure(Gtk.Orientation.HORIZONTAL, -1);
            totalWidth += nat + spacing;
            if (totalWidth > availableWidth) {
                t.button.hide();
                hiddenTabs.push(t);
            }
        });

        // === Build overflow menu ===
        const menuModel = new Gio.Menu();
        hiddenTabs.forEach((t, index) => {
            const actionName = `open_tab_${index}`;
            const item = Gio.MenuItem.new(t.title.toString(), `win.${actionName}`);
            menuModel.append_item(item);
        });
        this._overflowMenu.set_menu_model(menuModel);

        // === Remove old tab actions ===
        for (let actName of this._currentActions) {
            const act = this.lookup_action(actName);
            if (act) this.remove_action(act);
        }
        this._currentActions = [];

        // === Add new tab actions ===
        hiddenTabs.forEach((t, index) => {
            const actName = `open_tab_${index}`;
            const action = new Gio.SimpleAction({ name: actName });
            action.connect('activate', () => {
                this._viewStack.set_visible_child(t.page);
                t.button.set_active(true);
            });
            this.add_action(action);
            this._currentActions.push(actName);
        });

        // === Compact mode ===
        this._tabs.forEach(t => {
            let width = t.button.get_allocated_width();
            if (width > 0 && width < 90) {
                t.button.add_css_class('compact-tab');
                t.label.hide();
            } else {
                t.button.remove_css_class('compact-tab');
                t.label.show();
            }
        });

        // Hide tab bar entirely if window is too small
        if (windowWidth < 450) this._tabBar.hide();
        else this._tabBar.show();
    }
});

const app = new MyApplication();
app.run(null);
