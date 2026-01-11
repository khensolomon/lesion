import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js';
import { PanelsPresets } from '../data/panels.js';
import { log, logError } from '../util/logger.js'; // Import logger

export function createPanelsUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- Logic: Apply Preset ---
    const applyPreset = (presetData) => {
        // List of keys that are definitely Enums in the schema
        const enumKeys = ['panel-border-style', 'popup-border-style'];
        
        Object.keys(presetData).forEach(key => {
            const val = presetData[key];
            const type = typeof val;

            if (type === 'boolean') {
                settings.set_boolean(key, val);
            } else if (type === 'string') {
                settings.set_string(key, val);
            } else if (type === 'number') {
                if (enumKeys.includes(key)) {
                    settings.set_enum(key, val);
                } else {
                    settings.set_int(key, val);
                }
            }
        });
    };

    // --- Helpers ---
    
    // const createColorRow = (title, key) => {
    //     const row = new Adw.ActionRow({ title: title });
    //     const dialog = new Gtk.ColorDialog();
    //     const btn = new Gtk.ColorDialogButton({ dialog, valign: Gtk.Align.CENTER });
    //     const rgba = new Gdk.RGBA();
    //     const savedVal = settings.get_string(key);
    //     if (savedVal && rgba.parse(savedVal)) btn.set_rgba(rgba);

    //     btn.connect('notify::rgba', () => {
    //         const c = btn.get_rgba();
    //         const hexStr = `rgba(${Math.round(c.red*255)},${Math.round(c.green*255)},${Math.round(c.blue*255)},${c.alpha.toFixed(2)})`; 
    //         settings.set_string(key, hexStr);
    //     });
    //     row.add_suffix(btn);
    //     return row;
    // };
