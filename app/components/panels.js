import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ExtensionComponent } from './base.js';
import { log, logError } from '../util/logger.js';

export class PanelsManager extends ExtensionComponent {
    
    constructor(extension) {
        super(extension);
        this._buttonSignals = new Map(); // Store signal IDs for buttons
        this._boxSignals = []; // Store signal IDs for panel boxes
    }

    onEnable() {
        this._savedPanelStyle = Main.panel.get_style();
        
        const keys = [
            // Master Switch
            'panel-enabled',
            
            // Panel Bar
            'panel-position',
            'panel-bg-color', 'panel-bg-gradient-enabled', 
            'panel-bg-gradient-color', 'panel-bg-gradient-dir',
            'panel-border-size', 'panel-border-color', 'panel-border-style', 'panel-border-bottom-only',
            'panel-shadow-enabled', 'panel-shadow-color', 
            'panel-shadow-x', 'panel-shadow-y', 'panel-shadow-blur', 'panel-shadow-spread', 'panel-shadow-inset',

            // Panel Buttons
            'panel-btn-radius', 'panel-btn-pad-min', 'panel-btn-pad-nat', 
            'panel-btn-bg-hover', 'panel-btn-bg-active', 'panel-btn-hover-enabled',

            // Popup Styles
            'popup-radius', 
            'popup-shadow-enabled', 'popup-shadow-color', 
            'popup-shadow-x', 'popup-shadow-y', 'popup-shadow-blur', 'popup-shadow-spread',
            'popup-border-size', 'popup-border-color', 'popup-border-style'
        ];

        keys.forEach(key => {
            this.observe(`changed::${key}`, () => this._refreshAll());
        });

        // NOTE: In GNOME 45+/46+, Clutter.Actor (St.BoxLayout) no longer emits 'actor-added'/'actor-removed'.
        // We skip dynamic monitoring to prevent crashes. Styling is applied to all current items.
        
        log('PanelsManager enabled. Applying initial styles...');
        this._refreshAll();
    }

    onDisable() {
        // Clear box signals if we ever re-enable them in future versions
        if (this._boxSignals) {
            this._boxSignals.forEach(sig => sig.actor.disconnect(sig.id));
            this._boxSignals = [];
        }

        this._cleanupButtonSignals();

        if (Main.panel) {
            Main.panel.set_style(this._savedPanelStyle || null);
        }

        this._iterateMenus((menu) => this._resetMenuStyle(menu));
        this._iterateButtons((btn) => {
            btn.set_style(null);
            delete btn._baseCss;
        });
    }

    _refreshAll() {
        if (!this.getSettings().get_boolean('panel-enabled')) {
            if (Main.panel) Main.panel.set_style(this._savedPanelStyle || null);
            this._iterateButtons((btn) => btn.set_style(null));
            this._cleanupButtonSignals();
            return;
        }

        this._applyPanelBarStyles();
        this._applyButtonStaticStyles();
        this._refreshButtonListeners();
        
        // Refresh menus (some might be open)
        this._iterateMenus((menu) => {
            this._styleSingleMenu(menu);
            if (menu.isOpen) {
                const bubble = this._getBoxPointer(menu);
                if (bubble) bubble.queue_relayout();
            }
        });
    }

    // --- Panel Bar Styling ---

    _applyPanelBarStyles() {
        const settings = this.getSettings();

        // 1. Background
        const bgColor = settings.get_string('panel-bg-color');
        const useGradient = settings.get_boolean('panel-bg-gradient-enabled');
        const gradColor = settings.get_string('panel-bg-gradient-color');
        
        // FIX: panel-bg-gradient-dir is type 'i' (int), not enum in schema
        const gradDir = settings.get_int('panel-bg-gradient-dir'); 

        // 2. Border
        const borderSize = settings.get_int('panel-border-size');
        const borderColor = settings.get_string('panel-border-color');
        const borderStyle = settings.get_enum('panel-border-style'); // 0=solid
        const borderBottom = settings.get_boolean('panel-border-bottom-only');

        // 3. Shadow
        const shadowEnabled = settings.get_boolean('panel-shadow-enabled');
        const shadowColor = settings.get_string('panel-shadow-color');
        const sX = settings.get_int('panel-shadow-x');
        const sY = settings.get_int('panel-shadow-y');
        const sBlur = settings.get_int('panel-shadow-blur');
        const sSpread = settings.get_int('panel-shadow-spread');
        const sInset = settings.get_boolean('panel-shadow-inset');

        let css = '';

        // --- ST CSS COMPLIANCE ---
        // St does NOT support 'background-image: linear-gradient(...)'. 
        // We must use 'background-gradient-direction', 'start', 'end'.

        if (useGradient) {
            const dir = gradDir === 0 ? 'vertical' : 'horizontal';
            css += `background-gradient-direction: ${dir}; `;
            css += `background-gradient-start: ${bgColor}; `;
            css += `background-gradient-end: ${gradColor}; `;
        } else {
            css += `background-color: ${bgColor}; `;
            css += `background-gradient-direction: none; `;
        }
        
        // Border
        const styles = ['solid','dotted','dashed','double','groove','ridge','inset','outset','none'];
        const bStyleStr = styles[borderStyle] || 'solid';
        
        if (borderSize > 0 && borderStyle !== 8) {
            css += `border-color: ${borderColor}; border-style: ${bStyleStr}; `;
            if (borderBottom) {
                css += `border-bottom-width: ${borderSize}px; border-top-width: 0; border-left-width: 0; border-right-width: 0; `;
            } else {
                css += `border-width: ${borderSize}px; `;
            }
        } else {
            css += `border-width: 0; `;
        }

        // Shadow
        if (shadowEnabled) {
            const inset = sInset ? 'inset' : '';
            css += `box-shadow: ${inset} ${sX}px ${sY}px ${sBlur}px ${sSpread}px ${shadowColor}; `;
        } else {
            css += `box-shadow: none; `;
        }

        // log(`[Panels] Generated CSS: ${css}`);
        Main.panel.set_style(css);
    }

