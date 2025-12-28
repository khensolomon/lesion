import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib'; 
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { ExtensionComponent } from './base.js';

// --- BASE BUTTON CLASS ---
const AppPanelButton = GObject.registerClass(
class AppPanelButton extends PanelMenu.Button {
    _init(icon, name, clickCallback, rightClickCallback) {
        super._init(0.0, name);
        
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
        this._rightClickCallback = rightClickCallback;
        
        this._role = null;
        this._app = null; 
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
                if (this._rightClickCallback) this._rightClickCallback(); 
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
        this._appSystem = Shell.AppSystem.get_default();
        this._winTracker = Shell.WindowTracker.get_default();
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._windowSignals = new Map();

        // Observers
        this.observe('changed::apps-icon-size', () => this._refreshAll());
        this.observe('changed::apps-icon-desaturate', () => this._refreshAll());
        this.observe('changed::apps-opacity-running', () => this._updateRunningStatus());
        this.observe('changed::apps-opacity-stopped', () => this._updateRunningStatus());
        
        this.observe('changed::apps-indicator-pos', () => this._refreshAll());
        this.observe('changed::apps-indicator-offset', () => this._refreshAll());
        this.observe('changed::apps-indicator-width', () => this._refreshAll());
        this.observe('changed::apps-indicator-height', () => this._refreshAll());
        this.observe('changed::apps-indicator-radius', () => this._refreshAll());
        this.observe('changed::apps-indicator-color', () => this._refreshAll());

        const groups = ['favorites', 'running', 'disks', 'trash'];
        groups.forEach(g => {
            this.observe(`changed::apps-${g}-enabled`, () => this._refreshAll());
            this.observe(`changed::apps-${g}-pos`, () => this._refreshAll());
            this.observe(`changed::apps-${g}-index`, () => this._refreshAll());
        });

        // Signals
        const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        this._signals.push({
            obj: shellSettings,
            id: shellSettings.connect('changed::favorite-apps', () => this._refreshAll()) 
        });
        
        this._signals.push({
            obj: this._appSystem,
            id: this._appSystem.connect('installed-changed', () => this._syncRunning())
        });

        this._signals.push({
            obj: this._winTracker,
            id: this._winTracker.connect('notify::focus-app', () => this._updateRunningStatus())
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-created', (display, window) => {
                this._trackWindow(window);
                this._syncRunning(); 
                this._updateRunningStatus();
            })
        });
        
        this._signals.push({
            obj: global.display,
            id: global.display.connect('window-demands-attention', () => this._updateRunningStatus())
        });

        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-added', () => this._syncDisks())
        });
        this._signals.push({
            obj: this._volumeMonitor,
            id: this._volumeMonitor.connect('mount-removed', () => this._syncDisks())
        });

        global.display.list_all_windows().forEach(win => this._trackWindow(win));

        this._refreshAll();
    }

    onDisable() {
        this._clearGroup('favorites');
        this._clearGroup('running');
        this._clearGroup('disks');
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            this._items.trash.destroy();
            this._items.trash = null;
        }
        if (this._windowSignals) {
            for (const [win, id] of this._windowSignals) {
                try { win.disconnect(id); } catch(e) {}
            }
            this._windowSignals.clear();
        }
    }

    _trackWindow(win) {
        if (!win || this._windowSignals.has(win)) return;
        const id = win.connect('unmanaged', () => {
            this._windowSignals.delete(win);
            // Delay slightly to let AppSystem update window counts
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                this._syncRunning();
                this._updateRunningStatus(); 
                return GLib.SOURCE_REMOVE;
            });
        });
        this._windowSignals.set(win, id);
    }

    _clearGroup(group) {
        this._items[group].forEach(btn => {
            if (btn._role) delete Main.panel.statusArea[btn._role];
            btn.destroy();
        });
        this._items[group] = [];
    }

    _refreshAll() {
        this._syncFavorites();
        this._syncRunning();
        this._syncDisks();
        this._syncTrash();
    }

    _getPos(keySuffix) {
        const key = `apps-${keySuffix}-pos`;
        const value = this.getSettings().get_value(key);
        if (value.is_of_type(new GLib.VariantType('s'))) {
            const str = value.deep_unpack();
            return str === 'right' ? 'right' : 'left'; 
        }
        if (value.is_of_type(new GLib.VariantType('i'))) {
            const val = value.deep_unpack();
            return val === 1 ? 'right' : 'left';
        }
        return 'left';
    }
    
    _getIndex(keySuffix) {
        return this.getSettings().get_int(`apps-${keySuffix}-index`);
    }

    _getIconSize() {
        return this.getSettings().get_int('apps-icon-size');
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

    _updateButtonVisuals(btn, app) {
        if (!btn || !btn.iconActor) return;

        const isRunning = app.state === Shell.AppState.RUNNING;
        const isFocused = this._winTracker.focus_app === app;
        const opacityRunning = this.getSettings().get_int('apps-opacity-running');
        const opacityStopped = this.getSettings().get_int('apps-opacity-stopped');

        if (isFocused) btn.add_style_pseudo_class('active');
        else btn.remove_style_pseudo_class('active');

        let targetOpacity = opacityStopped;
        if (isFocused) targetOpacity = 255;
        else if (isRunning) targetOpacity = opacityRunning;

        btn.setVisualState(targetOpacity, isRunning);
    }

    _configureButton(btn) {
        const ind = this._getIndicatorSettings();
        btn.updateDotStyle(ind.width, ind.height, ind.color, ind.radius);
        btn.updateDotLayout(ind.pos, ind.offset);
    }

    // --- FAVORITES ---
    _syncFavorites() {
        this._clearGroup('favorites');
        if (!this.getSettings().get_boolean('apps-favorites-enabled')) return;

        const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        const favorites = shellSettings.get_strv('favorite-apps');
        const pos = this._getPos('favorites');
        const idx = this._getIndex('favorites');
        const size = this._getIconSize();

        favorites.forEach((appId, i) => {
            const app = this._appSystem.lookup_app(appId);
            if (!app) return;

            const icon = app.create_icon_texture(size);
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, 
                app.get_name(), 
                () => this._handleAppClick(app),
                () => this._buildAppMenu(btn.menu, app)
            );
            this._configureButton(btn);
            
            btn._app = app;
            this._updateButtonVisuals(btn, app);

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
        const size = this._getIconSize();

        const favEnabled = this.getSettings().get_boolean('apps-favorites-enabled');
        let favIds = [];
        if (favEnabled) {
            const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
            favIds = shellSettings.get_strv('favorite-apps');
        }

        running.forEach((app, i) => {
            if (favEnabled && favIds.includes(app.get_id())) return;
            if (app.get_n_windows() === 0) return;

            const icon = app.create_icon_texture(size);
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon, 
                app.get_name(), 
                () => this._handleAppClick(app),
                () => this._buildAppMenu(btn.menu, app)
            );
            this._configureButton(btn);

            btn._app = app;
            this._updateButtonVisuals(btn, app);

            const role = `lesion-run-${i}`;
            btn._role = role;

            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.running.push(btn);
        });
    }
    
    _updateRunningStatus() {
        this._items.favorites.forEach(btn => {
            if (btn._app) this._updateButtonVisuals(btn, btn._app);
        });
        this._items.running.forEach(btn => {
            if (btn._app) this._updateButtonVisuals(btn, btn._app);
        });
    }

    _handleAppClick(app) {
        const windows = app.get_windows();
        if (app.state !== Shell.AppState.RUNNING || windows.length === 0) {
            app.open_new_window(-1);
        } else {
            if (this._winTracker.focus_app === app) {
                windows.forEach(w => w.minimize());
            } else {
                app.activate();
            }
        }
    }

    _buildAppMenu(menu, app) {
        menu.removeAll();
        menu.addAction('New Window', () => app.open_new_window(-1));
        menu.addAction('Quit', () => app.request_quit());
    }

    // --- DISKS ---
    _syncDisks() {
        this._clearGroup('disks');
        if (!this.getSettings().get_boolean('apps-disks-enabled')) return;

        const mounts = this._volumeMonitor.get_mounts();
        const pos = this._getPos('disks');
        const idx = this._getIndex('disks');
        const size = this._getIconSize();

        mounts.forEach((mount, i) => {
            const icon = new St.Icon({ gicon: mount.get_icon(), icon_size: size, style_class: 'system-status-icon' });
            this._applyEffects(icon);

            const btn = new AppPanelButton(
                icon,
                mount.get_name(),
                () => {
                    const f = mount.get_root();
                    Gio.AppInfo.launch_default_for_uri(f.get_uri(), null);
                },
                () => {
                    const menu = btn.menu;
                    menu.removeAll();
                    menu.addAction('Unmount', () => {
                        mount.unmount_with_operation(0, null, null, null);
                    });
                }
            );
            this._configureButton(btn);

            const role = `lesion-disk-${i}`;
            btn._role = role;

            Main.panel.addToStatusArea(role, btn, idx + i, pos);
            this._items.disks.push(btn);
        });
    }

    // --- TRASH ---
    _syncTrash() {
        if (this._items.trash) {
            if (this._items.trash._role) delete Main.panel.statusArea[this._items.trash._role];
            this._items.trash.destroy();
            this._items.trash = null;
        }

        if (!this.getSettings().get_boolean('apps-trash-enabled')) return;

        const pos = this._getPos('trash');
        const idx = this._getIndex('trash');
        const size = this._getIconSize();
        
        let gicon = null;
        try {
            const file = Gio.File.new_for_uri('trash:///');
            const info = file.query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null);
            if (info && info.has_attribute('standard::icon')) {
                gicon = info.get_icon();
            }
        } catch (e) {}

        if (!gicon) {
            gicon = new Gio.ThemedIcon({ name: 'user-trash-symbolic' });
        }

        const icon = new St.Icon({ gicon: gicon, icon_size: size, style_class: 'system-status-icon' });
        this._applyEffects(icon);
        
        const btn = new AppPanelButton(
            icon,
            'Trash',
            () => Gio.AppInfo.launch_default_for_uri('trash:///', null),
            () => {
                const menu = btn.menu;
                menu.removeAll();
                menu.addAction('Empty Trash', () => Gio.AppInfo.launch_default_for_uri('trash:///', null));
            }
        );
        this._configureButton(btn);

        const role = 'lesion-trash';
        btn._role = role;

        Main.panel.addToStatusArea(role, btn, idx, pos);
        this._items.trash = btn;
    }
}