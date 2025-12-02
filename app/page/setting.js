import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

export function createSettingUI(navigator, goToPage, subPageTarget) {
    const page = new Adw.PreferencesPage();

    // Group 1: Main Settings
    const group = new Adw.PreferencesGroup({ title: 'Appearance', description: 'Configure layout behavior' });
    group.add(new Adw.SwitchRow({ title: 'Dark Mode', subtitle: 'Override system theme' }));
    group.add(new Adw.ComboRow({ title: 'Refresh Rate', model: new Gtk.StringList({ strings: ['60Hz', '120Hz', '144Hz'] }) }));

    // Group 2: Advanced
    const advancedGroup = new Adw.PreferencesGroup({ title: 'Advanced' });

    // Create Row for Night Light
    const subPageRow = new Adw.ActionRow({ 
        title: 'Night Light and Color', 
        subtitle: 'Color temperature and scheduling', 
        activatable: true 
    });
    
    subPageRow.add_suffix(new Gtk.Image({ icon_name: 'go-next-symbolic' }));
    
    // ACTION: Use our custom pushName method directly
    subPageRow.connect('activated', () => {
        if (navigator && navigator.pushName) {
            navigator.pushName('nightlight');
        }
    });
    
    advancedGroup.add(subPageRow);

    page.add(group);
    page.add(advancedGroup);

    // Deep Link Handler
    if (subPageTarget && navigator && navigator.pushName) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
             navigator.pushName(subPageTarget);
             return GLib.SOURCE_REMOVE;
        });
    }

    return page;
}