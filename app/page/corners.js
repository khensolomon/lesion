import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { AppConfig } from '../config.js';

export function createCornersUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- GROUP 1: ACTIVATION ---
    const mainGroup = new Adw.PreferencesGroup({
        title: 'Window Corners',
        description: 'Modify the border radius of system elements'
    });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({
        title: 'Enable Custom Corners',
        subtitle: 'Apply custom border radius to shell elements'
    });
    settings.bind('corners-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    // --- GROUP 2: CONFIGURATION ---
    const configGroup = new Adw.PreferencesGroup({
        title: 'Configuration',
        description: 'Adjust shape and size'
    });
    page.add(configGroup);

    // 1. Flatten Toggle
    const flatRow = new Adw.SwitchRow({
        title: 'Flatten Windows',
        subtitle: 'Remove rounded corners entirely (Square look)',
        icon_name: 'view-restore-symbolic'
    });
    settings.bind('corners-flat', flatRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    
    // Bind sensitivity to main enable switch
    settings.bind('corners-enabled', flatRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    
    configGroup.add(flatRow);

    // 2. Radius Slider (SpinRow)
    // We bind its sensitivity: It should be disabled if "Flatten" is ON or "Enabled" is OFF
    const radiusRow = new Adw.SpinRow({
        title: 'Corner Radius',
        subtitle: 'Pixel value (0 - 50)',
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 50,
            step_increment: 1
        }),
        value: settings.get_int('corners-radius')
    });

    settings.bind('corners-radius', radiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    
    // Manual sensitivity logic for Radius (complex dependency)
    const updateRadiusState = () => {
        const enabled = settings.get_boolean('corners-enabled');
        const isFlat = settings.get_boolean('corners-flat');
        radiusRow.set_sensitive(enabled && !isFlat);
    };

    settings.connect('changed::corners-enabled', updateRadiusState);
    settings.connect('changed::corners-flat', updateRadiusState);
    updateRadiusState(); // Initial check

    configGroup.add(radiusRow);

    return page;
}