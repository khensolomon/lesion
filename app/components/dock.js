import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import { ExtensionComponent } from './base.js';
import { log, logError } from '../util/logger.js';

export class DockManager extends ExtensionComponent {
    
    onEnable() {
        log("DockManager enabled");
        this._dash = Main.overview.dash;
        this._originalParent = this._dash.get_parent();
        this._dockContainer = null;
        this._monitorsChangedId = null;
        this._iconSizeId = null;

        // Apply
        this._sync();

        const settingsKeys = [
            'dock-enabled', 'dock-position', 'dock-panel-mode', 
            'dock-icon-size', 'dock-radius', 'dock-opacity', 
            'dock-color', 'dock-autohide'
        ];
        
        settingsKeys.forEach(key => {
            this.observe(`changed::${key}`, () => this._sync());
        });

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this._updatePosition());
        
        // WATCHER: If Dash tries to reset icon size (e.g. via _adjustIconSize), force it back
        this._iconSizeId = this._dash.connect('notify::icon-size', () => {
            const settings = this.getSettings();
            if (settings) {
                const target = settings.get_int('dock-icon-size');
                if (this._dash.iconSize !== target) {
                    this._dash.iconSize = target;
                    this._updateIconSizes(); // Re-apply to children
                }
            }
        });
    }

    onDisable() {
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if (this._iconSizeId) {
            this._dash.disconnect(this._iconSizeId);
            this._iconSizeId = null;
        }
        this._restore();
    }

    _sync() {
        const settings = this.getSettings();
        const enabled = settings.get_boolean('dock-enabled');

        if (!enabled) {
            this._restore();
            return;
        }

        if (!this._dockContainer) {
            this._createDock();
        }

        // 1. Layout (Orientation)
        this._updateLayout(); 
        
        // 2. Styles
        this._updateStyles(); 
        
        // 3. Position & Icon Size Loop
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (this._dockContainer && this._dash) {
                this._updatePosition();
                
                const iconSize = settings.get_int('dock-icon-size');
                // Force Property
                if (this._dash.iconSize !== iconSize) {
                    this._dash.iconSize = iconSize;
                }
                // Force Children
                this._updateIconSizes();
                
                this._dockContainer.queue_relayout();
            }
            return GLib.SOURCE_REMOVE;
        });
        
        this._updateAutoHide();
    }

    _createDock() {
        this._dockContainer = new St.BoxLayout({
            name: 'lesion-dock',
            style_class: 'dock-container',
            reactive: true,
            track_hover: true,
            can_focus: true,
            clip_to_allocation: true
        });

        if (this._dash.get_parent() && this._dash.get_parent() !== this._dockContainer) {
            this._dash.get_parent().remove_child(this._dash);
        }

        if (this._dash._background) {
            this._dash._background.opacity = 0; 
        }

        this._dockContainer.add_child(this._dash);
        this._dash.show();
        
        if (this._dash._showAppsIcon) {
            this._dash._showAppsIcon.show();
        }

        Main.layoutManager.addChrome(this._dockContainer, {
            affectsStruts: true,
            trackFullscreen: true
        });

        this._dockContainer.connect('notify::allocation', () => this._updatePosition());
    }

    _updateLayout() {
        if (!this._dockContainer || !this._dash) return;

        const settings = this.getSettings();
        const position = settings.get_enum('dock-position'); // 0:Bot, 1:Left, 2:Right, 3:Top
        const isVertical = (position === 1 || position === 2);
        const box = this._dash._box;

        if (!box) return;

        // --- Layout Sanity ---
        this._dockContainer.vertical = isVertical;
        box.vertical = isVertical;

        // Force Clutter Orientation
        const layout = box.get_layout_manager();
        if (layout && layout instanceof Clutter.BoxLayout) {
            layout.set_orientation(isVertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL);
        }

        // Handle inner containers (DashItemContainer wrapper)
        // This fixes the "2 Columns" issue where app list and show apps button sit side-by-side
        if (this._dash._dashContainer) {
             // _dashContainer contains the app icons. 
             // If it's a BoxLayout, set it too.
             if (this._dash._dashContainer instanceof St.BoxLayout) {
                 this._dash._dashContainer.vertical = isVertical;
             }
             // Ensure it is aligned correctly
             this._dash._dashContainer.x_align = Clutter.ActorAlign.CENTER;
             this._dash._dashContainer.y_align = Clutter.ActorAlign.CENTER;
        }

        // Alignments
        if (isVertical) {
            this._dash.add_style_class_name('vertical');
            
            this._dash.x_align = Clutter.ActorAlign.FILL;
            this._dash.y_align = Clutter.ActorAlign.START;
            box.x_align = Clutter.ActorAlign.CENTER;
            box.y_align = Clutter.ActorAlign.START;
            
            this._dockContainer.x_expand = false;
            this._dockContainer.y_expand = true;
        } else {
            this._dash.remove_style_class_name('vertical');
            
            this._dash.x_align = Clutter.ActorAlign.START;
            this._dash.y_align = Clutter.ActorAlign.FILL;
            box.x_align = Clutter.ActorAlign.START;
            box.y_align = Clutter.ActorAlign.CENTER;

            this._dockContainer.x_expand = true;
            this._dockContainer.y_expand = false;
        }
    }

    _updateIconSizes() {
        if (!this._dash || !this._dash._box) return;
        
        const settings = this.getSettings();
        const iconSize = settings.get_int('dock-icon-size');

        // Helper to resize a DashItemContainer
        const resizeItem = (item) => {
            // Check for setIconSize method (AppIcon)
            if (item.child && typeof item.child.setIconSize === 'function') {
                item.child.setIconSize(iconSize);
            }
            // Check if item itself is the icon (sometimes true for ShowApps)
            else if (item.icon && typeof item.icon.setIconSize === 'function') {
                item.icon.setIconSize(iconSize);
            }
        };

        // 1. Show Apps Button
        if (this._dash._showAppsIcon) {
            resizeItem(this._dash._showAppsIcon);
        }

        // 2. App Icons
        // They live in _dashContainer (St.BoxLayout) -> Children are DashItemContainers
        if (this._dash._dashContainer) {
            this._dash._dashContainer.get_children().forEach(child => {
                resizeItem(child);
            });
        } 
        // Fallback: Check direct children of _box (older gnome versions)
        else {
            this._dash._box.get_children().forEach(child => {
                resizeItem(child);
            });
        }
    }

    _updatePosition() {
        if (!this._dockContainer || !this._dockContainer.has_allocation()) return;

        const settings = this.getSettings();
        const position = settings.get_enum('dock-position');
        const panelMode = settings.get_boolean('dock-panel-mode');
        const monitor = Main.layoutManager.primaryMonitor;
        
        const box = this._dockContainer.get_allocation_box();
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;

        let x = 0;
        let y = 0;

        switch (position) {
            case 0: // Bottom
                x = monitor.x + (monitor.width / 2) - (width / 2);
                y = monitor.y + monitor.height - height;
                if (panelMode) { this._dockContainer.width = monitor.width; x = monitor.x; }
                else { this._dockContainer.width = -1; }
                break;
            case 1: // Left
                x = monitor.x;
                y = monitor.y + (monitor.height / 2) - (height / 2);
                if (panelMode) { this._dockContainer.height = monitor.height; y = monitor.y; }
                else { this._dockContainer.height = -1; }
                break;
            case 2: // Right
                x = monitor.x + monitor.width - width;
                y = monitor.y + (monitor.height / 2) - (height / 2);
                if (panelMode) { this._dockContainer.height = monitor.height; y = monitor.y; }
                else { this._dockContainer.height = -1; }
                break;
            case 3: // Top
                x = monitor.x + (monitor.width / 2) - (width / 2);
                y = monitor.y;
                if (panelMode) { this._dockContainer.width = monitor.width; x = monitor.x; }
                else { this._dockContainer.width = -1; }
                break;
        }
        this._dockContainer.set_position(x, y);
    }

    _updateStyles() {
        if (!this._dockContainer) return;
        const settings = this.getSettings();

        const color = settings.get_string('dock-color');
        const opacity = settings.get_double('dock-opacity'); 
        const radius = settings.get_int('dock-radius');
        const iconSize = settings.get_int('dock-icon-size');
        const position = settings.get_enum('dock-position');
        const panelMode = settings.get_boolean('dock-panel-mode');

        // CSS
        let bgCss = 'background-color: rgba(36, 36, 36, 0.8);';
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            bgCss = `background-color: rgba(${r}, ${g}, ${b}, ${opacity});`;
        }

        let radiusCss = `border-radius: ${radius}px;`;
        if (panelMode) {
            const r = radius;
            if (position === 0) radiusCss = `border-radius: ${r}px ${r}px 0 0;`; 
            if (position === 1) radiusCss = `border-radius: 0 ${r}px ${r}px 0;`; 
            if (position === 2) radiusCss = `border-radius: ${r}px 0 0 ${r}px;`; 
            if (position === 3) radiusCss = `border-radius: 0 0 ${r}px ${r}px;`; 
        }

        // Constraints
        const dockThickness = iconSize + 24; 
        let sizeConstraint = '';
        if (position === 1 || position === 2) { 
            sizeConstraint = `min-width: ${dockThickness}px;`;
        } else { 
            sizeConstraint = `min-height: ${dockThickness}px;`;
        }

        const style = `
            ${bgCss}
            ${radiusCss}
            ${sizeConstraint}
            padding: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition-duration: 250ms;
        `;
        this._dockContainer.set_style(style);
    }

    _updateAutoHide() {
        if (!this._dockContainer) return;
        const settings = this.getSettings();
        const autoHide = settings.get_boolean('dock-autohide');

        if (this._evtBlocker) {
            this._dockContainer.disconnect(this._evtBlocker);
            this._dockContainer.disconnect(this._evtBlocker2);
            this._evtBlocker = null;
        }

        if (autoHide) {
            this._dockContainer.opacity = 0;
            this._evtBlocker = this._dockContainer.connect('enter-event', () => {
                this._dockContainer.ease({
                    opacity: 255,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            });
            this._evtBlocker2 = this._dockContainer.connect('leave-event', () => {
                this._dockContainer.ease({
                    opacity: 0,
                    duration: 300,
                    delay: 500, 
                    mode: Clutter.AnimationMode.EASE_IN_QUAD
                });
            });
        } else {
            this._dockContainer.opacity = 255;
            this._dockContainer.remove_all_transitions();
        }
    }

    _restore() {
        if (!this._dash) return;

        if (this._dash._background) {
            this._dash._background.opacity = 255;
        }
        this._dash.set_style(null);

        if (this._dockContainer) {
            Main.layoutManager.removeChrome(this._dockContainer);
            this._dockContainer.remove_child(this._dash);
            this._dockContainer.destroy();
            this._dockContainer = null;
        }

        if (this._originalParent && this._dash.get_parent() !== this._originalParent) {
            if (this._dash._box) {
                this._dash._box.vertical = false;
                const layout = this._dash._box.get_layout_manager();
                if (layout) layout.set_orientation(Clutter.Orientation.HORIZONTAL);
            }
            if (this._dash._dashContainer && this._dash._dashContainer instanceof St.BoxLayout) {
                this._dash._dashContainer.vertical = false;
            }
            this._dash.remove_style_class_name('vertical');
            this._dash.iconSize = 64; 
            this._originalParent.add_child(this._dash);
        }
        
        log("DockManager: Restored Dash.");
    }
}