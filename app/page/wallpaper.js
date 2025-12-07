import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import { logError } from '../util/logger.js';

// FIX: Global reference to prevent GC closing the dialog
let _activeWallpaperChooser = null;

export function createWallpaperUI() {
    const page = new Adw.PreferencesPage();
    
    // We bind directly to the GNOME System Background Schema
    const bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });

    // --- GROUP 1: IMAGES ---
    const imgGroup = new Adw.PreferencesGroup({ 
        title: 'Background Images',
        description: 'Set different images for Light and Dark modes'
    });
    page.add(imgGroup);

    // Light Mode Image
    imgGroup.add(_createImageRow(bgSettings, 'picture-uri', 'Light Mode Image'));

    // Dark Mode Image
    imgGroup.add(_createImageRow(bgSettings, 'picture-uri-dark', 'Dark Mode Image'));

    // --- GROUP 2: COLORS ---
    const colorGroup = new Adw.PreferencesGroup({ 
        title: 'Solid Colors',
        description: 'Fallback colors when no image is displayed or for filling transparent areas'
    });
    page.add(colorGroup);

    // Primary Color
    colorGroup.add(_createColorRow(bgSettings, 'primary-color', 'Primary Color'));
    
    // Secondary Color
    colorGroup.add(_createColorRow(bgSettings, 'secondary-color', 'Secondary Color'));

    // --- GROUP 3: OPTIONS ---
    const optGroup = new Adw.PreferencesGroup({ title: 'Adjustments' });
    page.add(optGroup);

    // Picture Options (Zoom, Spanned, etc.)
    const optionsRow = new Adw.ComboRow({
        title: 'Picture Style',
        model: new Gtk.StringList({
            strings: ['none', 'wallpaper', 'centered', 'scaled', 'stretched', 'zoom', 'spanned']
        })
    });
    
    // Bind ComboRow to Settings Enum
    bgSettings.bind(
        'picture-options',
        optionsRow,
        'selected-item',
        Gio.SettingsBindFlags.DEFAULT,
        (value) => [value, true], // Variant -> Index
        (v, i) => { // Index -> Variant
             const item = optionsRow.model.get_item(i);
             return item ? item.get_string() : 'zoom';
        }
    );
    
    // Manual sync for initial state
    const currentOpt = bgSettings.get_string('picture-options');
    const model = optionsRow.model;
    for (let i = 0; i < model.get_n_items(); i++) {
        if (model.get_item(i).get_string() === currentOpt) {
            optionsRow.set_selected(i);
            break;
        }
    }
    
    optionsRow.connect('notify::selected-item', () => {
        const i = optionsRow.selected;
        const val = model.get_item(i).get_string();
        bgSettings.set_string('picture-options', val);
    });

    optGroup.add(optionsRow);

    return page;
}

/**
 * Helper: Creates a row with a file chooser button and preview
 */
function _createImageRow(settings, key, title) {
    const row = new Adw.ActionRow({ title: title });
    
    const currentUri = settings.get_string(key);
    
    // Subtitle shows current filename
    try {
        if (currentUri) {
            const file = Gio.File.new_for_uri(currentUri);
            row.set_subtitle(file.get_basename() || currentUri);
        } else {
            row.set_subtitle('No image set');
        }
    } catch(e) { row.set_subtitle(currentUri); }

    // File Chooser Button
    const btn = new Gtk.Button({
        icon_name: 'folder-open-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat']
    });

    btn.connect('clicked', () => {
        // FIX: Prevent opening multiple dialogs or cleaning up active one
        if (_activeWallpaperChooser) {
            try { _activeWallpaperChooser.present(); } catch(e) { _activeWallpaperChooser = null; }
            return;
        }

        // Find parent window for modal behavior
        const root = btn.get_root();

        const dialog = new Gtk.FileChooserNative({
            title: `Select ${title}`,
            action: Gtk.FileChooserAction.OPEN,
            transient_for: root,
            modal: true
        });
        
        const filter = new Gtk.FileFilter();
        filter.set_name("Images");
        filter.add_mime_type("image/png");
        filter.add_mime_type("image/jpeg");
        filter.add_mime_type("image/svg+xml");
        dialog.add_filter(filter);

        // FIX: Hold reference
        _activeWallpaperChooser = dialog;

        dialog.connect('response', (d, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = d.get_file();
                const uri = file.get_uri();
                
                settings.set_string(key, uri);
                row.set_subtitle(file.get_basename());
            }
            d.destroy();
            
            // FIX: Release reference
            _activeWallpaperChooser = null;
        });

        dialog.show();
    });

    row.add_suffix(btn);
    return row;
}

/**
 * Helper: Creates a row with a color dialog button
 */
function _createColorRow(settings, key, title) {
    const row = new Adw.ActionRow({ title: title });

    // GtkColorDialogButton manages its own dialog lifecycle internally,
    // so it doesn't suffer from the same GC issues as manual FileChoosers.
    const colorDialogBtn = new Gtk.ColorDialogButton({
        valign: Gtk.Align.CENTER,
        dialog: new Gtk.ColorDialog()
    });

    const currentHex = settings.get_string(key);
    const rgba = new Gdk.RGBA();
    if (rgba.parse(currentHex)) {
        colorDialogBtn.set_rgba(rgba);
    }

    colorDialogBtn.connect('notify::rgba', () => {
        const c = colorDialogBtn.get_rgba();
        const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        const hexString = `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}`;
        
        settings.set_string(key, hexString);
    });

    row.add_suffix(colorDialogBtn);
    return row;
}