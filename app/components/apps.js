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
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import { ExtensionComponent } from './base.js';
import { log, logError } from '../util/logger.js'; 

/**
 * Base Button Class for Application Panel Items
 */
class AppPanelButtonBase extends PanelMenu.Button {
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
        
        // DND State
        this._isDraggable = false;
        this._dragged = false;
        this._placeholder = null;
        this._dragMonitor = null;
        this._container = null;
        
        // Effects
        this._desatEffect = new Clutter.DesaturateEffect({ factor: 0.0 });
        this.iconActor.add_effect(this._desatEffect);

        // Cleanup on destruction
        this.connect('destroy', () => this._onDestroy());
    }

    _onDestroy() {
        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }
        if (this._placeholder) {
            this._placeholder.destroy();
            this._placeholder = null;
        }
        this._container = null;
    }

    enableDragging(onDragEndCallback) {
        this._isDraggable = true;
        this._onDragEnd = onDragEndCallback;

        this._draggable = DND.makeDraggable(this, {
            manualMode: false,
            restoreOnSuccess: false, 
            dragActorOpacity: 255
        });

        this._draggable.connect('drag-begin', () => {
            if (this._dragged) return;
            this._dragged = true;

            // Find the BoxLayout container
            this._container = this.get_parent();
            while (this._container && !(this._container instanceof St.BoxLayout)) {
                this._container = this._container.get_parent();
            }
            if (!this._container) {
                this._dragged = false;
                return;
            }

            // Hide original button
            this.visible = false;

            // Create visible placeholder
            this._createPlaceholder();

            // Monitor drag motion
            this._startDragMonitoring();
        });

        this._draggable.connect('drag-cancelled', () => this._finishDrag(true));
        this._draggable.connect('drag-end', () => this._finishDrag(false));
    }

    getDragActor() {
        const clone = new St.Icon({
            gicon: this.iconActor.gicon,
            icon_size: this.iconActor.icon_size || 24,
            opacity: 220
        });
        clone.set_pivot_point(0.5, 0.5);
        return clone;
    }

    getDragActorSource() {
        return this.iconActor;
    }

    _createPlaceholder() {
        if (!this._container) return;

        this._placeholder = new St.Bin({
            style_class: 'app-panel-placeholder',
            style: `
                width: ${this.width}px;
                height: 30px; 
                background-color: rgba(255, 255, 255, 0.1);
            `,
            child: new St.Icon({
                gicon: this.iconActor.gicon,
                icon_size: (this.iconActor.icon_size || 20), 
                opacity: 100, // Ghost effect
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            })
        });
        
        const effect = new Clutter.DesaturateEffect({ factor: 1.0 });
        this._placeholder.child.add_effect(effect);

        let insertBefore = this;
        if (this.get_parent() !== this._container) {
            let p = this.get_parent();
            while(p && p.get_parent() !== this._container) p = p.get_parent();
            if (p) insertBefore = p;
        }
        
        const index = this._container.get_children().indexOf(insertBefore);
        if (index !== -1) {
            this._container.insert_child_at_index(this._placeholder, index);
        }
    }

    _startDragMonitoring() {
        this._dragMonitor = {
            dragMotion: () => {
                if (!this._placeholder || !this._container) return DND.DragMotionResult.CONTINUE;

                const [x, ] = global.get_pointer();
                const children = this._container.get_children();
                let targetIndex = 0;

                const ACTIVATION_RATIO = 0.5;
                let lastIndex = -1;

                for (const child of children) {
                    if (child === this._placeholder || !child.visible) continue;

                    const [childX] = child.get_transformed_position();
                    const childW = child.width;

                    // const triggerX = childX + childW / 2;
                    const triggerX = childX + childW * ACTIVATION_RATIO;

                    if (x < triggerX)
                        break;

                    targetIndex++;
                }

                if (targetIndex !== lastIndex) {
                    try {
                        this._container.set_child_at_index(this._placeholder, targetIndex);
                    } catch (error) {}
                    lastIndex = targetIndex;
                }

                return DND.DragMotionResult.CONTINUE;
            }
        };

        DND.addDragMonitor(this._dragMonitor);
    }

    _finishDrag(cancelled) {
        // Kill drag actor immediately
        if (this._draggable && this._draggable._dragActor) {
            this._draggable._dragActor.destroy();
        }

        this._dragged = false;

        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }

        // Swap visual placeholder with real item
        if (this._placeholder && this._container) {
            const destIndex = this._container.get_children().indexOf(this._placeholder);
            if (destIndex !== -1) {
                let actorToMove = this;
                if (this.get_parent() !== this._container) {
                    let p = this.get_parent();
                    while(p && p.get_parent() !== this._container) p = p.get_parent();
                    if (p) actorToMove = p;
                }
                this._container.set_child_at_index(actorToMove, destIndex);
            }
            
            this._placeholder.destroy();
            this._placeholder = null;
        }

        this.visible = true;
        this.opacity = 255;

        // Trigger save callback in manager
        if (this._onDragEnd && this._container) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this._onDragEnd) this._onDragEnd();
                return GLib.SOURCE_REMOVE;
            });
        }

        this._container = null;
    }

    updateDotStyle(width, height, color, radius) {
        try {
            if (!this.iconActor) return;
            this._dot.width = width;
            this._dot.height = height;
            this._dot.style = `background-color: ${color}; border-radius: ${radius}px;`;
        } catch(e) {}
    }

    updateDotLayout(posEnum, offset) {
        try {
            if (!this.iconActor) return;
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
        } catch(e) {}
    }

    setVisualState(opacity, showDot) {
        try {
            if (!this.iconActor) return;
            if (this._dragged || !this.visible) return;

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
        } catch(e) {}
    }

    vfunc_event(event) {
        try {
            const type = event.type();
            if (type === Clutter.EventType.BUTTON_PRESS) {
                const button = event.get_button();
                if (button === 1) {
                    if (this._isDraggable) return Clutter.EVENT_PROPAGATE;
                    
                    // Consume the press event to prevent default handling (e.g. menu toggle)
                    // but DO NOT execute the callback here. Wait for RELEASE.
                    return Clutter.EVENT_STOP;
                }
                if (button === 3) {
                    if (this._menuCallback) this._menuCallback(this.menu);
                    this.menu.toggle();
                    return Clutter.EVENT_STOP;
                }
            }
            if (type === Clutter.EventType.BUTTON_RELEASE) {
                const button = event.get_button();
                if (button === 1 && !this._dragged && this._clickCallback) {
                    this._clickCallback();
                    return Clutter.EVENT_STOP;
                }
            }
            return super.vfunc_event(event);
        } catch(e) {
            return Clutter.EVENT_PROPAGATE;
        }
    }
}

