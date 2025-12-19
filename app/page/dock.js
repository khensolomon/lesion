import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import { AppConfig } from '../config.js';

export function createDockUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- 1. MAIN TOGGLE ---
    const mainGroup = new Adw.PreferencesGroup({ title: 'Functionality' });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({
        title: 'Enable Custom Dock',
        subtitle: 'Detach the Dash and use it as a persistent dock'
    });
    settings.bind('dock-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    // --- 2. LAYOUT ---
    const layoutGroup = new Adw.PreferencesGroup({ title: 'Layout' });
    page.add(layoutGroup);

    // Position (Enum)
    const posRow = new Adw.ComboRow({
        title: 'Screen Position',
        model: new Gtk.StringList({
            strings: ['Bottom', 'Left', 'Right', 'Top']
        })
    });
    posRow.set_selected(settings.get_enum('dock-position'));
    posRow.connect('notify::selected', () => settings.set_enum('dock-position', posRow.selected));
    layoutGroup.add(posRow);

    // Panel Mode (Switch)
    const panelRow = new Adw.SwitchRow({
        title: 'Panel Mode',
        subtitle: 'Extend the dock to the screen edges (Full Width/Height)'
    });
    settings.bind('dock-panel-mode', panelRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(panelRow);

    // Icon Size (SpinRow)
    const sizeRow = new Adw.SpinRow({
        title: 'Icon Size',
        subtitle: 'Size in pixels (default: 48)',
        adjustment: new Gtk.Adjustment({ lower: 16, upper: 128, step_increment: 4 }),
        value: settings.get_int('dock-icon-size')
    });
    settings.bind('dock-icon-size', sizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(sizeRow);

    // Bind Sensitivity: Disable layout controls if dock is disabled
    settings.bind('dock-enabled', posRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', panelRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', sizeRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);


    // --- 3. APPEARANCE ---
    const styleGroup = new Adw.PreferencesGroup({ title: 'Appearance' });
    page.add(styleGroup);

    // Background Color (Custom Row with ColorDialogButton)
    const colorRow = new Adw.ActionRow({ title: 'Background Color' });
    const colorBtn = new Gtk.ColorDialogButton({
        valign: Gtk.Align.CENTER,
        dialog: new Gtk.ColorDialog()
    });
    
    // Initial color load
    const rgba = new Gdk.RGBA();
    const hex = settings.get_string('dock-color');
    if (rgba.parse(hex)) {
        colorBtn.set_rgba(rgba);
    }
    
    // Save color change
    colorBtn.connect('notify::rgba', () => {
        const c = colorBtn.get_rgba();
        const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        const hexStr = `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}`;
        settings.set_string('dock-color', hexStr);
    });
    
    colorRow.add_suffix(colorBtn);
    styleGroup.add(colorRow);

    // Opacity (SpinRow)
    const opacityRow = new Adw.SpinRow({
        title: 'Background Opacity',
        subtitle: '0.0 (Transparent) to 1.0 (Opaque)',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.1 }),
        digits: 1,
        value: settings.get_double('dock-opacity')
    });
    settings.bind('dock-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    styleGroup.add(opacityRow);

    // Radius (SpinRow)
    const radiusRow = new Adw.SpinRow({
        title: 'Corner Radius',
        subtitle: 'Roundness of the dock background',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 64, step_increment: 2 }),
        value: settings.get_int('dock-radius')
    });
    settings.bind('dock-radius', radiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    styleGroup.add(radiusRow);

    // Bind Sensitivity
    settings.bind('dock-enabled', colorRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', opacityRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', radiusRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);


    // --- 4. BEHAVIOR ---
    const behaveGroup = new Adw.PreferencesGroup({ title: 'Behavior' });
    page.add(behaveGroup);

    const autoHideRow = new Adw.SwitchRow({
        title: 'Intelligent Auto-Hide',
        subtitle: 'Hide dock when mouse leaves or windows overlap'
    });
    settings.bind('dock-autohide', autoHideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    behaveGroup.add(autoHideRow);

    // Bind Sensitivity
    settings.bind('dock-enabled', autoHideRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

    return page;
}