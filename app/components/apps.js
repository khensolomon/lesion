import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib'; 
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js'; 
import { ExtensionComponent } from './base.js';
import { logError } from '../util/logger.js'; 

const PANEL_ICON_SIZE = 16;

// --- BASE BUTTON CLASS ---
const AppPanelButton = GObject.registerClass(
class AppPanelButton extends PanelMenu.Button {
    _init(icon, name, clickCallback, menuCallback) {
        super._init(0.0, name);
        
        this.style = 'min-width: 0px; margin: 0 2px; padding: 0 4px;'; 

        this._box = new St.Widget({ 
            layout_manager: new Clutter.BinLayout(),
            x_expand: true, 
            y_expand: true 
        });
        this.add_child(this._box);

        this.iconActor = icon; 
        this.iconActor.x_align = Clutter.ActorAlign.CENTER;
        this.iconActor.y_align = Clutter.ActorAlign.CENTER;
        this.iconActor.set_pivot_point(0.5, 0.5);
        this._box.add_child(icon);

        this._dot = new St.Widget({
            visible: true, 
            opacity: 0
        });
        this._dot.set_pivot_point(0.5, 0.5);
        this._box.add_child(this._dot);

        this.set_accessible_name(name);

        this._clickCallback = clickCallback;
        this._menuCallback = menuCallback;
        
        this._role = null;
        this._app = null; 
        this._windows = [];
    }

    updateDotStyle(width, height, color, radius) {
        this._dot.width = width;
        this._dot.height = height;
        this._dot.style = `background-color: ${color}; border-radius: ${radius}px;`;
    }

    updateDotLayout(posEnum, offset) {
        this._dot.translation_x = 0;
        this._dot.translation_y = 0;
        
        switch(posEnum) {
            case 0: // Top
                this._dot.x_align = Clutter.ActorAlign.CENTER;
                this._dot.y_align = Clutter.ActorAlign.START;
                this._dot.translation_y = offset; 
                break;
            case 1: // Right
                this._dot.x_align = Clutter.ActorAlign.END;
                this._dot.y_align = Clutter.ActorAlign.CENTER;
                this._dot.translation_x = -offset; 
                break;
            case 2: // Bottom
                this._dot.x_align = Clutter.ActorAlign.CENTER;
                this._dot.y_align = Clutter.ActorAlign.END;
                this._dot.translation_y = -offset;
                break;
            case 3: // Left
                this._dot.x_align = Clutter.ActorAlign.START;
                this._dot.y_align = Clutter.ActorAlign.CENTER;
                this._dot.translation_x = offset;
                break;
        }
    }

    setVisualState(opacity, showDot) {
        this.iconActor.ease({
            opacity: opacity,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        this._dot.ease({
            opacity: showDot ? 255 : 0,
            scale_x: showDot ? 1 : 0,
            scale_y: showDot ? 1 : 0,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_BACK
        });
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            if (button === 1 && this._clickCallback) {
                this._clickCallback();
                return Clutter.EVENT_STOP;
            }
            if (button === 3) {
                if (this._menuCallback) this._menuCallback(this.menu);
                this.menu.toggle();
                return Clutter.EVENT_STOP;
            }
        }
        return super.vfunc_event(event);
    }
});

// --- MAIN MANAGER ---
export class AppsManager extends ExtensionComponent {
    
    onEnable() {
        this._items = { favorites: [], running: [], disks: [], trash: null };
        this._handledWindows = new Set();
        
        this._appSystem = Shell.AppSystem.get_default();
        this._winTracker = Shell.WindowTracker.get_default();
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._windowSignals = new Map();

        // Observers
        // Visual updates only (no rebuild)
        const visualUpdate = () => this._updateVisuals();
        this.observe('changed::apps-icon-size', () => this._rebuildAll()); // Size change needs rebuild
        this.observe('changed::apps-icon-desaturate', () => this._rebuildAll());
        this.observe('changed::apps-opacity-running', visualUpdate);
        this.observe('changed::apps-opacity-stopped', visualUpdate);
        
        ['pos', 'offset', 'width', 'height', 'radius', 'color'].forEach(k => {
            this.observe(`changed::apps-indicator-${k}`, visualUpdate);
        });

        // Structural updates per section
        ['favorites', 'running', 'disks', 'trash'].forEach(g => {
            const rebuild = () => {
                if (g === 'favorites') this._syncFavorites();
                else if (g === 'running') this._syncRunning(true); // Force rebuild
                else if (g === 'disks') this._syncDisks();
                else if (g === 'trash') this._syncTrash();
                this._updateVisuals();
            };
            this.observe(`changed::apps-${g}-enabled`, rebuild);
            this.observe(`changed::apps-${g}-pos`, rebuild);
            this.observe(`changed::apps-${g}-index`, rebuild);
        });

        // System Signals
        const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        this._signals.push({
            obj: shellSettings,
            id: shellSettings.connect('changed::favorite-apps', () => {
                this._syncFavorites();
                // Running apps might need update if exclusion changed
                this._syncRunning(); 
            }) 
        });
        
        this._signals.push({
            obj: this._appSystem,
            id: this._appSystem.connect('installed-changed', () => this._syncRunning(true))
        });

        this._signals.push({
            obj: this._winTracker,
            id: this._winTracker.connect('notify::focus-app', visualUpdate)
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('notify::focus-window', visualUpdate)
        });

        // Window Lifecycle
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-created', (d, w) => {
                this._trackWindow(w);
                this._handleWindowChange();
            })
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-demands-attention', visualUpdate)
        });

        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-added', () => this._syncDisks())
        });
        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-removed', () => this._syncDisks())
        });

        try {
            const trashFile = Gio.File.new_for_uri('trash:///');
            this._trashMonitor = trashFile.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._signals.push({
                obj: this._trashMonitor,
                id: this._trashMonitor.connect('changed', () => {
                    this._syncTrash(); 
                    this._updateVisuals(); 
                })
            });
        } catch (e) {
            console.warn('Lesion: Failed to monitor trash', e);
        }

        global.display.list_all_windows().forEach(win => this._trackWindow(win));

        // Initial Build
        this._rebuildAll();
    }

    onDisable() {
        this._clearAll();
        if (this._windowSignals) {
            for (const [win, ids] of this._windowSignals) {
                ids.forEach(id => { try { win.disconnect(id); } catch(e){} });
            }
            this._windowSignals.clear();
        }
        if (this._trashMonitor) {
            this._trashMonitor.cancel();
            this._trashMonitor = null;
        }
    }

    _trackWindow(win) {
        if (!win || this._windowSignals.has(win)) return;
        const signals = [];

        signals.push(win.connect('unmanaged', () => {
            const ids = this._windowSignals.get(win);
            if (ids) ids.forEach(id => { try { win.disconnect(id); } catch(e){} });
            this._windowSignals.delete(win);
            this._handleWindowChange();
        }));

        signals.push(win.connect('notify::title', () => {
            const app = this._winTracker.get_window_app(win);
            if (app && (app.get_id().includes('nautilus') || app.get_id().includes('org.gnome.Nautilus'))) {
                this._handleWindowChange();
            }
        }));

        this._windowSignals.set(win, signals);
    }

    // Called when window structure changes (Open/Close/Title)
    _handleWindowChange() {
        // Debounce slightly to allow shell to update states
        if (this._updateTimeout) GLib.source_remove(this._updateTimeout);
        this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._updateState();
            this._updateTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _clearAll() {
        this._clearGroup('favorites');
        this._clearGroup('running');
        this._clearGroup('disks');
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            this._items.trash.destroy();
            this._items.trash = null;
        }
    }

    _clearGroup(group) {
        this._items[group].forEach(btn => {
            if (btn._role) delete Main.panel.statusArea[btn._role];
            btn.destroy();
        });
        this._items[group] = [];
    }

    _rebuildAll() {
        this._syncTrash();
        this._syncDisks();
        this._syncFavorites();
        this._syncRunning(true); // Force rebuild
        this._updateVisuals();
    }

    _updateState() {
        // 1. Recalculate Claimed Windows (Trash/Disk/Favorites)
        // We do NOT rebuild buttons for these groups here, we just update internal state
        this._handledWindows.clear();
        
        // Trash
        if (this._items.trash && this.getSettings().get_boolean('apps-trash-enabled')) {
            const fm = this._appSystem.lookup_app('org.gnome.Nautilus.desktop'); 
            if (fm) {
                const wins = fm.get_windows().filter(w => w.get_title().includes('Trash'));
                this._items.trash._windows = wins;
                wins.forEach(w => this._handledWindows.add(w));
            }
        }

        // Disks
        if (this.getSettings().get_boolean('apps-disks-enabled')) {
            const fm = this._appSystem.lookup_app('org.gnome.Nautilus.desktop');
            if (fm) {
                this._items.disks.forEach(btn => {
                    const name = btn.get_accessible_name();
                    const wins = fm.get_windows().filter(w => w.get_title().includes(name));
                    btn._windows = wins;
                    wins.forEach(w => this._handledWindows.add(w));
                });
            }
        }

        // Favorites
        if (this.getSettings().get_boolean('apps-favorites-enabled')) {
            this._items.favorites.forEach(btn => {
                if (btn._app) {
                    btn._app.get_windows().forEach(w => this._handledWindows.add(w));
                }
            });
        }

        // 2. Sync Running Apps (Smart Diff)
        this._syncRunning(false); 

        // 3. Update Visuals
        this._updateVisuals();
    }

    _getIndicatorSettings() {
        return {
            pos: this.getSettings().get_enum('apps-indicator-pos'), 
            offset: this.getSettings().get_int('apps-indicator-offset'),
            width: this.getSettings().get_int('apps-indicator-width'),
            height: this.getSettings().get_int('apps-indicator-height'),
            radius: this.getSettings().get_int('apps-indicator-radius'),
            color: this.getSettings().get_string('apps-indicator-color')
        };
    }

    _applyEffects(icon) {
        if (!icon) return icon;
        const desaturate = this.getSettings().get_boolean('apps-icon-desaturate');
        if (desaturate) {
            const effect = new Clutter.DesaturateEffect({ factor: 1.0 });
            icon.add_effect(effect);
        }
        return icon;
    }

    _isFileManager(app) {
        if (!app) return false;
        const id = app.get_id();
        return id.includes('nautilus') || id.includes('org.gnome.Nautilus');
    }

    _updateVisuals() {
        const ind = this._getIndicatorSettings();
        const opacityRunning = this.getSettings().get_int('apps-opacity-running');
        const opacityStopped = this.getSettings().get_int('apps-opacity-stopped');
        
        const focusWindow = global.display.focus_window;
        let activeCustomBtn = null; 

        // Helper to check custom button focus
        const checkBtnFocus = (btn) => {
            if (!btn || !btn._windows) return false;
            if (focusWindow && btn._windows.includes(focusWindow)) {
                activeCustomBtn = btn;
                return true;
            }
            return false;
        };

        if (this._items.trash) checkBtnFocus(this._items.trash);
        this._items.disks.forEach(checkBtnFocus);

        const apply = (btn, isRunning, isFocused) => {
            if (!btn || !btn.iconActor) return;
            btn.updateDotStyle(ind.width, ind.height, ind.color, ind.radius);
            btn.updateDotLayout(ind.pos, ind.offset);

            if (isFocused) btn.add_style_pseudo_class('active');
            else btn.remove_style_pseudo_class('active');

            let targetOpacity = opacityStopped;
            if (isFocused) targetOpacity = 255;
            else if (isRunning) targetOpacity = opacityRunning;

            btn.setVisualState(targetOpacity, isRunning);
        };

        // Trash
        if (this._items.trash) {
            const running = this._items.trash._windows && this._items.trash._windows.length > 0;
            const focused = (activeCustomBtn === this._items.trash);
            apply(this._items.trash, running, focused);
        }

        // Disks
        this._items.disks.forEach(btn => {
            const running = btn._windows && btn._windows.length > 0;
            const focused = (activeCustomBtn === btn);
            apply(btn, running, focused);
        });
        
        // Favorites
        const focusApp = this._winTracker.focus_app;
        this._items.favorites.forEach(btn => {
            if (btn._app) {
                const running = btn._app.state === Shell.AppState.RUNNING;
                let focused = (focusApp === btn._app);
                if (focused && activeCustomBtn && this._isFileManager(btn._app)) focused = false;
                apply(btn, running, focused);
            }
        });

        // Running
        this._items.running.forEach(btn => {
            if (btn._app) {
                const focused = (focusApp === btn._app);
                apply(btn, true, focused);
            }
        });
    }

    // --- MENU HELPERS ---
    _appendAction(menu, label, callback, destructive = false) {
        const item = new PopupMenu.PopupMenuItem(label);
        if (destructive) item.actor.add_style_class_name('button-destructive-action');
        item.connect('activate', () => callback());
        menu.addMenuItem(item);
    }

    _appendSeparator(menu) {
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _buildContextAwareAppMenu(menu, app, appId, isFavorite) {
        menu.removeAll();
        const isRunning = app.get_n_windows() > 0;
        
        if (!isRunning) {
            this._appendAction(menu, 'Open', () => app.open_new_window(-1));
        } else {
            this._appendAction(menu, 'New Window', () => app.open_new_window(-1));
        }

        const settings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        const favorites = settings.get_strv('favorite-apps');
        const isPinned = favorites.includes(appId);

        this._appendSeparator(menu);
        this._appendAction(menu, isPinned ? 'Unpin from Favorites' : 'Pin to Favorites', () => {
            if (isPinned) {
                const newFavs = favorites.filter(id => id !== appId);
                settings.set_strv('favorite-apps', newFavs);
            } else {
                const newFavs = [...favorites, appId];
                settings.set_strv('favorite-apps', newFavs);
            }
        });

        if (isRunning) {
            this._appendSeparator(menu);
            this._appendAction(menu, 'Quit', () => app.request_quit());
        }
    }

    _confirmEmptyTrash() {
        const dialog = new ModalDialog.ModalDialog();
        dialog.setButtons([
            { label: 'Cancel', action: () => dialog.close(), key: Clutter.KEY_Escape },
            { 
                label: 'Empty Trash', 
                action: () => {
                    dialog.close();
                    try { GLib.spawn_command_line_async('gio trash --empty'); } catch(e) {}
                },
                key: Clutter.KEY_Return
            }
        ]);
        const content = new St.Label({ 
            style_class: 'message-dialog-content',
            text: 'Are you sure you want to delete all items in the Trash?',
            x_align: Clutter.ActorAlign.CENTER
        });
        dialog.contentLayout.add_child(content);
        dialog.open();
    }

    _safelyRemove(mount) {
        const name = mount.get_name();
        const callback = (source, res) => {
            try {
                if (source.eject_with_operation_finish) source.eject_with_operation_finish(res);
                else source.unmount_with_operation_finish(res);
                Main.notify('Safely Removed', `${name} can now be unplugged.`);
            } catch (e) {
                Main.notify('Safely Remove Failed', e.message);
                logError(e, 'Safely Remove Failed');
            }
        };
        if (mount.can_eject()) mount.eject_with_operation(Gio.MountUnmountFlags.NONE, null, null, callback);
        else mount.unmount_with_operation(Gio.MountUnmountFlags.NONE, null, null, callback);
    }

    // --- SECTIONS ---

    _syncTrash() {
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            this._items.trash.destroy();
            this._items.trash = null;
        }
        if (!this.getSettings().get_boolean('apps-trash-enabled')) return;

        // Note: Window handling moved to _updateVisuals via _handledWindows update
        // Here we just build the button structure
        const size = this.getSettings().get_int('apps-icon-size');
        const pos = this._getPos('trash');
        const idx = this._getIndex('trash');

        let gicon = null;
        let isTrashFull = false;
        try {
            const file = Gio.File.new_for_uri('trash:///');
            const enumerator = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            if (enumerator.next_file(null) !== null) isTrashFull = true;
            enumerator.close(null);
            const info = file.query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null);
            if (info) gicon = info.get_icon();
        } catch (e) {}

        if (!gicon) {
             const iconName = isTrashFull ? 'user-trash-full-symbolic' : 'user-trash-symbolic';
             gicon = new Gio.ThemedIcon({ name: iconName });
        }

        const icon = new St.Icon({ gicon: gicon, icon_size: size, style_class: 'system-status-icon' });
        this._applyEffects(icon);
        
        const btn = new AppPanelButton(
            icon, 'Trash',
            () => {
                const wins = btn._windows || [];
                if (wins.length > 0) {
                    const focusWin = wins.find(w => w.has_focus());
                    if (focusWin) wins.forEach(w => w.minimize());
                    else wins[0].activate();
                } else {
                    Gio.AppInfo.launch_default_for_uri('trash:///', null);
                }
            },
            (menu) => {
                menu.removeAll();
                const wins = btn._windows || [];
                if (wins.length > 0) {
                    this._appendAction(menu, 'Close Trash', () => wins.forEach(w => w.delete(global.get_current_time())));
                } else {
                    this._appendAction(menu, 'Open Trash', () => Gio.AppInfo.launch_default_for_uri('trash:///', null));
                }
                if (isTrashFull) {
                    this._appendSeparator(menu);
                    this._appendAction(menu, 'Empty Trash', () => this._confirmEmptyTrash(), true);
                }
            }
        );
        
        const role = 'lesion-trash';
        btn._role = role;
        Main.panel.addToStatusArea(role, btn, idx, pos);
        this._items.trash = btn;
    }

    _syncDisks() {
        this._clearGroup('disks');
        if (!this.getSettings().get_boolean('apps-disks-enabled')) return;

        const mounts = this._volumeMonitor.get_mounts();
        const pos = this._getPos('disks');
        const idx = this._getIndex('disks');
        const size = this.getSettings().get_int('apps-icon-size');
        const seenNames = new Set();

        mounts.forEach((mount, i) => {
            const name = mount.get_name();
            if (seenNames.has(name)) return;
            seenNames.add(name);

            const icon = new St.Icon({ gicon: mount.get_icon(), icon_size: size, style_class: 'system-status-icon' });
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, name,
                () => {
                    const wins = btn._windows || [];
                    if (wins.length > 0) {
                        const focusWin = wins.find(w => w.has_focus());
                        if (focusWin) wins.forEach(w => w.minimize());
                        else wins[0].activate();
                    } else {
                        const f = mount.get_root();
                        Gio.AppInfo.launch_default_for_uri(f.get_uri(), null);
                    }
                },
                (menu) => {
                    menu.removeAll();
                    const wins = btn._windows || [];
                    if (wins.length > 0) {
                        this._appendAction(menu, 'Close', () => wins.forEach(w => w.delete(global.get_current_time())));
                    } else {
                        this._appendAction(menu, 'Open', () => {
                            const f = mount.get_root();
                            Gio.AppInfo.launch_default_for_uri(f.get_uri(), null);
                        });
                    }
                    this._appendSeparator(menu);
                    const actionName = mount.can_eject() ? 'Eject' : 'Unmount';
                    this._appendAction(menu, actionName, () => this._safelyRemove(mount));
                }
            );
            
            const role = `lesion-disk-${i}`;
            btn._role = role;
            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.disks.push(btn);
        });
    }

    _syncFavorites() {
        this._clearGroup('favorites');
        if (!this.getSettings().get_boolean('apps-favorites-enabled')) return;

        const favorites = (new Gio.Settings({ schema_id: 'org.gnome.shell' })).get_strv('favorite-apps');
        const pos = this._getPos('favorites');
        const idx = this._getIndex('favorites');
        const size = this.getSettings().get_int('apps-icon-size');

        favorites.forEach((appId, i) => {
            const app = this._appSystem.lookup_app(appId);
            if (!app) return;

            const icon = app.create_icon_texture(size);
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, app.get_name(),
                () => this._handleAppClick(app),
                (menu) => this._buildContextAwareAppMenu(menu, app, appId, true)
            );
            
            btn._app = app;
            const role = `lesion-fav-${i}`;
            btn._role = role;
            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.favorites.push(btn);
        });
    }

    _syncRunning(forceRebuild = false) {
        if (!this.getSettings().get_boolean('apps-running-enabled')) {
            this._clearGroup('running');
            return;
        }

        const runningApps = this._appSystem.get_running();
        const pos = this._getPos('running');
        const idx = this._getIndex('running');
        const size = this.getSettings().get_int('apps-icon-size');

        const favEnabled = this.getSettings().get_boolean('apps-favorites-enabled');
        let favIds = [];
        if (favEnabled) {
            const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
            favIds = shellSettings.get_strv('favorite-apps');
        }

        // 1. Filter: Determine which apps actually need a button
        const appsToShow = runningApps.filter(app => {
            if (favEnabled && favIds.includes(app.get_id())) return false;
            
            const windows = app.get_windows();
            // If all windows are claimed (by Trash/Disk), don't show
            const hasUnclaimed = windows.some(w => !this._handledWindows.has(w));
            if (!hasUnclaimed && windows.length > 0) return false;
            if (windows.length === 0) return false;
            
            return true;
        });

        // 2. Diffing Strategy: Avoid rebuild if list matches
        // If forceRebuild is true (e.g. icon size changed), skip check
        if (!forceRebuild) {
            const currentIds = this._items.running.map(btn => btn._app ? btn._app.get_id() : '');
            const newIds = appsToShow.map(app => app.get_id());
            
            // Simple array comparison
            const isSame = currentIds.length === newIds.length && currentIds.every((id, index) => id === newIds[index]);
            
            if (isSame) {
                return; // Nothing changed structurally
            }
        }

        // 3. Rebuild
        this._clearGroup('running');

        appsToShow.forEach((app, i) => {
            const icon = app.create_icon_texture(size);
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, app.get_name(),
                () => this._handleAppClick(app),
                (menu) => this._buildContextAwareAppMenu(menu, app, app.get_id(), false)
            );

            btn._app = app;
            const role = `lesion-run-${i}`;
            btn._role = role;
            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.running.push(btn);
        });
    }

    _handleAppClick(app) {
        const windows = app.get_windows();
        if (app.get_n_windows() === 0) {
            app.open_new_window(-1);
        } else {
            if (this._winTracker.focus_app === app) {
                windows.forEach(w => w.minimize());
            } else {
                app.activate();
            }
        }
    }

    _getPos(keySuffix) {
        const key = `apps-${keySuffix}-pos`;
        const value = this.getSettings().get_value(key);
        if (value.is_of_type(new GLib.VariantType('s'))) {
            return value.deep_unpack() === 'right' ? 'right' : 'left'; 
        }
        if (value.is_of_type(new GLib.VariantType('i'))) {
            return value.deep_unpack() === 1 ? 'right' : 'left';
        }
        return 'left';
    }
    
    _getIndex(keySuffix) {
        return this.getSettings().get_int(`apps-${keySuffix}-index`);
    }
}