const AppPanelButton = GObject.registerClass(
    { GTypeName: 'LesionAppPanelButton' },
    AppPanelButtonBase
);

/**
 * Main Extension Component for Managing Apps
 */
export class AppsManager extends ExtensionComponent {
    
    onEnable() {
        this._items = { favorites: [], running: [], disks: [], trash: null };
        this._handledWindows = new Set();
        this._trashName = 'Trash'; // Default fallback
        
        this._appSystem = Shell.AppSystem.get_default();
        this._winTracker = Shell.WindowTracker.get_default();
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._windowSignals = new Map();

        // Pre-fetch trash name once
        try {
            const file = Gio.File.new_for_uri('trash:///');
            const info = file.query_info('standard::display-name', Gio.FileQueryInfoFlags.NONE, null);
            this._trashName = info.get_display_name();
        } catch (e) {}

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
            const rebuild = () => {
                this._rebuildAll();
            };
            this.observe(`changed::apps-${g}-enabled`, rebuild);
            this.observe(`changed::apps-${g}-pos`, rebuild);
            this.observe(`changed::apps-${g}-index`, rebuild);
        });

        const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        this._signals.push({
            obj: shellSettings,
            id: shellSettings.connect('changed::favorite-apps', () => {
                this._syncFavorites();
                this._refreshHandledWindowsMap();
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
            id: this._volumeMonitor.connect('mount-added', () => this._rebuildAll())
        });
        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-removed', () => this._rebuildAll())
        });

        try {
            const trashFile = Gio.File.new_for_uri('trash:///');
            this._trashMonitor = trashFile.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._signals.push({
                obj: this._trashMonitor,
                id: this._trashMonitor.connect('changed', () => {
                    this._syncTrash();
                    this._refreshHandledWindowsMap();
                    this._syncRunning();
                    this._updateVisuals(); 
                })
            });
        } catch (e) {
            console.warn('Lesion: Failed to monitor trash', e);
        }

        global.display.list_all_windows().forEach(win => this._trackWindow(win));

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

    _handleWindowChange() {
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
            try { this._items.trash.destroy(); } catch(e) {}
            this._items.trash = null;
        }
    }

    _clearGroup(group) {
        this._items[group].forEach(btn => {
            if (btn._role) delete Main.panel.statusArea[btn._role];
            try { btn.destroy(); } catch(e) {}
        });
        this._items[group] = [];
    }

    _rebuildAll() {
        this._syncTrash();
        this._syncDisks();
        this._syncFavorites();
        this._refreshHandledWindowsMap(); 
        this._syncRunning(true);
        this._updateVisuals();
    }

    _updateState() {
        this._refreshHandledWindowsMap();
        this._syncRunning(false); 
        this._updateVisuals();
    }

    _refreshHandledWindowsMap() {
        this._handledWindows.clear();

        const running = this._appSystem.get_running();
        
        // Use a broad search for any running app that might hold the windows
        // This avoids issues where the app ID detection is too strict

        if (this._items.trash && this.getSettings().get_boolean('apps-trash-enabled')) {
            let trashWindows = [];
            const trashNameLower = (this._trashName || 'Trash').toLowerCase();
            
            running.forEach(app => {
                const wins = app.get_windows().filter(w => {
                    const title = w.get_title();
                    return title && title.toLowerCase().includes(trashNameLower);
                });
                trashWindows = trashWindows.concat(wins);
            });

            this._items.trash._windows = trashWindows;
            trashWindows.forEach(w => this._handledWindows.add(w));
        }

        if (this.getSettings().get_boolean('apps-disks-enabled')) {
            this._items.disks.forEach(btn => {
                const name = btn.get_accessible_name().toLowerCase();
                let diskWindows = [];
                
                running.forEach(app => {
                    const wins = app.get_windows().filter(w => {
                        const title = w.get_title();
                        return title && title.toLowerCase().includes(name);
                    });
                    diskWindows = diskWindows.concat(wins);
                });

                btn._windows = diskWindows;
                diskWindows.forEach(w => this._handledWindows.add(w));
            });
        }

        if (this.getSettings().get_boolean('apps-favorites-enabled')) {
            this._items.favorites.forEach(btn => {
                if (btn._app) {
                    btn._app.get_windows().forEach(w => this._handledWindows.add(w));
                }
            });
        }
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

        const checkBtnFocus = (btn) => {
            if (!btn || !btn._windows) return false;
            if (focusWindow && btn._windows.some(w => w === focusWindow)) {
                activeCustomBtn = btn;
                return true;
            }
            return false;
        };

        if (this._items.trash) checkBtnFocus(this._items.trash);
        this._items.disks.forEach(checkBtnFocus);

        const apply = (btn, isRunning, isFocused) => {
            try {
                if (!btn || !btn.iconActor || !btn.get_parent()) return;
                if (btn._dragged || btn.visible === false) return;

                btn.updateDotStyle(ind.width, ind.height, ind.color, ind.radius);
                btn.updateDotLayout(ind.pos, ind.offset);

                if (isFocused) btn.add_style_pseudo_class('active');
                else btn.remove_style_pseudo_class('active');

                let targetOpacity = opacityStopped;
                if (isFocused) targetOpacity = 255;
                else if (isRunning) targetOpacity = opacityRunning;

                btn.setVisualState(targetOpacity, isRunning);
            } catch(e) {}
        };

        if (this._items.trash) {
            const running = this._items.trash._windows && this._items.trash._windows.length > 0;
            const focused = (activeCustomBtn === this._items.trash);
            apply(this._items.trash, running, focused);
        }

        this._items.disks.forEach(btn => {
            const running = btn._windows && btn._windows.length > 0;
            const focused = (activeCustomBtn === btn);
            apply(btn, running, focused);
        });
        
        const focusApp = this._winTracker.focus_app;
        this._items.favorites.forEach(btn => {
            if (btn._app) {
                const running = btn._app.state === Shell.AppState.RUNNING;
                let focused = (focusApp === btn._app);
                if (focused && activeCustomBtn && this._isFileManager(btn._app)) focused = false;
                apply(btn, running, focused);
            }
        });

        this._items.running.forEach(btn => {
            if (btn._app) {
                const focused = (focusApp === btn._app);
                apply(btn, true, focused);
            }
        });
    }

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

    _handleDragFinish() {
        if (this._items.favorites.length === 0) return;
        
        let container = null;
        for (const btn of this._items.favorites) {
            let p = btn.get_parent();
            while (p && !(p instanceof St.BoxLayout)) p = p.get_parent();
            if (p) {
                container = p;
                break;
            }
        }
        
        if (!container) return;
        
        const children = container.get_children();
        const newOrder = [];
        
        children.forEach(child => {
            let button = null;
            if (child instanceof AppPanelButton) {
                button = child;
            } else {
                const found = this._items.favorites.find(f => {
                    let p = f.get_parent();
                    while (p) {
                        if (p === child) return true;
                        if (p === container) break;
                        p = p.get_parent();
                    }
                    return false;
                });
                if (found) button = found;
            }

            if (button) {
                const favMatch = this._items.favorites.find(f => f === button);
                if (favMatch && favMatch._app) {
                    newOrder.push(favMatch._app.get_id());
                }
            }
        });
        
        if (newOrder.length === this._items.favorites.length) {
             const settings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
             settings.set_strv('favorite-apps', newOrder);
        } else {
            this._syncFavorites();
        }
    }

    _syncTrash() {
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            try { this._items.trash.destroy(); } catch(e) {}
            this._items.trash = null;
        }
        if (!this.getSettings().get_boolean('apps-trash-enabled')) return;

        const size = this.getSettings().get_int('apps-icon-size');
        const pos = this._getPos('trash');
        const idx = this._getIndex('trash');

        let gicon = null;
        try {
            const file = Gio.File.new_for_uri('trash:///');
            const info = file.query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null);
            if (info && info.has_attribute('standard::icon')) {
                gicon = info.get_icon();
            }
        } catch (e) {}

        if (!gicon) {
             const iconName = 'user-trash-symbolic';
             gicon = new Gio.ThemedIcon({ name: iconName });
        }

        const icon = new St.Icon({ gicon: gicon, icon_size: size, style_class: 'system-status-icon' });
        this._applyEffects(icon);
        
        const btn = new AppPanelButton(
            icon, 'Trash',
            () => {
                const wins = btn._windows || [];
                if (wins.length > 0) {
                    const focusWin = global.display.focus_window;
                    const isFocused = wins.some(w => w === focusWin);
                    
                    if (isFocused) {
                        wins.forEach(w => w.minimize());
                    } else {
                        wins[0].activate(global.get_current_time());
                    }
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
                this._appendSeparator(menu);
                this._appendAction(menu, 'Empty Trash', () => this._confirmEmptyTrash(), true);
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
                        const focusWin = global.display.focus_window;
                        const isFocused = wins.some(w => w === focusWin);
                        
                        if (isFocused) {
                            wins.forEach(w => w.minimize());
                        } else {
                            wins[0].activate(global.get_current_time());
                        }
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
            
            btn.enableDragging(() => this._handleDragFinish());
            
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

        const running = this._appSystem.get_running();
        const pos = this._getPos('running');
        const idx = this._getIndex('running');
        const size = this.getSettings().get_int('apps-icon-size');

        const favEnabled = this.getSettings().get_boolean('apps-favorites-enabled');
        let favIds = [];
        if (favEnabled) {
            const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
            favIds = shellSettings.get_strv('favorite-apps');
        }

        const appsToShow = running.filter(app => {
            if (favEnabled && favIds.includes(app.get_id())) return false;
            
            const windows = app.get_windows();
            const hasUnclaimed = windows.some(w => !this._handledWindows.has(w));
            
            if (!hasUnclaimed && windows.length > 0) return false;
            if (windows.length === 0) return false;
            return true;
        });

        if (!forceRebuild) {
            const currentIds = this._items.running.map(btn => btn._app ? btn._app.get_id() : '');
            const newIds = appsToShow.map(app => app.get_id());
            const isSame = currentIds.length === newIds.length && currentIds.every((id, index) => id === newIds[index]);
            if (isSame) return; 
        }

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