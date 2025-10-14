import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

// Import the page builders from their new modules
import { buildThemesPage } from './shell-theme.js';
import { buildExtensionsPage } from './shell-extension.js';
import { buildAboutPage } from './shell-about.js';

export class ThemeManagerUIShell {
    constructor(app) {
        this.app = app;
        this.window = null;
    }

    build() {
        const win = new Adw.ApplicationWindow({
            application: this.app,
            default_width: 800,
            default_height: 650,
        });
        win.set_title(this.app.metadata.name);

        const contentStack = new Adw.ViewStack({ vexpand: true });
        const contentHeader = new Adw.HeaderBar({ css_classes: ['flat'] });
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        contentBox.append(contentHeader);
        contentBox.append(contentStack);

        const sidebar = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['navigation-sidebar'],
            vexpand: true,
        });
        const sidebarHeader = new Adw.HeaderBar({
             title_widget: new Adw.WindowTitle({ title: 'Menu' }),
             css_classes: ['flat'],
        });
        const sidebarBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        sidebarBox.append(sidebarHeader);
        sidebarBox.append(new Gtk.ScrolledWindow({ child: sidebar, hscrollbar_policy: Gtk.PolicyType.NEVER }));

        const splitView = new Adw.NavigationSplitView({
            sidebar: new Adw.NavigationPage({ title: 'Menu', child: sidebarBox }),
            content: new Adw.NavigationPage({ title: 'Content', child: contentBox }),
            min_sidebar_width: 180,
            max_sidebar_width: 240,
        });
        
        const sidebarButton = new Gtk.ToggleButton({ icon_name: 'view-list-symbolic' });
        splitView.bind_property('collapsed', sidebarButton, 'visible', GObject.BindingFlags.DEFAULT);

        sidebarButton.connect('toggled', () => {
            splitView.show_sidebar = sidebarButton.active;
        });
        splitView.connect('notify::collapsed', () => {
            if (!splitView.collapsed) {
                 sidebarButton.active = false;
            }
        });

        contentHeader.pack_start(sidebarButton);
        
        const titleWidget = new Adw.WindowTitle({ title: '' });
        const titleBox = new Gtk.Box({ hexpand: true, halign: Gtk.Align.START });
        titleBox.append(titleWidget);
        contentHeader.set_title_widget(titleBox);
        
        const pages = [
            { name: 'themes', title: 'Themes', icon: 'preferences-desktop-theme-symbolic', page: buildThemesPage(this.app.settings.settings) },
            { name: 'extensions', title: 'Extensions', icon: 'application-x-addon-symbolic', page: buildExtensionsPage(this.app.settings.settings) },
            { name: 'about', title: 'About', icon: 'help-about-symbolic', page: buildAboutPage(this.app) },
        ];

        for (const page of pages) {
            contentStack.add_titled_with_icon(page.page, page.name, page.title, page.icon);
            const row = new Adw.ActionRow({ title: page.title, activatable: true });
            row.set_name(page.name);
            row.add_prefix(new Gtk.Image({ icon_name: page.icon, pixel_size: 16 }));
            sidebar.append(row);
        }

        sidebar.connect('row-selected', (box, row) => {
            if (row) {
                const name = row.get_name();
                contentStack.set_visible_child_name(name);
                titleWidget.set_title(row.get_title());
            }
        });
        
        const firstRow = sidebar.get_row_at_index(0);
        if (firstRow) {
            sidebar.select_row(firstRow);
            titleWidget.set_title(firstRow.get_title());
        }
        
        win.set_content(splitView);
        this.window = win;
    }

    present() {
        if (!this.window) {
            this.build();
        }
        this.window.present();
    }
}

