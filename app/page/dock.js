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

    const enableRow = new Adw.SwitchRow({ title: 'Enable Custom Dock' });
    settings.bind('dock-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    const showAppsRow = new Adw.SwitchRow({ title: 'Show Applications Button' });
    settings.bind('dock-show-apps', showAppsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(showAppsRow);

    settings.bind('dock-enabled', showAppsRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

    // --- 2. LAYOUT ---
    const layoutGroup = new Adw.PreferencesGroup({ title: 'Layout' });
    page.add(layoutGroup);

    const posRow = new Adw.ComboRow({
        title: 'Screen Position',
        model: new Gtk.StringList({ strings: ['Bottom', 'Left', 'Right', 'Top'] })
    });
    posRow.set_selected(settings.get_enum('dock-position'));
    posRow.connect('notify::selected', () => settings.set_enum('dock-position', posRow.selected));
    layoutGroup.add(posRow);

    const panelRow = new Adw.SwitchRow({ title: 'Panel Mode (Edge-to-Edge)' });
    settings.bind('dock-panel-mode', panelRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(panelRow);

    const sizeRow = new Adw.SpinRow({
        title: 'Icon Size',
        adjustment: new Gtk.Adjustment({ lower: 16, upper: 128, step_increment: 4 }),
        value: settings.get_int('dock-icon-size')
    });
    settings.bind('dock-icon-size', sizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(sizeRow);

    const paddingRow = new Adw.SpinRow({
        title: 'Dock Padding',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 48, step_increment: 1 }),
        value: settings.get_int('dock-padding')
    });
    settings.bind('dock-padding', paddingRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(paddingRow);

    const spaceRow = new Adw.SpinRow({
        title: 'Icon Spacing',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 48, step_increment: 1 }),
        value: settings.get_int('dock-item-spacing')
    });
    settings.bind('dock-item-spacing', spaceRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(spaceRow);

    const marginRow = new Adw.SpinRow({
        title: 'Screen Margin',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 200, step_increment: 2 }),
        value: settings.get_int('dock-margin')
    });
    settings.bind('dock-margin', marginRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    layoutGroup.add(marginRow);


    // --- 3. DOCK APPEARANCE ---
    const styleGroup = new Adw.PreferencesGroup({ title: 'Dock Style' });
    page.add(styleGroup);

    styleGroup.add(_createColorRow(settings, 'dock-color', 'Background Color'));

    const opacityRow = new Adw.SpinRow({
        title: 'Opacity',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.1 }),
        digits: 1,
        value: settings.get_double('dock-opacity')
    });
    settings.bind('dock-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    styleGroup.add(opacityRow);

    const radiusRow = new Adw.SpinRow({
        title: 'Corner Radius',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 64, step_increment: 2 }),
        value: settings.get_int('dock-radius')
    });
    settings.bind('dock-radius', radiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    styleGroup.add(radiusRow);
    
    // Border
    const borderRow = new Adw.SpinRow({
        title: 'Border Width',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 10, step_increment: 1 }),
        value: settings.get_int('dock-border-width')
    });
    settings.bind('dock-border-width', borderRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    styleGroup.add(borderRow);

    styleGroup.add(_createColorRow(settings, 'dock-border-color', 'Border Color'));


    // --- 4. ITEM STYLE & ANIMATION ---
    const itemGroup = new Adw.PreferencesGroup({ title: 'Icons & Animations' });
    page.add(itemGroup);

    itemGroup.add(_createColorRow(settings, 'dock-item-color', 'Icon Background Color'));
    
    const itemRadiusRow = new Adw.SpinRow({
        title: 'Icon Background Radius',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 50, step_increment: 2 }),
        value: settings.get_int('dock-item-radius')
    });
    settings.bind('dock-item-radius', itemRadiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    itemGroup.add(itemRadiusRow);

    const itemPaddingRow = new Adw.SpinRow({
        title: 'Icon Padding',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 20, step_increment: 1 }),
        value: settings.get_int('dock-item-padding')
    });
    settings.bind('dock-item-padding', itemPaddingRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    itemGroup.add(itemPaddingRow);

    const itemMarginRow = new Adw.SpinRow({
        title: 'Icon Margin',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 20, step_increment: 1 }),
        value: settings.get_int('dock-item-margin')
    });
    settings.bind('dock-item-margin', itemMarginRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    itemGroup.add(itemMarginRow);

    const hoverRow = new Adw.SpinRow({
        title: 'Hover Scale',
        adjustment: new Gtk.Adjustment({ lower: 1.0, upper: 2.0, step_increment: 0.1 }),
        digits: 1,
        value: settings.get_double('dock-hover-scale')
    });
    settings.bind('dock-hover-scale', hoverRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    itemGroup.add(hoverRow);

    const autoHideRow = new Adw.SwitchRow({
        title: 'Auto-Hide',
        subtitle: 'Slide out when not hovered'
    });
    settings.bind('dock-autohide', autoHideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    itemGroup.add(autoHideRow);

    // Bind Sensitivity
    settings.bind('dock-enabled', layoutGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', styleGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('dock-enabled', itemGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

    return page;
}

function _createColorRow(settings, key, title) {
    const row = new Adw.ActionRow({ title: title });
    const btn = new Gtk.ColorDialogButton({
        valign: Gtk.Align.CENTER,
        dialog: new Gtk.ColorDialog()
    });
    
    try {
        const rgba = new Gdk.RGBA();
        const hex = settings.get_string(key);
        if (rgba.parse(hex)) btn.set_rgba(rgba);
    } catch(e) {}

    btn.connect('notify::rgba', () => {
        const c = btn.get_rgba();
        const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        const alpha = Math.round(c.alpha * 255).toString(16).padStart(2, '0');
        settings.set_string(key, `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}${alpha}`);
    });

    row.add_suffix(btn);
    return row;
}