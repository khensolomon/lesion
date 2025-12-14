import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import { AppConfig } from '../config.js';

export function createGeometryUI() {
    const page = new Adw.PreferencesPage();
    const settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

    // Internal tracker for active widgets
    // Map<WindowID, Adw.ActionRow>
    const activeRows = new Map();
    let emptyStateRow = null;

    // --- SECTION 1: SETTINGS ---
    const mainGroup = new Adw.PreferencesGroup({
        title: 'Settings',
    });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({
        title: 'Enable Geometry Saving',
        subtitle: 'Remember window size and position'
    });
    settings.bind('geometry-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    // --- SECTION 2: DATA LIST ---
    const dataGroup = new Adw.PreferencesGroup({
        title: 'Saved Applications',
        description: 'Manage currently stored window positions'
    });
    page.add(dataGroup);

    // --- HELPER: GET ICON ---
    const getAppIcon = (wmClass) => {
        const iconImage = new Gtk.Image({ pixel_size: 32 });
        
        let appInfo = Gio.DesktopAppInfo.new(`${wmClass}.desktop`);
        if (!appInfo) {
            const lower = wmClass.toLowerCase();
            appInfo = Gio.DesktopAppInfo.new(`${lower}.desktop`);
        }

        if (appInfo) {
            iconImage.set_from_gicon(appInfo.get_icon());
        } else {
            const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            if (theme.has_icon(wmClass)) {
                iconImage.set_from_icon_name(wmClass);
            } else if (theme.has_icon(wmClass.toLowerCase())) {
                iconImage.set_from_icon_name(wmClass.toLowerCase());
            } else {
                iconImage.set_from_icon_name('preferences-system-windows-symbolic');
            }
        }
        return iconImage;
    };

    // --- HELPER: ROBUST UPDATE LIST ---
    const updateList = () => {
        let data = {};
        try {
            data = JSON.parse(settings.get_string('geometry-data')) || {};
        } catch(e) {
            console.error(e);
        }

        const currentKeys = Object.keys(data).sort();
        const currentKeySet = new Set(currentKeys);

        // 1. REMOVE STALE ROWS
        // Check our Memory Map. If a key exists in Map but not in Data, delete it.
        for (const [key, rowWidget] of activeRows.entries()) {
            if (!currentKeySet.has(key)) {
                dataGroup.remove(rowWidget);
                activeRows.delete(key);
            }
        }

        // 2. MANAGE EMPTY STATE
        if (currentKeys.length === 0) {
            if (!emptyStateRow) {
                emptyStateRow = new Adw.ActionRow({
                    title: 'No Saved Windows',
                    subtitle: 'Move windows around to populate this list',
                    activatable: false
                });
                emptyStateRow.add_prefix(new Gtk.Image({ 
                    icon_name: 'edit-copy-symbolic',
                    pixel_size: 24,
                    css_classes: ['dim-label']
                }));
                dataGroup.add(emptyStateRow);
            }
            return; // Done
        } else {
            // We have data, remove empty state if it exists
            if (emptyStateRow) {
                dataGroup.remove(emptyStateRow);
                emptyStateRow = null;
            }
        }

        // 3. UPDATE OR CREATE ROWS
        currentKeys.forEach(key => {
            const info = data[key];
            const subtitleText = `Size: ${info.w}×${info.h} • Pos: ${info.x},${info.y}`;

            if (activeRows.has(key)) {
                // --- UPDATE EXISTING ---
                const row = activeRows.get(key);
                if (row.get_subtitle() !== subtitleText) {
                    row.set_subtitle(subtitleText);
                }
            } else {
                // --- CREATE NEW ---
                const cleanName = key.split('.').pop() || key; 
                const row = new Adw.ActionRow({
                    title: cleanName,
                    subtitle: subtitleText
                });

                row.add_prefix(getAppIcon(key));

                const delBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    has_frame: false,
                    tooltip_text: 'Forget this window'
                });
                delBtn.add_css_class('error');

                delBtn.connect('clicked', () => {
                    // 1. Remove from UI immediately
                    dataGroup.remove(row);
                    activeRows.delete(key);
                    
                    // 2. Remove from Settings
                    const currentData = JSON.parse(settings.get_string('geometry-data'));
                    if (currentData[key]) {
                        delete currentData[key];
                        settings.set_string('geometry-data', JSON.stringify(currentData));
                    }
                    
                    // 3. Trigger check (handles showing empty state if last item gone)
                    // We call updateList logic again via the signal or manually if needed
                    if (activeRows.size === 0) {
                        // Manually show empty state if we deleted the last one
                        // to ensure instant feedback without waiting for settings signal
                        // (Though the signal will fire shortly after)
                    }
                });

                row.add_suffix(delBtn);
                dataGroup.add(row);
                
                // CRITICAL: Save to map
                activeRows.set(key, row);
            }
        });
    };

    // --- INITIAL BUILD ---
    updateList();

    // --- LIVE UPDATES ---
    let updateTimeout = null;
    const changeSignalId = settings.connect('changed::geometry-data', () => {
        if (updateTimeout) return;
        updateTimeout = setTimeout(() => {
            updateList();
            updateTimeout = null;
        }, 100); 
    });

    page.connect('destroy', () => {
        if (changeSignalId) settings.disconnect(changeSignalId);
        activeRows.clear();
    });

    // --- SECTION 3: CLEAR ALL ---
    const clearGroup = new Adw.PreferencesGroup();
    page.add(clearGroup);

    const clearRow = new Adw.ActionRow({
        title: 'Reset Storage',
        subtitle: 'Remove all saved window positions'
    });

    const clearBtn = new Gtk.Button({
        label: 'Clear All',
        valign: Gtk.Align.CENTER,
    });
    clearBtn.add_css_class('destructive-action');

    clearBtn.connect('clicked', () => {
        // Clearing settings will trigger the signal -> updateList()
        // updateList will see 0 keys -> loop activeRows and remove them all.
        settings.set_string('geometry-data', '{}');
    });

    clearRow.add_suffix(clearBtn);
    clearGroup.add(clearRow);

    return page;
}