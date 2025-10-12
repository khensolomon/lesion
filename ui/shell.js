import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

export class ThemeManagerUIShell {
    constructor(app) {
        this.app = app;
        this.window = null;
    }

    build() {
        const win = new Adw.ApplicationWindow({
            application: this.app,
            title: 'Theme Manager',
            default_width: 800,
            default_height: 600,
        });

        // Header bar and tab switcher
        const header = new Adw.HeaderBar();

        const stack = new Adw.ViewStack();

        const tabs = new Adw.ViewSwitcher({
            policy: Adw.ViewSwitcherPolicy.WIDE,
            stack: stack,
        });

        const stackSwitcher = new Adw.ViewSwitcherBar({
            stack: stack,
        });

        header.set_title_widget(tabs);
        header.set_show_end_title_buttons(true);

        // Add pages using add_titled (which wraps correctly under the hood)
        stack.add_titled(this._buildThemesPage(), 'themes', 'Themes');
        stack.add_titled(this._buildExtensionsPage(), 'extensions', 'Extensions');
        stack.add_titled(this._buildAboutPage(), 'about', 'About');

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        mainBox.append(header);
        mainBox.append(stack);
        mainBox.append(stackSwitcher);

        win.set_content(mainBox);
        this.window = win;
    }

    _buildThemesPage() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 24,
            margin_start: 24,
        });
        box.append(new Gtk.Label({ label: '🎨 Manage and apply themes here.', halign: Gtk.Align.START }));
        return box;
    }

    _buildExtensionsPage() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 24,
            margin_start: 24,
        });
        box.append(new Gtk.Label({ label: '🧩 Enable or disable extensions here.', halign: Gtk.Align.START }));
        return box;
    }

    _buildAboutPage() {
        return new Adw.StatusPage({
            title: 'About Theme Manager',
            description: 'Built with Libadwaita and GJS for GNOME 46+.',
            icon_name: 'preferences-desktop-theme-symbolic',
        });
    }

    present() {
        if (!this.window) {
            this.build();
        }
        this.window.present();
    }
}
