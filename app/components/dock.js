import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
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
        this._edgeTrigger = null; 
        this._monitorsChangedId = null;
        this._dashSizeSignalId = null;
        this._overviewSignals = [];
        this._dashVisSignalId = null; 
        
        // State Tracking
        this._intellihideSignals = [];
        this._windowSignals = new Map();
        this._isObstructed = false;
        this._isHovering = false; 
        
        this._itemSignals = new Map(); 

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._syncState();
            return GLib.SOURCE_REMOVE;
        });

        const settingsKeys = [
            'dock-enabled', 'dock-position', 'dock-panel-mode', 
            'dock-icon-size', 'dock-radius', 'dock-opacity', 
            'dock-color', 'dock-autohide',
            'dock-padding', 'dock-margin',
            'dock-show-apps',
            'dock-item-spacing',
            'dock-item-radius', 'dock-item-color',
            'dock-item-padding', 'dock-item-margin', 
            'dock-border-width', 'dock-border-color',
            'dock-hover-scale'
        ];
        
        settingsKeys.forEach(key => {
            this.observe(`changed::${key}`, () => {
                const enabled = this.getSettings().get_boolean('dock-enabled');
                if (key === 'dock-enabled') {
                    this._syncState();
                } else if (enabled && this._dockContainer) {
                    this._updateStyles(); 
                    this._updateLayout(); 
                    this._updatePosition(); 
                    this._updateAutoHide(); 
                    this._updateItems(); 
                    
                    if (['dock-icon-size', 'dock-padding', 'dock-item-spacing', 'dock-item-padding', 'dock-item-margin'].includes(key)) {
                        this._dash._adjustIconSize();
                    }
                }
            });
        });

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            if (this._dockContainer) this._updatePosition();
        });

        ['showing', 'shown', 'hiding', 'hidden'].forEach(signal => {
            const id = Main.overview.connect(signal, () => this._updateOverviewState(signal));
            this._overviewSignals.push(id);
        });
    }

    onDisable() {
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        this._overviewSignals.forEach(id => Main.overview.disconnect(id));
        this._overviewSignals = [];

        this._cleanupItemSignals();
        this._disableIntellihide();
        this._destroyDock();
    }

    _syncState() {
        const enabled = this.getSettings().get_boolean('dock-enabled');
        if (enabled) {
            this._createDock();
        } else {
            this._destroyDock();
        }
    }

    _createDock() {
        if (this._dockContainer) return;

        this._dockContainer = new St.BoxLayout({
            name: 'lesion-dock',
            style_class: 'dock-container',
            reactive: true,
            track_hover: true,
            can_focus: true,
        });

        this._dockContainer.connect('enter-event', () => {
            this._isHovering = true;
            this._applyVisibilityState();
        });
        this._dockContainer.connect('leave-event', () => {
            this._isHovering = false;
            this._applyVisibilityState();
        });

        this._edgeTrigger = new St.Widget({
            name: 'lesion-dock-trigger',
            reactive: false, 
            style: 'background-color: transparent;' 
        });
        Main.layoutManager.addChrome(this._edgeTrigger, { affectsStruts: false, trackFullscreen: true });
        
        this._edgeTrigger.connect('enter-event', () => {
            if (this._dockContainer) {
                this._isHovering = true; 
                this._applyVisibilityState();
            }
        });

        if (this._dash.get_parent()) {
            this._dash.get_parent().remove_child(this._dash);
        }

        if (this._dash._background) {
            this._dash._background.opacity = 0; 
        }

        if (this._dash.has_style_class_name('dash')) {
            this._dash.remove_style_class_name('dash');
        }
        
        this._dockContainer.add_child(this._dash);
        
        this._dash.show();
        this._dash.opacity = 255;
        this._dash._isVisible = true; 
        if (this._dash._box) this._dash._box.show();

        if (!this._dashVisSignalId) {
            this._dashVisSignalId = this._dash.connect('notify::visible', () => {
                if (!this._dash.visible && this._dockContainer) {
                    this._dash.visible = true;
                    this._dash.show();
                    this._dash.opacity = 255;
                }
            });
        }

        const settings = this.getSettings();
        const autoHide = settings.get_boolean('dock-autohide');
        
        Main.layoutManager.addChrome(this._dockContainer, {
            affectsStruts: !autoHide,
            trackFullscreen: true
        });

        this._hookDash();

        this._dashSizeSignalId = this._dockContainer.connect('notify::allocation', () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (this._dockContainer) {
                     this._updatePosition();
                     if (this.getSettings().get_boolean('dock-autohide')) {
                         this._checkObstruction(); 
                     }
                }
                return GLib.SOURCE_REMOVE;
            });
        });

        this._updateStyles();
        this._updateLayout();
        this._updatePosition();
        this._updateItems(); 
        this._updateOverviewState('shown'); 
        
        this._dash._adjustIconSize();
    }

    _destroyDock() {
        if (!this._dockContainer) return;

        this._unhookDash();
        this._disableIntellihide();
        this._cleanupItemSignals();

        if (this._dashVisSignalId) {
            this._dash.disconnect(this._dashVisSignalId);
            this._dashVisSignalId = null;
        }

        if (this._dashSizeSignalId) {
            this._dockContainer.disconnect(this._dashSizeSignalId);
            this._dashSizeSignalId = null;
        }

        if (this._dash._background) {
            this._dash._background.opacity = 255;
            this._dash._background.set_style(null); 
        }
        
        if (this._dash.set_style) this._dash.set_style(null);
        if (this._dash._box) {
             this._dash._box.set_style(null);
             this._dash._box.get_children().forEach(item => {
                 item.set_style(null);
                 if(item.child) {
                     item.child.set_style(null);
                     item.child.set_scale(1,1);
                 }
                 // Reset children if we messed with them
                 const children = item.get_children ? item.get_children() : [];
                 children.forEach(c => {
                    if (c.set_style) c.set_style(null);
                 });
             });
        }
        if (this._dash._showAppsIcon) {
            this._dash._showAppsIcon.visible = true; 
            this._dash._showAppsIcon.set_style(null);
            if(this._dash._showAppsIcon.child) {
                this._dash._showAppsIcon.child.set_style(null);
                this._dash._showAppsIcon.child.set_scale(1,1);
            }
        }

        if (!this._dash.has_style_class_name('dash')) {
            this._dash.add_style_class_name('dash');
        }

        if (this._dash._showAppsIcon && this._dash._box) {
            const showApps = this._dash._showAppsIcon;
            if (showApps.get_parent() === this._dash._box) {
                this._dash._box.remove_child(showApps);
                if (!this._dash.contains(showApps)) {
                    this._dash.add_child(showApps);
                }
            }
        }
        
        if (this._dash._separator) {
            this._dash._separator.visible = true;
            this._dash._separator.height = -1; 
            if (this._dash._separator.style) this._dash._separator.style = null;
        }

        if (this._edgeTrigger) {
            Main.layoutManager.removeChrome(this._edgeTrigger);
            this._edgeTrigger.destroy();
            this._edgeTrigger = null;
        }

        Main.layoutManager.removeChrome(this._dockContainer);
        this._dockContainer.remove_child(this._dash);
        this._dockContainer.destroy();
        this._dockContainer = null;

        if (this._originalParent && !this._originalParent.contains(this._dash)) {
            if (this._dash._box) {
                this._dash._box.vertical = false;
                if(this._dash._box.layout_manager) {
                    this._dash._box.layout_manager.orientation = Clutter.Orientation.HORIZONTAL;
                }
            }
            if (this._dash._dashContainer && this._dash._dashContainer instanceof St.BoxLayout) {
                this._dash._dashContainer.vertical = false;
                if (this._dash._dashContainer.layout_manager) {
                    this._dash._dashContainer.layout_manager.orientation = Clutter.Orientation.HORIZONTAL;
                }
            }

            this._dash.remove_style_class_name('vertical');
            this._dash.iconSize = 64; 
            this._originalParent.add_child(this._dash);
        }
    }