const createColorRow = (title, key) => {
    const row = new Adw.ActionRow({ title });
    const dialog = new Gtk.ColorDialog({ with_alpha: true });
    const btn = new Gtk.ColorDialogButton({
        dialog,
        valign: Gtk.Align.CENTER,
    });

    const rgba = new Gdk.RGBA();
    const savedVal = settings.get_string(key);

    if (savedVal && rgba.parse(savedVal)) {
        btn.set_rgba(rgba);
        row.set_subtitle(savedVal);
    }

    btn.connect('notify::rgba', () => {
        const c = btn.get_rgba();
        const rgbaStr = `rgba(${Math.round(c.red * 255)}, ${Math.round(c.green * 255)}, ${Math.round(c.blue * 255)}, ${c.alpha.toFixed(2)})`;

        row.set_subtitle(rgbaStr);
        settings.set_string(key, rgbaStr);
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

    // --- 1. General Settings ---
    const generalGroup = new Adw.PreferencesGroup({ 
        title: 'General Configuration',
        description: 'Toggle the entire suite of panel customizations on or off.'
    });
    page.add(generalGroup);

    const enableRow = new Adw.SwitchRow({ title: 'Enable Panel Styling' });
    settings.bind('panel-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(enableRow);

    // --- 2. Presets (Placed after General) ---
    const presetsGroup = new Adw.PreferencesGroup({ 
        title: 'Presets',
        description: 'Quickly apply a pre-defined theme to transform your panel\'s appearance instantly.'
    });
    // Add sensitivity binding so presets are disabled if panel styling is off
    settings.bind('panel-enabled', presetsGroup, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    page.add(presetsGroup);

    // DEBUG: Export Configuration
    if (AppConfig.debug) {
        const copyRow = new Adw.ActionRow({
            title: 'Dev: Copy Current Config',
            subtitle: 'Export current settings to clipboard as JSON for new presets.'
        });
        
        const copyBtn = new Gtk.Button({
            icon_name: 'edit-copy-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Copy JSON to Clipboard'
        });
        copyBtn.add_css_class('flat');
        

        copyBtn.connect('clicked', () => {
            log('Starting configuration export...');
     
            const targetKeys = [
                'panel-enabled',
                'panel-bg-color', 'panel-bg-gradient-enabled', 'panel-bg-gradient-color', 'panel-bg-gradient-dir',
                'panel-border-size', 'panel-border-color', 'panel-border-style', 'panel-border-bottom-only',
                'panel-shadow-enabled', 'panel-shadow-color', 'panel-shadow-x', 'panel-shadow-y', 'panel-shadow-blur', 'panel-shadow-spread', 'panel-shadow-inset',
                'panel-btn-radius', 'panel-btn-pad-min', 'panel-btn-pad-nat', 'panel-btn-hover-enabled', 'panel-btn-bg-hover', 'panel-btn-bg-active',
                'popup-radius', 
                'popup-border-size', 'popup-border-color', 'popup-border-style',
                'popup-shadow-enabled', 'popup-shadow-color', 'popup-shadow-x', 'popup-shadow-y', 'popup-shadow-blur', 'popup-shadow-spread'
            ];
            
            try {
                // SAFETY: Get currently available keys in schema to avoid C-level aborts on missing keys
                const availableKeys = settings.list_keys();
                log(`Found ${availableKeys.length} available keys in schema.`);
                
                const data = {};

                targetKeys.forEach(k => {
                    if (availableKeys.includes(k)) {
                        const value = settings.get_value(k);
                        if (value) {
                             data[k] = value.deep_unpack();
                        }
                    } else {
                        logError(`Skipping missing schema key during export: ${k}`);
                    }
                });

                const exportObj = {
                    name: "New Preset Name",
                    description: "Description...",
                    data: data
                };

                const json = JSON.stringify(exportObj, null, 4);
                
                // 1. Log to Journal (Primary backup)
                log('Exported JSON content below:');
                log(json);
                
                // 2. Clipboard Copy
                let display = copyBtn.get_display();
                if (!display) display = Gdk.Display.get_default();
                
                if (display) {
                    const clipboard = display.get_clipboard();
                    clipboard.set_text(json);
                    log('JSON copied to clipboard successfully.');
                    
                    // Success Visual
                    copyBtn.set_icon_name('emblem-ok-symbolic');
                } else {
                    logError('Could not find GdkDisplay to access clipboard.');
                    copyBtn.set_icon_name('dialog-warning-symbolic');
                }

                // Reset icon
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                    copyBtn.set_icon_name('edit-copy-symbolic');
                    return GLib.SOURCE_REMOVE;
                });
            } catch (err) {
                logError('Copy Config Failed with exception:', err);
                copyBtn.set_icon_name('dialog-error-symbolic');
                
                // Reset icon even on error
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                    copyBtn.set_icon_name('edit-copy-symbolic');
                    return GLib.SOURCE_REMOVE;
                });
            }
        });

        copyRow.add_suffix(copyBtn);
        presetsGroup.add(copyRow);
    }

    PanelsPresets.forEach(preset => {
        const row = new Adw.ActionRow({ 
            title: preset.name,
            subtitle: preset.description
        });
        
        const applyBtn = new Gtk.Button({ 
            icon_name: 'media-playback-start-symbolic', // Play icon indicating "Run/Apply"
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Apply ' + preset.name
        });
        
        applyBtn.add_css_class('flat');
        
        applyBtn.connect('clicked', () => {
            applyPreset(preset.data);
            
        });

        row.add_suffix(applyBtn);
        presetsGroup.add(row);
    });

    // --- 3. Panel Background ---
    const bgGroup = new Adw.PreferencesGroup({ 
        title: 'Panel Background',
        description: 'Control the base color, gradients, and transparency levels of the top bar.'
    });
    page.add(bgGroup);
    
    bgGroup.add(createColorRow('Background Color', 'panel-bg-color'));
    
    const gradSwitch = new Adw.SwitchRow({ title: 'Enable Gradient' });
    settings.bind('panel-bg-gradient-enabled', gradSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    bgGroup.add(gradSwitch);
    
    const gradColorRow = createColorRow('Gradient End Color', 'panel-bg-gradient-color');
    settings.bind('panel-bg-gradient-enabled', gradColorRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    bgGroup.add(gradColorRow);

    const gradDirRow = createComboRow('Gradient Direction', 'panel-bg-gradient-dir', ['Vertical', 'Horizontal'], false);
    settings.bind('panel-bg-gradient-enabled', gradDirRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    bgGroup.add(gradDirRow);

    // --- 4. Panel Border ---
    const borderGroup = new Adw.PreferencesGroup({ 
        title: 'Panel Border',
        description: 'Define the outline of the panel with custom width, color, and line styles.'
    });
    page.add(borderGroup);

    borderGroup.add(createSpinRow('Size', 'panel-border-size', 0, 10));
    borderGroup.add(createColorRow('Color', 'panel-border-color'));
    
    const borderStyles = ['Solid','Dotted','Dashed','Double','Groove','Ridge','Inset','Outset','None'];
    borderGroup.add(createComboRow('Style', 'panel-border-style', borderStyles, true));
    
    const bottomOnly = new Adw.SwitchRow({ title: 'Bottom Border Only' });
    settings.bind('panel-border-bottom-only', bottomOnly, 'active', Gio.SettingsBindFlags.DEFAULT);
    borderGroup.add(bottomOnly);

    // --- 5. Panel Shadow ---
    const shadowGroup = new Adw.PreferencesGroup({ 
        title: 'Panel Shadow',
        description: 'Add depth to the panel using drop shadows or inner shadow effects.'
    });
    page.add(shadowGroup);

    const shEnable = new Adw.SwitchRow({ title: 'Enable Shadow' });
    settings.bind('panel-shadow-enabled', shEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    shadowGroup.add(shEnable);

    // Helper to bind sensitivity to shadow switch
    const bindShadow = (widget) => {
        settings.bind('panel-shadow-enabled', widget, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        shadowGroup.add(widget);
    };

    bindShadow(createColorRow('Color', 'panel-shadow-color'));
    bindShadow(createSpinRow('Offset X', 'panel-shadow-x', -50, 50));
    bindShadow(createSpinRow('Offset Y', 'panel-shadow-y', -50, 50));
    bindShadow(createSpinRow('Blur', 'panel-shadow-blur', 0, 50));
    bindShadow(createSpinRow('Spread', 'panel-shadow-spread', -20, 50));
    
    const insetSw = new Adw.SwitchRow({ title: 'Inset Shadow' });
    settings.bind('panel-shadow-inset', insetSw, 'active', Gio.SettingsBindFlags.DEFAULT);
    bindShadow(insetSw);

    // --- 6. Panel Buttons ---
    const btnGroup = new Adw.PreferencesGroup({ 
        title: 'Panel Buttons',
        description: 'Fine-tune the shape, padding, and hover interaction states of individual panel items.'
    });
    page.add(btnGroup);
    
    btnGroup.add(createSpinRow('Corner Radius', 'panel-btn-radius', 0, 50));
    btnGroup.add(createSpinRow('Min Padding (-minimum-hpadding)', 'panel-btn-pad-min', 0, 50));
    btnGroup.add(createSpinRow('Natural Padding (-natural-hpadding)', 'panel-btn-pad-nat', 0, 50));

    const hEnable = new Adw.SwitchRow({ title: 'Enable Hover Effect' });
    settings.bind('panel-btn-hover-enabled', hEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    btnGroup.add(hEnable);

    const hColorRow = createColorRow('Hover Background', 'panel-btn-bg-hover');
    settings.bind('panel-btn-hover-enabled', hColorRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    btnGroup.add(hColorRow);

    const aColorRow = createColorRow('Active Background', 'panel-btn-bg-active');
    settings.bind('panel-btn-hover-enabled', aColorRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    btnGroup.add(aColorRow);

    // --- 7. Popup Menus ---
    const popupGroup = new Adw.PreferencesGroup({ 
        title: 'Popup Menus',
        description: 'Style the dropdown menus (calendar, system menu) with custom borders, shadows, and rounding.'
    });
    page.add(popupGroup);
    
    popupGroup.add(createSpinRow('Corner Radius', 'popup-radius', 0, 50));
    
    // Popup Border
    popupGroup.add(createSpinRow('Border Size', 'popup-border-size', 0, 10));
    popupGroup.add(createColorRow('Border Color', 'popup-border-color'));
    popupGroup.add(createComboRow('Border Style', 'popup-border-style', borderStyles, true));

    // Popup Shadow
    const psEnable = new Adw.SwitchRow({ title: 'Enable Shadow' });
    settings.bind('popup-shadow-enabled', psEnable, 'active', Gio.SettingsBindFlags.DEFAULT);
    popupGroup.add(psEnable);

    const bindPopupShadow = (widget) => {
        settings.bind('popup-shadow-enabled', widget, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        popupGroup.add(widget);
    };

    bindPopupShadow(createColorRow('Shadow Color', 'popup-shadow-color'));
    bindPopupShadow(createSpinRow('Shadow X', 'popup-shadow-x', -50, 50));
    bindPopupShadow(createSpinRow('Shadow Y', 'popup-shadow-y', -50, 50));
    bindPopupShadow(createSpinRow('Shadow Blur', 'popup-shadow-blur', 0, 100));
    bindPopupShadow(createSpinRow('Shadow Spread', 'popup-shadow-spread', -50, 50));

    // Lock all groups if main enable is off
    const groups = [bgGroup, borderGroup, shadowGroup, btnGroup, popupGroup];
    groups.forEach(g => {
        settings.bind('panel-enabled', g, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    });

    return page;
}