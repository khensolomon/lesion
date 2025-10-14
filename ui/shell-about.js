import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function buildAboutPage(app) {
    const pageBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
        spacing: 18,
        valign: Gtk.Align.START,
    });
    
    const scrolledWindow = new Gtk.ScrolledWindow({
        child: pageBox,
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vexpand: true,
    });

    const group = new Adw.PreferencesGroup();
    pageBox.append(group);

    const appRow = new Adw.ActionRow({
        title: GLib.markup_escape_text(app.metadata.name, -1),
        subtitle: app.metadata.description,
    });
    appRow.add_prefix(new Gtk.Image({
        icon_name: app.metadata.applicationId,
        pixel_size: 64,
    }));
    group.add(appRow);

    const versionRow = new Adw.ActionRow({
        title: 'Version',
        subtitle: app.metadata.version,
    });
    group.add(versionRow);

    const developerRow = new Adw.ActionRow({
        title: 'Developer',
        subtitle: 'Lethil',
    });
    group.add(developerRow);

    const websiteRow = new Adw.ActionRow({
        title: 'Website',
        subtitle: app.metadata.url,
        activatable: true,
    });
    websiteRow.add_suffix(new Gtk.Image({
        icon_name: 'go-jump-symbolic'
    }));
    websiteRow.connect('activated', () => {
        try {
            Gio.AppInfo.launch_default_for_uri(app.metadata.url, null);
        } catch (e) {
            logError(e, `Failed to open URL: ${app.metadata.url}`);
        }
    });
    group.add(websiteRow);

    return scrolledWindow;
}
