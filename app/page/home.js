import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk'; // Required for Clipboard
import { AppConfig } from '../config.js';

let _activeIconChooser = null;

export function createHomeUI(navigator, goToPage) {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // --- 1. HERO / SYSTEM STATUS ---
    const statusGroup = new Adw.PreferencesGroup();
    page.add(statusGroup);

    // Detect Session Type (Wayland/X11)
    const sessionType = GLib.getenv('XDG_SESSION_TYPE') || 'Unknown';
    
    const heroRow = new Adw.ActionRow({
        title: AppConfig.name,
        subtitle: `v${AppConfig.metadata.version} • ${sessionType.toUpperCase()} Session`,
    });
    
    const heroIcon = new Gtk.Image({
        icon_name: 'application-x-executable-symbolic', 
        pixel_size: 32,
        css_classes: ['accent']
    });
    heroRow.add_prefix(heroIcon);

    const copyBtn = new Gtk.Button({
        icon_name: 'edit-copy-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat', 'circular'],
        tooltip_text: `Copy UUID: ${AppConfig.uuid}`
    });
    copyBtn.connect('clicked', () => {
        const clipboard = Gdk.Display.get_default().get_clipboard();
        clipboard.set(AppConfig.uuid);
    });
    heroRow.add_suffix(copyBtn);

    statusGroup.add(heroRow);


    // --- 2. GLOBAL INDICATOR SETTINGS ---
    const indicatorGroup = new Adw.PreferencesGroup({
        title: 'Panel Indicator',
        description: 'Control the main menu icon in the top bar'
    });
    page.add(indicatorGroup);

    const indEnableRow = new Adw.SwitchRow({
        title: 'Show Indicator',
        subtitle: 'Toggle visibility'
    });
    settings.bind('indicator-enabled', indEnableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    indicatorGroup.add(indEnableRow);

    // Pass the enable row to bind sensitivity (dim when disabled)
    const iconRow = _createIconSelector(settings);
    settings.bind('indicator-enabled', iconRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    indicatorGroup.add(iconRow);


    // --- 3. FEATURE SHORTCUTS ---
    const navGroup = new Adw.PreferencesGroup({
        title: 'Features',
        description: 'Quick access to core modules'
    });
    page.add(navGroup);

    navGroup.add(_createNavRow(
        'Wallpaper Engine', 
        'Manage dual-mode backgrounds', 
        'preferences-desktop-wallpaper-symbolic', 
        'wallpaper',
        goToPage
    ));

    navGroup.add(_createNavRow(
        'Window Styles', 
        'Inject custom CSS themes', 
        'preferences-desktop-theme-symbolic', 
        'themes',
        goToPage
    ));

    navGroup.add(_createNavRow(
        'Show Apps Button', 
        'Customize the app grid button', 
        'view-app-grid-symbolic', 
        'showapps',
        goToPage
    ));

    return page;
}

function _createNavRow(title, desc, icon, targetId, goToPage) {
    const row = new Adw.ActionRow({
        title: title,
        subtitle: desc,
        activatable: true
    });
    const img = new Gtk.Image({ icon_name: icon });
    row.add_prefix(img);
    row.add_suffix(new Gtk.Image({ icon_name: 'go-next-symbolic' }));
    
    row.connect('activated', () => {
        if (goToPage) goToPage(targetId);
    });
    return row;
}

function _createIconSelector(settings) {
    const row = new Adw.ActionRow({
        title: 'Custom Icon',
        subtitle: 'Default'
    });

    const previewIcon = new Gtk.Image({
        pixel_size: 24,
        icon_name: 'image-x-generic-symbolic'
    });
    row.add_prefix(previewIcon);

    const updateUi = () => {
        const path = settings.get_string('indicator-custom-icon');
        
        if (path && path.length > 0) {
            try {
                const file = Gio.File.new_for_path(path);
                row.set_subtitle(file.get_basename());
                const gicon = new Gio.FileIcon({ file: file });
                previewIcon.set_from_gicon(gicon);
            } catch (e) {
                row.set_subtitle('Invalid Path');
                previewIcon.set_from_icon_name('dialog-error-symbolic');
            }
        } else {
            row.set_subtitle('Default');
            const defaultPath = GLib.build_filenamev([AppConfig.path, 'app', 'icon', 'panel-symbolic.svg']);
            if (GLib.file_test(defaultPath, GLib.FileTest.EXISTS)) {
                const gicon = Gio.icon_new_for_string(defaultPath);
                previewIcon.set_from_gicon(gicon);
            } else {
                previewIcon.set_from_icon_name('emblem-photos-symbolic');
            }
        }
    };

    updateUi();

    const box = new Gtk.Box({ spacing: 6, valign: Gtk.Align.CENTER });
    row.add_suffix(box);

    // FIX: Using 'view-refresh-symbolic' for a cleaner "Reset/Restore" look
    const resetBtn = new Gtk.Button({
        icon_name: 'view-refresh-symbolic', 
        tooltip_text: 'Reset to Default',
        css_classes: ['flat']
    });
    resetBtn.connect('clicked', () => {
        settings.set_string('indicator-custom-icon', '');
        updateUi();
    });
    box.append(resetBtn);

    const folderBtn = new Gtk.Button({
        icon_name: 'folder-open-symbolic',
        css_classes: ['flat'],
        tooltip_text: 'Select File'
    });
    
    folderBtn.connect('clicked', () => {
        if (_activeIconChooser) {
            try { _activeIconChooser.present(); } catch(e) { _activeIconChooser = null; }
            return;
        }

        const dialog = new Gtk.FileChooserNative({
            title: 'Select Panel Icon',
            action: Gtk.FileChooserAction.OPEN,
            transient_for: folderBtn.get_root(),
            modal: true
        });

        const filter = new Gtk.FileFilter();
        filter.set_name("Images");
        filter.add_mime_type("image/svg+xml");
        filter.add_mime_type("image/png");
        dialog.add_filter(filter);

        _activeIconChooser = dialog;

        dialog.connect('response', (d, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = d.get_file();
                const path = file.get_path();
                settings.set_string('indicator-custom-icon', path);
                updateUi();
            }
            d.destroy();
            _activeIconChooser = null;
        });

        dialog.show();
    });
    box.append(folderBtn);

    return row;
}