import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js';

export function createAppsUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- GLOBAL APPEARANCE ---
    const globalGroup = new Adw.PreferencesGroup({
        title: 'Global Appearance',
        description: 'Settings applying to all items below'
    });
    page.add(globalGroup);

    // Icon Size
    const sizeRow = new Adw.SpinRow({
        title: 'Icon Size',
        adjustment: new Gtk.Adjustment({ lower: 12, upper: 64, step_increment: 2 }),
        value: settings.get_int('apps-icon-size')
    });
    settings.bind('apps-icon-size', sizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    globalGroup.add(sizeRow);

    // Desaturate
    const desatRow = new Adw.SwitchRow({
        title: 'Monochrome Icons',
    });
    settings.bind('apps-icon-desaturate', desatRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    globalGroup.add(desatRow);

    // Opacity
    const opRunRow = new Adw.SpinRow({
        title: 'Running Opacity',
        subtitle: 'Opacity for running apps (0-255)',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5 }),
        value: settings.get_int('apps-opacity-running')
    });
    settings.bind('apps-opacity-running', opRunRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    globalGroup.add(opRunRow);

    const opStopRow = new Adw.SpinRow({
        title: 'Stopped Opacity',
        subtitle: 'Opacity for inactive favorites (0-255)',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5 }),
        value: settings.get_int('apps-opacity-stopped')
    });
    settings.bind('apps-opacity-stopped', opStopRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    globalGroup.add(opStopRow);


    // --- INDICATOR SETTINGS ---
    const indGroup = new Adw.PreferencesGroup({ title: 'Running Indicator' });
    page.add(indGroup);

    // PRESETS CONFIGURATION
    const presetConfig = [
        { name: 'Custom', id: 0 },
        { name: 'Dot Below',  pos: 'top',    off: 12, w: 4,  h: 4,  r: 99, c: '#ffffff' },
        { name: 'Dot Above',  pos: 'bottom', off: 12, w: 4,  h: 4,  r: 99, c: '#ffffff' },
        { name: 'Line Below', pos: 'top',    off: 12, w: 16, h: 2,  r: 0,  c: '#3584e4' },
        { name: 'Line Above', pos: 'bottom', off: 12, w: 16, h: 2,  r: 0,  c: '#3584e4' },
        { name: 'Bar Left',   pos: 'right',  off: 13, w: 2,  h: 16, r: 0,  c: '#ffffff' },
        { name: 'Bar Right',  pos: 'left',   off: 13, w: 2,  h: 16, r: 0,  c: '#ffffff' }
    ];

    const presetModel = new Gtk.StringList();
    presetConfig.forEach(p => presetModel.append(p.name));

    const presetRow = new Adw.ComboRow({
        title: 'Style Preset',
        subtitle: 'Quickly apply common indicator styles',
        model: presetModel,
    });

    // 1. APPLY PRESET
    presetRow.connect('notify::selected', () => {
        const idx = presetRow.selected;
        if (idx === 0) return; // Custom, do nothing

        const p = presetConfig[idx];
        
        // Write all values
        settings.set_value('apps-indicator-pos', new GLib.Variant('s', p.pos));
        settings.set_int('apps-indicator-offset', p.off);
        settings.set_int('apps-indicator-width', p.w);
        settings.set_int('apps-indicator-height', p.h);
        settings.set_int('apps-indicator-radius', p.r);
        settings.set_string('apps-indicator-color', p.c);
    });

    // 2. DETECT PRESET (Reverse Lookup)
    const updatePresetSelection = () => {
        // Read current values
        let pos = 'top';
        const val = settings.get_value('apps-indicator-pos');
        if (val.is_of_type(new GLib.VariantType('s'))) {
            pos = val.deep_unpack();
        } else if (val.is_of_type(new GLib.VariantType('i'))) {
             const nicks = ['top', 'right', 'bottom', 'left'];
             pos = nicks[val.deep_unpack()] || 'top';
        }

        const current = {
            pos: pos,
            off: settings.get_int('apps-indicator-offset'),
            w: settings.get_int('apps-indicator-width'),
            h: settings.get_int('apps-indicator-height'),
            r: settings.get_int('apps-indicator-radius'),
            c: settings.get_string('apps-indicator-color').toLowerCase()
        };

        let matchIndex = 0; // Default to Custom

        for (let i = 1; i < presetConfig.length; i++) {
            const p = presetConfig[i];
            if (p.pos === current.pos &&
                p.off === current.off &&
                p.w === current.w &&
                p.h === current.h &&
                p.r === current.r &&
                p.c.toLowerCase() === current.c) {
                matchIndex = i;
                break;
            }
        }

        if (presetRow.selected !== matchIndex) {
            presetRow.freeze_notify(); // Prevent triggering the setter loop
            presetRow.selected = matchIndex;
            presetRow.thaw_notify();
        }
    };

    // Watch all relevant keys to update the dropdown state
    const keysToWatch = [
        'apps-indicator-pos', 'apps-indicator-offset', 
        'apps-indicator-width', 'apps-indicator-height', 
        'apps-indicator-radius', 'apps-indicator-color'
    ];
    keysToWatch.forEach(key => settings.connect(`changed::${key}`, updatePresetSelection));
    
    // Initial check
    updatePresetSelection();

    indGroup.add(presetRow);

    // --- MANUAL CONTROLS ---

    // Position Enum (Manual Handling)
    const indPosModel = new Gtk.StringList();
    indPosModel.append('Top');    // 0
    indPosModel.append('Right');  // 1
    indPosModel.append('Bottom'); // 2
    indPosModel.append('Left');   // 3
    
    const indPosRow = new Adw.ComboRow({
        title: 'Position',
        model: indPosModel
    });

    // Initial Load
    indPosRow.selected = settings.get_enum('apps-indicator-pos');

    // Save Change
    indPosRow.connect('notify::selected', () => {
        const nicks = ['top', 'right', 'bottom', 'left'];
        if (settings.get_enum('apps-indicator-pos') !== indPosRow.selected) {
            settings.set_value('apps-indicator-pos', new GLib.Variant('s', nicks[indPosRow.selected]));
        }
    });

    // External Change
    settings.connect('changed::apps-indicator-pos', () => {
        const currentVal = settings.get_enum('apps-indicator-pos');
        if (indPosRow.selected !== currentVal) {
            indPosRow.selected = currentVal;
        }
    });

    indGroup.add(indPosRow);

    // Offset
    const offsetRow = new Adw.SpinRow({
        title: 'Offset',
        subtitle: 'Distance from edge',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 20, step_increment: 1 })
    });
    settings.bind('apps-indicator-offset', offsetRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    indGroup.add(offsetRow);

    // Width
    const wRow = new Adw.SpinRow({
        title: 'Width',
        adjustment: new Gtk.Adjustment({ lower: 1, upper: 20, step_increment: 1 })
    });
    settings.bind('apps-indicator-width', wRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    indGroup.add(wRow);

    // Height
    const hRow = new Adw.SpinRow({
        title: 'Height',
        adjustment: new Gtk.Adjustment({ lower: 1, upper: 20, step_increment: 1 })
    });
    settings.bind('apps-indicator-height', hRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    indGroup.add(hRow);

    // Radius
    const radRow = new Adw.SpinRow({
        title: 'Radius',
        subtitle: 'Corner rounding (0=Square, 99=Round)',
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 99, step_increment: 1 })
    });
    settings.bind('apps-indicator-radius', radRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    indGroup.add(radRow);

    // Color
    const colorRow = new Adw.ActionRow({ title: 'Color' });
    const colorDialog = new Gtk.ColorDialog();
    const colorBtn = new Gtk.ColorDialogButton({
        dialog: colorDialog,
        valign: Gtk.Align.CENTER
    });

    const updateColorBtn = () => {
        const hex = settings.get_string('apps-indicator-color');
        const rgba = new Gdk.RGBA();
        if (rgba.parse(hex)) {
            colorBtn.set_rgba(rgba);
        }
    };
    updateColorBtn();
    
    settings.connect('changed::apps-indicator-color', updateColorBtn);

    colorBtn.connect('notify::rgba', () => {
        const c = colorBtn.get_rgba();
        const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0').toUpperCase();
        const hexStr = `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}`;
        if (hexStr !== settings.get_string('apps-indicator-color')) {
            settings.set_string('apps-indicator-color', hexStr);
        }
    });

    colorRow.add_suffix(colorBtn);
    indGroup.add(colorRow);


    // --- CATEGORY SECTIONS ---
    const createSection = (title, keySuffix) => {
        const group = new Adw.PreferencesGroup({ title: title });
        page.add(group);

        const enableRow = new Adw.SwitchRow({ title: `Show ${title}` });
        settings.bind(`apps-${keySuffix}-enabled`, enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(enableRow);

        const posModel = new Gtk.StringList();
        posModel.append('Left Panel');
        posModel.append('Right Panel');
        const posRow = new Adw.ComboRow({
            title: 'Position',
            model: posModel,
            selected: settings.get_enum(`apps-${keySuffix}-pos`)
        });
        posRow.connect('notify::selected', () => {
            const nick = posRow.selected === 0 ? 'left' : 'right';
            settings.set_value(`apps-${keySuffix}-pos`, new GLib.Variant('s', nick));
        });
        
        settings.connect(`changed::apps-${keySuffix}-pos`, () => {
             const val = settings.get_enum(`apps-${keySuffix}-pos`);
             if (posRow.selected !== val) posRow.selected = val;
        });

        group.add(posRow);

        const idxRow = new Adw.SpinRow({
            title: 'Sort Order',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 20, step_increment: 1 }),
            value: settings.get_int(`apps-${keySuffix}-index`)
        });
        idxRow.connect('notify::value', () => settings.set_int(`apps-${keySuffix}-index`, idxRow.value));
        group.add(idxRow);

        settings.bind(`apps-${keySuffix}-enabled`, posRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        settings.bind(`apps-${keySuffix}-enabled`, idxRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    };

    createSection('Favorites', 'favorites');
    createSection('Running Apps', 'running');
    createSection('Disks', 'disks');
    createSection('Trash', 'trash');

    // --- FAVORITES REORDERING ---
    const favGroup = new Adw.PreferencesGroup({
        title: 'Manage Favorites',
        description: 'Reorder your pinned apps'
    });
    page.add(favGroup);

    const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
    
    const refreshFavs = (manualList = null) => {
        let child = favGroup.get_first_child();
        while(child) {
            const next = child.get_next_sibling();
            favGroup.remove(child);
            child = next;
        }

        const favs = manualList || shellSettings.get_strv('favorite-apps');
        
        favs.forEach((appId, index) => {
            const row = new Adw.ActionRow({ title: appId });
            
            if (index > 0) {
                const upBtn = new Gtk.Button({ icon_name: 'go-up-symbolic', has_frame: false, valign: Gtk.Align.CENTER });
                upBtn.connect('clicked', () => {
                    const newFavs = [...favs];
                    [newFavs[index - 1], newFavs[index]] = [newFavs[index], newFavs[index - 1]];
                    shellSettings.set_strv('favorite-apps', newFavs);
                    refreshFavs(newFavs);
                });
                row.add_suffix(upBtn);
            }

            if (index < favs.length - 1) {
                const downBtn = new Gtk.Button({ icon_name: 'go-down-symbolic', has_frame: false, valign: Gtk.Align.CENTER });
                downBtn.connect('clicked', () => {
                    const newFavs = [...favs];
                    [newFavs[index + 1], newFavs[index]] = [newFavs[index], newFavs[index + 1]];
                    shellSettings.set_strv('favorite-apps', newFavs);
                    refreshFavs(newFavs);
                });
                row.add_suffix(downBtn);
            }

            favGroup.add(row);
        });
    };

    refreshFavs();
    
    return page;
}