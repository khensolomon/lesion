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

// Define a standard size for panel icons
const PANEL_ICON_SIZE = 16;

// --- BASE BUTTON CLASS ---
const AppPanelButton = GObject.registerClass(
class AppPanelButton extends PanelMenu.Button {
    _init(icon, name, clickCallback, menuCallback) {
        super._init(0.0, name);
        
        // FORCE CONSISTENCY: 
        // 1. Reset min-width to 0 (Themes often enforce ~30px, causing uneven gaps)
        // 2. Standardize margin/padding for both Left and Right panel boxes
        this.style = 'min-width: 0px; margin: 0 0px; padding: 0 4px;'; 

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
        const updateAll = () => this._updateState();
        const visualUpdate = () => this._updateVisuals();

        this.observe('changed::apps-icon-size', updateAll);
        this.observe('changed::apps-icon-desaturate', updateAll);
        this.observe('changed::apps-opacity-running', visualUpdate);
        this.observe('changed::apps-opacity-stopped', visualUpdate);
        
        ['pos', 'offset', 'width', 'height', 'radius', 'color'].forEach(k => {
            this.observe(`changed::apps-indicator-${k}`, visualUpdate);
        });

        ['favorites', 'running', 'disks', 'trash'].forEach(g => {
            this.observe(`changed::apps-${g}-enabled`, updateAll);
            this.observe(`changed::apps-${g}-pos`, updateAll);
            this.observe(`changed::apps-${g}-index`, updateAll);
        });

        // Signals
        const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        this._signals.push({
            obj: shellSettings,
            id: shellSettings.connect('changed::favorite-apps', updateAll) 
        });
        
        this._signals.push({
            obj: this._appSystem,
            id: this._appSystem.connect('installed-changed', updateAll)
        });

        this._signals.push({
            obj: this._winTracker,
            id: this._winTracker.connect('notify::focus-app', visualUpdate)
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-created', (d, w) => {
                this._trackWindow(w);
                updateAll();
            })
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-demands-attention', visualUpdate)
        });

        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-added', updateAll)
        });
        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-removed', updateAll)
        });

        // Monitor Trash Changes
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

        this._updateState();
    }

    onDisable() {
        this._clearAll();
        if (this._windowSignals) {
            for (const [win, id] of this._windowSignals) {
                try { win.disconnect(id); } catch(e) {}
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
        const id = win.connect('unmanaged', () => {
            this._windowSignals.delete(win);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                this._updateState(); 
                return GLib.SOURCE_REMOVE;
            });
        });
        this._windowSignals.set(win, id);
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

    _updateState() {
        this._handledWindows.clear();
        this._syncTrash();
        this._syncDisks();
        this._syncFavorites();
        this._syncRunning();
        this._updateVisuals();
    }

    // --- VISUALS ---

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

    _updateVisuals() {
        const ind = this._getIndicatorSettings();
        const opacityRunning = this.getSettings().get_int('apps-opacity-running');
        const opacityStopped = this.getSettings().get_int('apps-opacity-stopped');
        const focusApp = this._winTracker.focus_app;

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

        if (this._items.trash) apply(this._items.trash, this._items.trash._manualRunning, this._items.trash._manualFocused);
        this._items.disks.forEach(btn => apply(btn, btn._manualRunning, btn._manualFocused));
        
        this._items.favorites.forEach(btn => {
            if (btn._app) {
                const running = btn._app.state === Shell.AppState.RUNNING;
                const focused = focusApp === btn._app;
                apply(btn, running, focused);
            }
        });

        this._items.running.forEach(btn => {
            if (btn._app) {
                const focused = focusApp === btn._app;
                apply(btn, true, focused);
            }
        });
    }

    // --- MENU HELPERS ---

    _appendAction(menu, label, callback, destructive = false) {
        const item = new PopupMenu.PopupMenuItem(label);
        if (destructive) item.actor.add_style_class_name('button-destructive-action');
        item.connect('activate', () => {
            callback();
        });
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
            { 
                label: 'Cancel', 
                action: () => dialog.close(), 
                key: Clutter.KEY_Escape 
            },
            { 
                label: 'Empty Trash', 
                action: () => {
                    dialog.close();
                    try {
                        GLib.spawn_command_line_async('gio trash --empty');
                    } catch(e) {
                        logError(e, 'Failed to empty trash');
                    }
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
                if (source.eject_with_operation_finish)
                    source.eject_with_operation_finish(res);
                else
                    source.unmount_with_operation_finish(res);
                
                // Show Success Notification
                Main.notify('Safely Removed', `${name} can now be unplugged.`);
            } catch (e) {
                Main.notify('Safely Remove Failed', e.message);
                logError(e, 'Safely Remove Failed');
            }
        };

        if (mount.can_eject()) {
            mount.eject_with_operation(Gio.MountUnmountFlags.NONE, null, null, callback);
        } else {
            mount.unmount_with_operation(Gio.MountUnmountFlags.NONE, null, null, callback);
        }
    }

    // --- TRASH ---
    _syncTrash() {
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            this._items.trash.destroy();
            this._items.trash = null;
        }

        if (!this.getSettings().get_boolean('apps-trash-enabled')) return;

        let trashWindows = [];
        const fileManager = this._appSystem.lookup_app('org.gnome.Nautilus.desktop'); 
        if (fileManager) {
            fileManager.get_windows().forEach(w => {
                if (w.get_title().includes('Trash')) {
                    trashWindows.push(w);
                    this._handledWindows.add(w);
                }
            });
        }

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
                if (trashWindows.length > 0) {
                    const focusWin = trashWindows.find(w => w.has_focus());
                    if (focusWin) trashWindows.forEach(w => w.minimize());
                    else trashWindows[0].activate();
                } else {
                    Gio.AppInfo.launch_default_for_uri('trash:///', null);
                }
            },
            (menu) => {
                menu.removeAll();
                if (trashWindows.length > 0) {
                    this._appendAction(menu, 'Close Trash', () => trashWindows.forEach(w => w.delete(global.get_current_time())));
                } else {
                    this._appendAction(menu, 'Open Trash', () => Gio.AppInfo.launch_default_for_uri('trash:///', null));
                }
                
                if (isTrashFull) {
                    this._appendSeparator(menu);
                    this._appendAction(menu, 'Empty Trash', () => this._confirmEmptyTrash(), true);
                }
            }
        );
        
        btn._windows = trashWindows;
        btn._manualRunning = trashWindows.length > 0;
        btn._manualFocused = trashWindows.some(w => w.has_focus());

        const role = 'lesion-trash';
        btn._role = role;
        Main.panel.addToStatusArea(role, btn, idx, pos);
        this._items.trash = btn;
    }

    // --- DISKS ---
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

            let mountWindows = [];
            const fileManager = this._appSystem.lookup_app('org.gnome.Nautilus.desktop');
            if (fileManager) {
                fileManager.get_windows().forEach(w => {
                    if (w.get_title().includes(name)) {
                        mountWindows.push(w);
                        this._handledWindows.add(w);
                    }
                });
            }

            const icon = new St.Icon({ gicon: mount.get_icon(), icon_size: size, style_class: 'system-status-icon' });
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, name,
                () => {
                    if (mountWindows.length > 0) {
                        const focusWin = mountWindows.find(w => w.has_focus());
                        if (focusWin) mountWindows.forEach(w => w.minimize());
                        else mountWindows[0].activate();
                    } else {
                        const f = mount.get_root();
                        Gio.AppInfo.launch_default_for_uri(f.get_uri(), null);
                    }
                },
                (menu) => {
                    menu.removeAll();
                    if (mountWindows.length > 0) {
                        this._appendAction(menu, 'Close', () => mountWindows.forEach(w => w.delete(global.get_current_time())));
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
            
            btn._windows = mountWindows;
            btn._manualRunning = mountWindows.length > 0;
            btn._manualFocused = mountWindows.some(w => w.has_focus());

            const role = `lesion-disk-${i}`;
            btn._role = role;
            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.disks.push(btn);
        });
    }

    // --- FAVORITES ---
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

            app.get_windows().forEach(w => this._handledWindows.add(w));

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

    // --- RUNNING ---
    _syncRunning() {
        this._clearGroup('running');
        if (!this.getSettings().get_boolean('apps-running-enabled')) return;

        const running = this._appSystem.get_running();
        const pos = this._getPos('running');
        const idx = this._getIndex('running');
        const size = this.getSettings().get_int('apps-icon-size');

        running.forEach((app, i) => {
            const windows = app.get_windows();
            const hasUnclaimed = windows.some(w => !this._handledWindows.has(w));

            if (!hasUnclaimed && windows.length > 0) return;
            if (windows.length === 0) return;

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