    // --- Panel Button Styling ---

    _iterateButtons(callback) {
        const boxes = [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox];
        boxes.forEach(box => {
            if (!box) return;
            box.get_children().forEach(actor => {
                if (actor.has_style_class_name('panel-button')) {
                    callback(actor);
                } else if (actor.get_first_child) {
                    // Try to find nested button (e.g. quick settings often wraps)
                    const child = actor.get_first_child();
                    if (child && child.has_style_class_name && child.has_style_class_name('panel-button')) {
                        callback(child);
                    }
                }
            });
        });
    }

    _applyButtonStaticStyles() {
        const radius = this.getSettings().get_int('panel-btn-radius');
        const minPad = this.getSettings().get_int('panel-btn-pad-min');
        const natPad = this.getSettings().get_int('panel-btn-pad-nat');

        // St specific properties for padding
        const css = `border-radius: ${radius}px; -natural-hpadding: ${natPad}px; -minimum-hpadding: ${minPad}px;`;

        this._iterateButtons((btn) => {
            btn.set_style(css);
            btn._baseCss = css; 
        });
    }

    _cleanupButtonSignals() {
        this._buttonSignals.forEach((sigs, actor) => {
            sigs.forEach(id => actor.disconnect(id));
        });
        this._buttonSignals.clear();
    }

    _refreshButtonListeners() {
        this._cleanupButtonSignals(); 
        const enabled = this.getSettings().get_boolean('panel-btn-hover-enabled');
        if (!enabled) return;

        const hoverBg = this.getSettings().get_string('panel-btn-bg-hover');
        const activeBg = this.getSettings().get_string('panel-btn-bg-active');

        this._iterateButtons((btn) => {
            const sigs = [];
            
            // Mouse Enter
            sigs.push(btn.connect('notify::hover', () => {
                if (btn.hover) {
                    btn.set_style(`${btn._baseCss || ''} background-color: ${hoverBg};`);
                } else {
                    btn.set_style(btn._baseCss || null);
                }
            }));

            // Click/Active emulation
            sigs.push(btn.connect('button-press-event', () => {
                btn.set_style(`${btn._baseCss || ''} background-color: ${activeBg}; box-shadow: inset 0 0 4px rgba(0,0,0,0.2);`);
                return false; 
            }));

            sigs.push(btn.connect('button-release-event', () => {
                 if (btn.hover) {
                    btn.set_style(`${btn._baseCss || ''} background-color: ${hoverBg};`);
                 } else {
                    btn.set_style(btn._baseCss || null);
                 }
                 return false;
            }));

            this._buttonSignals.set(btn, sigs);
        });
    }

    // --- Popup Menus ---

    _iterateMenus(callback) {
        if (Main.panel.statusArea) {
            for (const key in Main.panel.statusArea) {
                const indicator = Main.panel.statusArea[key];
                if (indicator && indicator.menu) callback(indicator.menu);
            }
        }
        if (Main.panel.menuManager && Main.panel.menuManager._menus) {
            Main.panel.menuManager._menus.forEach(menu => callback(menu));
        }
    }

    _getBoxPointer(menu) {
        if (menu.boxPointer) return menu.boxPointer;
        if (menu.actor && typeof menu.actor.setArrowSide === 'function') return menu.actor;
        if (menu._boxPointer) return menu._boxPointer;
        return null;
    }

    _resetMenuStyle(menu) {
        const bubble = this._getBoxPointer(menu);
        const content = menu.box;
        if (bubble) bubble.set_style(null);
        if (content) content.set_style(null);
    }

    _styleSingleMenu(menu) {
        const bubble = this._getBoxPointer(menu);
        const content = menu.box;
        if (!bubble) return;

        const settings = this.getSettings();
        const radius = settings.get_int('popup-radius');
        
        // Shadow
        const shadowEnabled = settings.get_boolean('popup-shadow-enabled');
        const shadowColor = settings.get_string('popup-shadow-color');
        const sX = settings.get_int('popup-shadow-x');
        const sY = settings.get_int('popup-shadow-y');
        const sBlur = settings.get_int('popup-shadow-blur');
        const sSpread = settings.get_int('popup-shadow-spread');

        // Border
        const bSize = settings.get_int('popup-border-size');
        const bColor = settings.get_string('popup-border-color');
        const bStyle = settings.get_enum('popup-border-style');
        const styles = ['solid','dotted','dashed','double','groove','ridge','inset','outset','none'];

        // Bubble Style (Shadow + Border + Radius)
        // Note: box-shadow on popups works well in St
        let bubbleCss = `border-radius: ${radius}px; `;
        
        if (shadowEnabled) {
            bubbleCss += `box-shadow: ${sX}px ${sY}px ${sBlur}px ${sSpread}px ${shadowColor}; `;
        } else {
            bubbleCss += `box-shadow: none; `;
        }

        if (bSize > 0 && bStyle !== 8) {
            bubbleCss += `border: ${bSize}px ${styles[bStyle]} ${bColor}; `;
        }

        // Ensure boxpointer class allows styling override
        if (!bubble.has_style_class_name('popup-menu-boxpointer')) {
            bubble.add_style_class_name('popup-menu-boxpointer');
        }
        bubble.set_style(bubbleCss);

        // Content Style (Radius)
        if (content) {
            let contentCss = `border-radius: ${radius}px; `;
            if (!content.has_style_class_name('popup-menu')) {
                content.add_style_class_name('popup-menu');
            }
            content.set_style(contentCss);
        }
    }
}