import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

export function createMimicUI() {
    const page = new Adw.PreferencesPage();

    const group = new Adw.PreferencesGroup({
        title: 'Mimic Button',
        description: 'Demonstration of interactive panel elements'
    });
    page.add(group);

    // Informational Banner
    const infoRow = new Adw.ActionRow({
        title: 'Interactive Demo',
        subtitle: 'This feature adds a button to the top panel.\n• Left Click: Toggle Overview\n• Right Click: Open Menu'
    });
    
    // Add an icon to the row
    const icon = new Gtk.Image({
        icon_name: 'face-laugh-symbolic',
        pixel_size: 48,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12
    });
    infoRow.add_prefix(icon);
    
    group.add(infoRow);

    const noteRow = new Adw.ActionRow({
        title: 'No Settings Available',
        subtitle: 'This component does not use GSchema storage.'
    });
    group.add(noteRow);

    return page;
}