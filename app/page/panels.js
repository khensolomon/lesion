import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js';

export function createPanelsUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- Helpers ---
    const createColorRow = (title, key) => {
        const row = new Adw.ActionRow({ title: title });
        const dialog = new Gtk.ColorDialog();
        const btn = new Gtk.ColorDialogButton({ dialog, valign: Gtk.Align.CENTER });
        const rgba = new Gdk.RGBA();
        const savedVal = settings.get_string(key);
        if (savedVal && rgba.parse(savedVal)) btn.set_rgba(rgba);

        btn.connect('notify::rgba', () => {
            const c = btn.get_rgba();
            const hexStr = `rgba(${Math.round(c.red*255)},${Math.round(c.green*255)},${Math.round(c.blue*255)},${c.alpha.toFixed(2)})`; 
            settings.set_string(key, hexStr);
        });
        row.add_suffix(btn);
        return row;
    };

    const createSpinRow = (title, key, min, max) => {
        const row = new Adw.SpinRow({
            title: title,
            adjustment: new Gtk.Adjustment({ lower: min, upper: max, step_increment: 1 }),
            value: settings.get_int(key)
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    };

    // Updated to support both Enum and Int keys
    const createComboRow = (title, key, options, isEnum = true) => {
        const model = new Gtk.StringList();
        options.forEach(opt => model.append(opt));
        
        let initialVal;
        if (isEnum) {
            initialVal = settings.get_enum(key);
        } else {
            initialVal = settings.get_int(key);
        }
        
        const row = new Adw.ComboRow({ title: title, model: model, selected: initialVal });
        row.connect('notify::selected', () => {
            if (isEnum) {
                settings.set_enum(key, row.selected);
            } else {
                settings.set_int(key, row.selected);
            }
        });
        return row;
    };

    // --- 1. Master Switch ---
    const mainGroup = new Adw.PreferencesGroup({ title: 'Main' });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({ title: 'Enable Panel Styling' });
    settings.bind('panel-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    // --- 2. Panel Bar ---
    const barGroup = new Adw.PreferencesGroup({ title: 'Panel Bar' });
    page.add(barGroup);

    // Background
    const bgExpander = new Adw.ExpanderRow({ title: 'Background' });
    barGroup.add(bgExpander);
    bgExpander.add_row(createColorRow('Solid Color', 'panel-bg-color'));
    
    const gradSwitch = new Adw.SwitchRow({ title: 'Enable Gradient' });
    settings.bind('panel-bg-gradient-enabled', gradSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    bgExpander.add_row(gradSwitch);
    bgExpander.add_row(createColorRow('Gradient End Color', 'panel-bg-gradient-color'));
    
    // Pass false to indicate this is an integer, not a formal enum
    bgExpander.add_row(createComboRow('Gradient Direction', 'panel-bg-gradient-dir', ['Vertical', 'Horizontal'], false));
    
    // Note: Removed Blend Mode as it is not supported in St
    
    // Border
    const borderExpander = new Adw.ExpanderRow({ title: 'Border' });
    barGroup.add(borderExpander);
    borderExpander.add_row(createSpinRow('Size', 'panel-border-size', 0, 10));
    borderExpander.add_row(createColorRow('Color', 'panel-border-color'));
    const borderStyles = ['Solid','Dotted','Dashed','Double','Groove','Ridge','Inset','Outset','None'];
    borderExpander.add_row(createComboRow('Style', 'panel-border-style', borderStyles, true));
    
    const bottomOnly = new Adw.SwitchRow({ title: 'Bottom Border Only' });
    settings.bind('panel-border-bottom-only', bottomOnly, 'active', Gio.SettingsBindFlags.DEFAULT);
    borderExpander.add_row(bottomOnly);

    // Shadow
    const shadowExpander = new Adw.ExpanderRow({ title: 'Shadow' });
    barGroup.add(shadowExpander);
    const shEnable = new Adw.SwitchRow({ title: 'Enable Shadow' });
    settings.bind('panel-shadow-enabled', shEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    shadowExpander.add_row(shEnable);
    shadowExpander.add_row(createColorRow('Color', 'panel-shadow-color'));
    shadowExpander.add_row(createSpinRow('Offset X', 'panel-shadow-x', -50, 50));
    shadowExpander.add_row(createSpinRow('Offset Y', 'panel-shadow-y', -50, 50));
    shadowExpander.add_row(createSpinRow('Blur', 'panel-shadow-blur', 0, 50));
    shadowExpander.add_row(createSpinRow('Spread', 'panel-shadow-spread', -20, 50));
    const insetSw = new Adw.SwitchRow({ title: 'Inset Shadow' });
    settings.bind('panel-shadow-inset', insetSw, 'active', Gio.SettingsBindFlags.DEFAULT);
    shadowExpander.add_row(insetSw);

    // --- 3. Panel Buttons ---
    const btnGroup = new Adw.PreferencesGroup({ title: 'Panel Buttons' });
    page.add(btnGroup);
    
    btnGroup.add(createSpinRow('Corner Radius', 'panel-btn-radius', 0, 50));
    btnGroup.add(createSpinRow('Min Padding (-minimum-hpadding)', 'panel-btn-pad-min', 0, 50));
    btnGroup.add(createSpinRow('Natural Padding (-natural-hpadding)', 'panel-btn-pad-nat', 0, 50));

    const hoverExpander = new Adw.ExpanderRow({ title: 'Hover & Active State' });
    btnGroup.add(hoverExpander);
    const hEnable = new Adw.SwitchRow({ title: 'Enable Hover Effect' });
    settings.bind('panel-btn-hover-enabled', hEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    hoverExpander.add_row(hEnable);
    hoverExpander.add_row(createColorRow('Hover Background', 'panel-btn-bg-hover'));
    hoverExpander.add_row(createColorRow('Active Background', 'panel-btn-bg-active'));

    // --- 4. Popup Menus ---
    const popupGroup = new Adw.PreferencesGroup({ title: 'Popup Menus' });
    page.add(popupGroup);
    
    popupGroup.add(createSpinRow('Corner Radius', 'popup-radius', 0, 50));
    
    // Popup Shadow
    const pShadowExpander = new Adw.ExpanderRow({ title: 'Shadow' });
    popupGroup.add(pShadowExpander);
    const psEnable = new Adw.SwitchRow({ title: 'Enable' });
    settings.bind('popup-shadow-enabled', psEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    pShadowExpander.add_row(psEnable);
    pShadowExpander.add_row(createColorRow('Color', 'popup-shadow-color'));
    pShadowExpander.add_row(createSpinRow('X', 'popup-shadow-x', -50, 50));
    pShadowExpander.add_row(createSpinRow('Y', 'popup-shadow-y', -50, 50));
    pShadowExpander.add_row(createSpinRow('Blur', 'popup-shadow-blur', 0, 100));
    pShadowExpander.add_row(createSpinRow('Spread', 'popup-shadow-spread', -50, 50));

    // Popup Border
    const pBorderExpander = new Adw.ExpanderRow({ title: 'Border' });
    popupGroup.add(pBorderExpander);
    pBorderExpander.add_row(createSpinRow('Size', 'popup-border-size', 0, 10));
    pBorderExpander.add_row(createColorRow('Color', 'popup-border-color'));
    pBorderExpander.add_row(createComboRow('Style', 'popup-border-style', borderStyles, true));

    // Lock controls
    settings.bind('panel-enabled', barGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('panel-enabled', btnGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('panel-enabled', popupGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

    return page;
}