_updateItems() {
    if (!this._dockContainer || !this._dash?._box)
        return;

    const settings = this.getSettings();
    const itemRadius = settings.get_int('dock-item-radius');
    const itemColor = settings.get_string('dock-item-color');
    const itemPadding = settings.get_int('dock-item-padding');
    const itemMargin = settings.get_int('dock-item-margin');
    const hoverScale = settings.get_double('dock-hover-scale');

    const itemColorRgba = this._hexToRgba(itemColor, 1.0, 'rgba(36, 36, 36, 0.5)');

    const styleTargetStyle = `
        background-color: ${itemColorRgba};
        border-radius: ${itemRadius}px;
        transition: all 200ms ease-out;
        padding: ${itemPadding}px;
        margin: ${itemMargin}px;
        box-shadow: none;
        border: none;
    `;

    // Collect dash actors
    let actors = this._dash._box.get_children() || [];
    if (this._dash._dashContainer) {
        actors = actors.concat(this._dash._dashContainer.get_children() || []);
    }

    this._cleanupItemSignals();

    actors.forEach(wrapper => {
        if (!wrapper?.has_style_class_name?.('dash-item-container'))
            return;

        const children = wrapper.get_children() || [];
        const button = children[0];
        if (!button)
            return;

        const styleTarget =
            button.get_child_at_index?.(0) ||
            button.get_children?.()[0];

        if (!styleTarget)
            return;

        // === STRICT SHOW APPS DETECTION ===
        const isShowApps =
            wrapper.has_style_class_name('show-apps') ||
            button.has_style_class_name('show-apps') ||
            styleTarget?.has_style_class_name?.('show-apps-icon');

        if (isShowApps) {
            // Restore GNOME defaults — do NOT touch anything
            wrapper.reactive = false;
            button.reactive = true;

            wrapper.clip_to_allocation = true;
            button.clip_to_allocation = true;
            styleTarget.clip_to_allocation = true;

            wrapper.set_style(null);
            button.set_style(null);
            styleTarget.set_style(null);

            return;
        }

        // === REGULAR APP ICON CUSTOMIZATION ===

        styleTarget.set_style(styleTargetStyle);

        // Preserve running indicators
        const targetChildren = styleTarget.get_children() || [];
        targetChildren.forEach(child => {
            if (!child?.has_style_class_name)
                return;

            if (!child.has_style_class_name('app-well-app-running-dot') &&
                !child.has_style_class_name('running-dot')) {
                child.set_style('background-color: transparent; border-radius: 0; box-shadow: none;');
            }
        });

        // Clean parent styles
        wrapper.set_style('background-color: transparent; border: none; box-shadow: none; padding: 0; margin: 0;');
        button.set_style('background-color: transparent; border-radius: 0; padding: 0; margin: 0; box-shadow: none;');

        // Disable clipping ONLY for regular icons
        wrapper.clip_to_allocation = false;
        button.clip_to_allocation = false;
        styleTarget.clip_to_allocation = false;

        // Center scaling
        styleTarget.set_pivot_point(0.5, 0.5);

        // Keep GNOME’s event routing intact
        if (!wrapper.reactive)
            wrapper.reactive = true;

        // Hover animation
        if (hoverScale > 1.0) {
            const enterId = wrapper.connect('enter-event', () => {
                styleTarget.ease({
                    scale_x: hoverScale,
                    scale_y: hoverScale,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            });

            const leaveId = wrapper.connect('leave-event', () => {
                styleTarget.ease({
                    scale_x: 1.0,
                    scale_y: 1.0,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            });

            this._itemSignals.set(wrapper, [enterId, leaveId]);
        }
    });
}


    _cleanupItemSignals() {
        this._itemSignals.forEach((ids, actor) => {
            ids.forEach(id => { try { actor.disconnect(id); } catch(e){} });
        });
        this._itemSignals.clear();
    }

    _setupIntellihide() {
        this._disableIntellihide(); 
        const display = global.display;
        
        const check = () => {
            if (this._updateQueued) return;
            this._updateQueued = true;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._checkObstruction();
                this._updateQueued = false;
                return GLib.SOURCE_REMOVE;
            });
        };

        this._intellihideSignals.push(display.connect('window-created', () => { this._syncWindows(); check(); }));
        this._intellihideSignals.push(display.connect('window-demands-attention', check));
        this._intellihideSignals.push(display.connect('workareas-changed', check));
        this._intellihideSignals.push(display.connect('restacked', check));

        this._syncWindows();
    }

    _disableIntellihide() {
        if (this._intellihideSignals.length > 0) {
            const display = global.display;
            this._intellihideSignals.forEach(id => display.disconnect(id));
            this._intellihideSignals = [];
        }
        this._windowSignals.forEach((ids, win) => {
            try { ids.forEach(id => win.disconnect(id)); } catch(e) {}
        });
        this._windowSignals.clear();
    }

    _syncWindows() {
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
        for (const [win, ids] of this._windowSignals) {
            if (!windows.includes(win)) {
                ids.forEach(id => { try { win.disconnect(id); } catch(e){} });
                this._windowSignals.delete(win);
            }
        }
        const check = () => this._checkObstruction();
        windows.forEach(win => {
            if (!this._windowSignals.has(win)) {
                const ids = [];
                ids.push(win.connect('position-changed', check));
                ids.push(win.connect('size-changed', check));
                ids.push(win.connect('notify::minimized', check));
                ids.push(win.connect('notify::monitor', check));
                this._windowSignals.set(win, ids);
            }
        });
    }

    _checkObstruction() {
        if (!this._dockContainer || !this.getSettings().get_boolean('dock-autohide')) return;

        if (Main.overview.visible || Main.overview.visibleTarget) {
            this._isObstructed = false;
            this._applyVisibilityState(); 
            return;
        }

        const monitor = Main.layoutManager.primaryMonitor;
        const settings = this.getSettings();
        const pos = settings.get_enum('dock-position');
        const iconSize = settings.get_int('dock-icon-size');
        const padding = settings.get_int('dock-padding');
        const borderWidth = settings.get_int('dock-border-width');
        
        let [minW, natW] = this._dockContainer.get_preferred_width(-1);
        let [minH, natH] = this._dockContainer.get_preferred_height(-1);
        let width = natW, height = natH;
        
        if (width < 10 || height < 10) {
            const thickness = iconSize + (padding * 2) + (borderWidth * 2) + 2;
            if (pos === 1 || pos === 2) { width = thickness; height = monitor.height; }
            else { width = monitor.width; height = thickness; }
        }

        const margin = settings.get_int('dock-margin');
        let dockRect = { x: 0, y: 0, width: width, height: height };
        
        if (pos === 0) { // Bottom
            dockRect.x = (monitor.x + (monitor.width/2) - (width/2)); 
            dockRect.y = monitor.y + monitor.height - height - margin;
        } else if (pos === 1) { // Left
            dockRect.x = monitor.x + margin;
            dockRect.y = (monitor.y + (monitor.height/2) - (height/2));
        } else if (pos === 2) { // Right
            dockRect.x = monitor.x + monitor.width - width - margin;
            dockRect.y = (monitor.y + (monitor.height/2) - (height / 2));
        } else if (pos === 3) { // Top
            dockRect.x = (monitor.x + (monitor.width/2) - (width/2));
            dockRect.y = monitor.y + margin;
        }

        let obstructed = false;
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
        
        for (let win of windows) {
            if (win.get_monitor() !== monitor.index) continue;
            if (!win.showing_on_its_workspace()) continue;
            if (win.minimized) continue;

            const rect = win.get_frame_rect();
            const intersects = (
                rect.x < dockRect.x + dockRect.width &&
                rect.x + rect.width > dockRect.x &&
                rect.y < dockRect.y + dockRect.height &&
                rect.y + rect.height > dockRect.y
            );

            if (intersects) {
                obstructed = true;
                break;
            }
        }

        if (this._isObstructed !== obstructed) {
            this._isObstructed = obstructed;
            this._applyVisibilityState();
        }
    }

    _applyVisibilityState() {
        if (!this._dockContainer) return;
        
        this._dockContainer.remove_all_transitions();

        // Visible if NOT obstructed OR Hovering
        const shouldBeVisible = (!this._isObstructed || this._isHovering);

        const settings = this.getSettings();
        const pos = settings.get_enum('dock-position');
        const iconSize = settings.get_int('dock-icon-size');
        const padding = settings.get_int('dock-padding');
        const size = iconSize + (padding * 2) + 20; 

        let hideX = 0, hideY = 0;
        if (pos === 0) hideY = size;   
        if (pos === 1) hideX = -size;  
        if (pos === 2) hideX = size;   
        if (pos === 3) hideY = -size;  

        if (shouldBeVisible) {
            // STATE: VISIBLE
            this._dockContainer.ease({
                opacity: 255,
                translation_x: 0,
                translation_y: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
            if (this._edgeTrigger) this._edgeTrigger.reactive = false;
        } else {
            // STATE: HIDDEN
            this._dockContainer.ease({
                opacity: 0,
                translation_x: hideX,
                translation_y: hideY,
                duration: 350,
                delay: 100, 
                mode: Clutter.AnimationMode.EASE_IN_QUAD
            });
            if (this._edgeTrigger) this._edgeTrigger.reactive = true;
        }
    }

    _updateAutoHide() {
        if (!this._dockContainer) return;
        if (Main.overview.visible || Main.overview.visibleTarget) return;

        this._dockContainer.visible = true;

        const settings = this.getSettings();
        const autoHide = settings.get_boolean('dock-autohide');

        Main.layoutManager.removeChrome(this._dockContainer);
        Main.layoutManager.addChrome(this._dockContainer, {
            affectsStruts: !autoHide,
            trackFullscreen: true
        });

        if (autoHide) {
            this._setupIntellihide();
            this._checkObstruction(); 
        } else {
            this._disableIntellihide();
            this._isObstructed = false;
            this._isHovering = false; 
            
            if (this._edgeTrigger) this._edgeTrigger.reactive = false; 
            
            this._dockContainer.remove_all_transitions();
            this._dockContainer.opacity = 255;
            this._dockContainer.translation_x = 0;
            this._dockContainer.translation_y = 0;
        }
    }

    _updateOverviewState(phase) {
        if (!this._dockContainer) return;

        this._dash.visible = true;
        this._dash.opacity = 255;
        this._dash.show();
        if (this._dash._box) {
            this._dash._box.visible = true;
            this._dash._box.show();
        }

        const isOverviewVisible = Main.overview.visible || Main.overview.visibleTarget;

        if (isOverviewVisible) {
            this._dockContainer.remove_all_transitions();
            this._dockContainer.translation_x = 0;
            this._dockContainer.translation_y = 0;
            this._dockContainer.opacity = 255;
            this._dockContainer.visible = true;
            if (this._edgeTrigger) this._edgeTrigger.reactive = false;
            
            if (this._dockContainer.get_parent()) {
                this._dockContainer.get_parent().set_child_above_sibling(this._dockContainer, null);
            }
        } else {
            this._updateAutoHide();
        }

        if (phase === 'hidden' || phase === 'shown') {
            if (this._dash._adjustIconSize) {
                this._dash._adjustIconSize();
            }
            this._dash.queue_relayout();
            
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (this._dockContainer) {
                    this._dash.queue_relayout();
                    this._updateLayout(); 
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _updateLayout() {
        if (!this._dockContainer) return;

        const settings = this.getSettings();
        const position = settings.get_enum('dock-position');
        const isVertical = (position === 1 || position === 2);
        const iconSize = settings.get_int('dock-icon-size');
        const showAppsEnabled = settings.get_boolean('dock-show-apps');
        const spacing = settings.get_int('dock-item-spacing'); 

        this._dockContainer.vertical = isVertical;

        if (this._dash._box) {
            this._dash._box.vertical = isVertical;
            if (this._dash._box.layout_manager) {
                this._dash._box.layout_manager.orientation = isVertical 
                    ? Clutter.Orientation.VERTICAL 
                    : Clutter.Orientation.HORIZONTAL;
            }
            
            this._dash._box.x_align = Clutter.ActorAlign.CENTER;
            this._dash._box.y_align = Clutter.ActorAlign.CENTER;
            this._dash._box.set_style(`spacing: ${spacing}px; padding: 0; margin: 0;`);
            this._dash._box.show();
        }

        if (this._dash._dashContainer) {
            if (this._dash._dashContainer instanceof St.BoxLayout) {
                this._dash._dashContainer.vertical = isVertical;
                if (this._dash._dashContainer.layout_manager) {
                    this._dash._dashContainer.layout_manager.orientation = isVertical 
                        ? Clutter.Orientation.VERTICAL 
                        : Clutter.Orientation.HORIZONTAL;
                }
            }
            this._dash._dashContainer.x_align = Clutter.ActorAlign.CENTER;
            this._dash._dashContainer.y_align = Clutter.ActorAlign.CENTER;
            this._dash._dashContainer.set_style(`spacing: ${spacing}px; padding: 0; margin: 0;`);
            
            this._dash._dashContainer.get_children().forEach(child => {
                child.x_align = Clutter.ActorAlign.CENTER;
                child.y_align = Clutter.ActorAlign.CENTER;
            });
        }

        if (this._dash._showAppsIcon && this._dash._separator) {
            const showApps = this._dash._showAppsIcon;
            const separator = this._dash._separator;
            const mainBox = this._dash._box;

            showApps.visible = showAppsEnabled;

            if (isVertical) {
                if (showApps.get_parent() !== mainBox) {
                    if (showApps.get_parent()) showApps.get_parent().remove_child(showApps);
                    mainBox.add_child(showApps); 
                }
                mainBox.set_child_at_index(showApps, -1); 
                showApps.x_align = Clutter.ActorAlign.CENTER;
                showApps.y_align = Clutter.ActorAlign.CENTER;
                separator.visible = false;
                separator.height = 0;
                separator.style = 'height: 0px; margin: 0; padding: 0;';
                this._dash.add_style_class_name('vertical');
            } else {
                if (showApps.get_parent() !== mainBox) {
                     if (showApps.get_parent()) showApps.get_parent().remove_child(showApps);
                     mainBox.add_child(showApps);
                }
                mainBox.set_child_at_index(showApps, -1); 
                separator.visible = true;
                separator.height = -1;
                separator.style = null;
                this._dash.remove_style_class_name('vertical');
            }
        }
        
        this._dash._lesionCustomSize = iconSize;
        this._dash._adjustIconSize();
        this._dash.queue_relayout();
        this._updateItems(); 
    }

    _updateStyles() {
        if (!this._dockContainer) return;
        const settings = this.getSettings();

        const bgColor = settings.get_string('dock-color');
        const opacity = settings.get_double('dock-opacity'); 
        const radius = settings.get_int('dock-radius');
        const iconSize = settings.get_int('dock-icon-size');
        const padding = settings.get_int('dock-padding');
        const position = settings.get_enum('dock-position');
        const panelMode = settings.get_boolean('dock-panel-mode');
        const borderWidth = settings.get_int('dock-border-width');
        const borderColor = settings.get_string('dock-border-color'); 

        const bgColorRgba = this._hexToRgba(bgColor, opacity, 'rgba(36, 36, 36, 0.8)');

        let radiusCss = `border-radius: ${radius}px;`;
        if (panelMode) {
            const r = radius;
            if (position === 0) radiusCss = `border-radius: ${r}px ${r}px 0 0;`; 
            if (position === 1) radiusCss = `border-radius: 0 ${r}px ${r}px 0;`; 
            if (position === 2) radiusCss = `border-radius: ${r}px 0 0 ${r}px;`; 
            if (position === 3) radiusCss = `border-radius: 0 0 ${r}px ${r}px;`; 
        }

        const thickness = iconSize + (padding * 2) + (borderWidth * 2) + 2; 
        
        let sizeConstraint = '';
        if (position === 1 || position === 2) { 
            sizeConstraint = `min-width: ${thickness}px; max-width: ${thickness}px;`;
        } else { 
            sizeConstraint = `min-height: ${thickness}px; max-height: ${thickness}px;`;
        }
    
        const borderColorRgba = this._hexToRgba(borderColor, opacity, 'rgba(255, 255, 255, 0.0)');

        this._dash.set_style(`padding: 0; margin: 0; spacing: 0;`);

        const style = `
            background-color: ${bgColorRgba};
            ${radiusCss}
            ${sizeConstraint}
            border: ${borderWidth}px solid ${borderColorRgba};
            padding: ${padding}px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition-duration: 250ms;
        `;
        this._dockContainer.set_style(style);
    }

    _updatePosition() {
        if (!this._dockContainer) return;

        const settings = this.getSettings();
        const position = settings.get_enum('dock-position');
        const panelMode = settings.get_boolean('dock-panel-mode');
        const iconSize = settings.get_int('dock-icon-size');
        const padding = settings.get_int('dock-padding');
        const margin = settings.get_int('dock-margin');
        const borderWidth = settings.get_int('dock-border-width');
        const monitor = Main.layoutManager.primaryMonitor;
        const spacing = settings.get_int('dock-item-spacing');
        
        const dockThickness = iconSize + (padding * 2) + (borderWidth * 2) + 2; 

        let [minW, natW] = this._dockContainer.get_preferred_width(-1);
        let [minH, natH] = this._dockContainer.get_preferred_height(-1);
        
        let width = natW;
        let height = natH;

        if (panelMode) {
            if (position === 1 || position === 2) { 
                width = dockThickness;
                height = monitor.height;
                this._dockContainer.height = monitor.height; 
            } else { 
                width = monitor.width;
                height = dockThickness;
                this._dockContainer.width = monitor.width;
            }
        } else {
            this._dockContainer.width = -1;
            this._dockContainer.height = -1;
            [minW, natW] = this._dockContainer.get_preferred_width(-1);
            [minH, natH] = this._dockContainer.get_preferred_height(-1);
            width = natW;
            height = natH;
        }

        let x = 0;
        let y = 0;

        switch (position) {
            case 0: // Bottom
                x = monitor.x + (monitor.width / 2) - (width / 2);
                y = monitor.y + monitor.height - dockThickness - margin;
                if (panelMode) x = monitor.x;
                break;
            case 1: // Left
                x = monitor.x + margin;
                y = monitor.y + (monitor.height / 2) - (height / 2);
                if (panelMode) y = monitor.y;
                break;
            case 2: // Right
                x = monitor.x + monitor.width - dockThickness - margin;
                y = monitor.y + (monitor.height / 2) - (height / 2);
                if (panelMode) y = monitor.y;
                break;
            case 3: // Top
                x = monitor.x + (monitor.width / 2) - (width / 2);
                y = monitor.y + margin; 
                if (panelMode) x = monitor.x;
                break;
        }

        this._dockContainer.set_position(Math.round(x), Math.round(y));

        if (this._edgeTrigger) {
            const thickness = 2; 
            let tX = 0, tY = 0, tW = 0, tH = 0;
            
            if (position === 0) { 
                tX = x; tY = monitor.y + monitor.height - thickness;
                tW = width; tH = thickness;
            } else if (position === 1) { 
                tX = monitor.x; tY = y;
                tW = thickness; tH = height;
            } else if (position === 2) { 
                tX = monitor.x + monitor.width - thickness; tY = y;
                tW = thickness; tH = height;
            } else if (position === 3) { 
                tX = x; tY = monitor.y;
                tW = width; tH = thickness;
            }
            
            this._edgeTrigger.set_position(tX, tY);
            this._edgeTrigger.set_size(tW, tH);
        }
    }

    _hexToRgba(hex, opacity = 1, fallback = null) {
        // If hex is invalid from the start, return fallback immediately
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
            return fallback;
        }

        const cleanHex = hex.substring(1).toLowerCase();

        // Only accept 6 or 8 digit hex codes
        if (cleanHex.length !== 6 && cleanHex.length !== 8) {
            return fallback;
        }

        // Parse RGB values (always from first 6 digits)
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);

        // Check if parsing failed (e.g., non-hex chars like #ggg)
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return fallback;
        }

        let alpha = opacity;

        // If 8-digit hex, use embedded alpha and ignore opacity param
        if (cleanHex.length === 8) {
            const aHex = parseInt(cleanHex.slice(6, 8), 16);
            if (!isNaN(aHex)) {
                alpha = aHex / 255;
            }
        }

        // Clean alpha formatting: e.g., 0.5 instead of 0.5000, 1 instead of 1.0000
        const alphaStr = alpha === 1 
            ? '1' 
            : alpha.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

        return `rgba(${r}, ${g}, ${b}, ${alphaStr})`;
    } 

    _hookDash() {
        if (this._dash._originalAdjustIconSize) return;

        this._dash._originalAdjustIconSize = this._dash._adjustIconSize;
        this._dash._lesionCustomSize = this.getSettings().get_int('dock-icon-size') || 48;

        this._dash._adjustIconSize = () => {
            const size = this._dash._lesionCustomSize;
            
            this._dash._iconSize = size;
            this._dash.iconSize = size;

            const container = this._dash._box || this._dash._dashContainer;
            
            if (container) {
                container.get_children().forEach(item => {
                    let iconChild = item.child;
                    if (!iconChild && typeof item.get_child === 'function') {
                        iconChild = item.get_child();
                    }
                    
                    const findIcon = (actor) => {
                        if (!actor) return null;
                        if (typeof actor.setIconSize === 'function') return actor;
                        if (actor.icon && typeof actor.icon.setIconSize === 'function') return actor.icon;
                        if (actor.get_child) return findIcon(actor.get_child());
                        return null;
                    };

                    const target = findIcon(iconChild);
                    if (target) {
                        if (typeof target.setIconSize === 'function') {
                            target.setIconSize(size);
                        } else if (target.set_size) {
                            target.set_size(size, size);
                        }
                    }
                    
                    item.set_style('padding: 0; margin: 0;');
                    if (iconChild && iconChild.set_style) {
                        iconChild.set_style('padding: 0; margin: 0;'); 
                    }
                    
                    item.x_align = Clutter.ActorAlign.CENTER;
                    item.y_align = Clutter.ActorAlign.CENTER;
                    item.queue_relayout();
                });
            }

            if (this._dash._showAppsIcon) {
                const sa = this._dash._showAppsIcon;
                
                let target = sa.icon || sa.child;
                
                if (target) {
                    if (typeof target.setIconSize === 'function') {
                        target.setIconSize(size);
                    } else {
                        target.set_size(size, size);
                    }
                } else if (typeof sa.setIconSize === 'function') {
                    sa.setIconSize(size);
                }
                
                sa.set_style('padding: 0; margin: 0;');
                if (sa.child && sa.child.set_style) {
                    sa.child.set_style('padding: 0; margin: 0;');
                }
                
                sa.x_align = Clutter.ActorAlign.CENTER;
                sa.y_align = Clutter.ActorAlign.CENTER;
                sa.queue_relayout();
            }
            
            this._dash.queue_relayout();
            
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._updateItems();
                return GLib.SOURCE_REMOVE;
            });
        };
    }

    _unhookDash() {
        if (this._dash._originalAdjustIconSize) {
            this._dash._adjustIconSize = this._dash._originalAdjustIconSize;
            delete this._dash._originalAdjustIconSize;
            delete this._dash._lesionCustomSize;
            this._dash._adjustIconSize();
        }
    }
}