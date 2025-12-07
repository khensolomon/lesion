import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js';

let _activeIconChooser = null;

export function createShowAppsUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- SECTION 1: GENERAL ---
    const mainGroup = new Adw.PreferencesGroup({ 
        title: 'General',
        description: 'Main functionality settings' 
    });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({
        title: 'Enable Show Apps Button',
        subtitle: 'Show a dedicated button in the top panel'
    });
    settings.bind('showapps-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    // --- SECTION 2: BEHAVIOR ---
    const behaviorGroup = new Adw.PreferencesGroup({ 
        title: 'Behavior',
        description: 'Configure placement and interaction' 
    });
    page.add(behaviorGroup);

    // 1. Position Selector
    const posRow = new Adw.ComboRow({
        title: 'Position',
        subtitle: 'Location relative to "Activities"',
        model: new Gtk.StringList({
            strings: ['Replace Activities', 'After Activities', 'Before Activities']
        })
    });
    
    const currentPos = settings.get_enum('showapps-position');
    posRow.set_selected(currentPos);

    posRow.connect('notify::selected', () => {
        const index = posRow.get_selected();
        settings.set_enum('showapps-position', index);
    });

    behaviorGroup.add(posRow);

    // 2. Action Selector
    const actionRow = new Adw.ComboRow({
        title: 'Button Action',
        subtitle: 'What happens when clicked',
        model: new Gtk.StringList({
            strings: ['Toggle Overview', 'Show Applications Grid']
        })
    });

    const currentAction = settings.get_enum('showapps-action');
    actionRow.set_selected(currentAction);

    actionRow.connect('notify::selected', () => {
        const index = actionRow.get_selected();
        settings.set_enum('showapps-action', index);
    });

    behaviorGroup.add(actionRow);

    // --- SECTION 3: APPEARANCE ---
    const appearGroup = new Adw.PreferencesGroup({ 
        title: 'Appearance',
        description: 'Customize the visual style' 
    });
    page.add(appearGroup);

    // Custom Icon Selector (Pass enableRow for sensitivity binding)
    const iconRow = _createIconRow(settings);
    settings.bind('showapps-enabled', iconRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    appearGroup.add(iconRow);

    return page;
}

function _createIconRow(settings) {
    const row = new Adw.ActionRow({
        title: 'Custom Icon',
        subtitle: 'Select an image file (SVG/PNG)'
    });

    const currentPath = settings.get_string('showapps-custom-icon');
    _updateSubtitle(row, currentPath);

    const btnBox = new Gtk.Box({ spacing: 6, valign: Gtk.Align.CENTER });
    row.add_suffix(btnBox);

    // FIX: Consistent "Reset" icon
    const resetBtn = new Gtk.Button({
        icon_name: 'view-refresh-symbolic',
        tooltip_text: 'Reset to Default',
        css_classes: ['flat']
    });
    resetBtn.connect('clicked', () => {
        settings.set_string('showapps-custom-icon', '');
        _updateSubtitle(row, '');
    });
    btnBox.append(resetBtn);

    const selectBtn = new Gtk.Button({
        icon_name: 'folder-open-symbolic',
        css_classes: ['flat']
    });
    
    selectBtn.connect('clicked', () => {
        if (_activeIconChooser) {
            try { _activeIconChooser.present(); } catch(e) { _activeIconChooser = null; }
            return;
        }

        const dialog = new Gtk.FileChooserNative({
            title: 'Select Icon',
            action: Gtk.FileChooserAction.OPEN,
            transient_for: selectBtn.get_root(),
            modal: true
        });

        const filter = new Gtk.FileFilter();
        filter.set_name("Images");
        filter.add_mime_type("image/svg+xml");
        filter.add_mime_type("image/png");
        filter.add_mime_type("image/jpeg");
        dialog.add_filter(filter);

        _activeIconChooser = dialog;

        dialog.connect('response', (d, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = d.get_file();
                const path = file.get_path();
                settings.set_string('showapps-custom-icon', path);
                _updateSubtitle(row, path);
            }
            d.destroy();
            _activeIconChooser = null;
        });

        dialog.show();
    });
    btnBox.append(selectBtn);

    return row;
}

function _updateSubtitle(row, path) {
    if (path && path.length > 0) {
        try {
            const file = Gio.File.new_for_path(path);
            row.set_subtitle(file.get_basename());
        } catch (e) {
            row.set_subtitle(path);
        }
    } else {
        row.set_subtitle('Default (start-here-symbolic)');
    }
}