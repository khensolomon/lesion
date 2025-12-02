import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

export function createHomeUI() {
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
        title: 'System Information'
    });

    const row1 = new Adw.ActionRow({
        title: 'System Name',
        subtitle: 'Ubuntu 24.04 LTS Clone'
    });

    const row2 = new Adw.ActionRow({
        title: 'Windowing System',
        subtitle: 'Wayland'
    });

    group.add(row1);
    group.add(row2);
    page.add(group);

    return page;
}