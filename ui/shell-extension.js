import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export function buildExtensionsPage(settings) {
    const pageBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
        spacing: 18,
    });

    const scrolledWindow = new Gtk.ScrolledWindow({
        child: pageBox,
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vexpand: true,
    });

    const group = new Adw.PreferencesGroup({
        title: 'Managed Extensions',
        description: 'Enable or disable extensions included with this tool.',
    });
    pageBox.append(group);

    if (!settings) {
        group.set_sensitive(false);
        group.set_description('Could not load settings. Ensure schemas are compiled and installed.');
        return scrolledWindow;
    }

    const moveClockSwitch = new Adw.SwitchRow({
        title: 'Move Status Bar Clock to Right',
        subtitle: 'A simple demonstration extension',
        subtitle_lines: 1,
    });
    settings.bind('move-clock-extension-enabled', moveClockSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(moveClockSwitch);
    
    return scrolledWindow;
}
