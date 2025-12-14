import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ExtensionComponent } from './base.js';
import { log, logError } from '../util/logger.js';

export class ClockManager extends ExtensionComponent {

    onEnable() {
        log("ClockManager enabled");

        this._dateMenu = Main.panel.statusArea.dateMenu;
        this._centerBox = Main.panel._centerBox;
        this._rightBox = Main.panel._rightBox;
        this._leftBox = Main.panel._leftBox;

        this._systemMenu = Main.panel.statusArea.quickSettings || Main.panel.statusArea.aggregateMenu;
        this._activities = Main.panel.statusArea.activities;

        this._originalClockDisplay = this._dateMenu._clockDisplay;

        // --- custom box ---
        this._customBox = new St.BoxLayout({
            vertical: true,
            style_class: 'panel-button',
            style: 'min-width: 24px; min-height: 10px; padding:0 10px 0 10px; spacing:0px;',
            reactive: true,
            track_hover: true,
            can_focus: true
        });


        this._timeLabel = new St.Label({
            style_class: 'clock-label',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            text: " ",
            style: 'min-width: 20px; min-height: 7px; font-size: 90%; line-height:0.7em; spacing:0px;'
        });

        this._dateLabel = new St.Label({
            style_class: 'clock-label',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            text: " ",
            style: 'min-width: 20px; min-height: 3px; font-size: 65%; line-height:0.5em; opacity:0.8; spacing:0px;'
        });

        this._customBox.add_child(this._timeLabel);
        this._customBox.add_child(this._dateLabel);

        this._clockParent = this._originalClockDisplay.get_parent();
        this._clockParent.insert_child_above(this._customBox, this._originalClockDisplay);

        this._originalParent = this._dateMenu.container.get_parent();

        // hover/click highlight
        this._customBox.connect('enter-event', () => this._customBox.add_style_pseudo_class('hover'));
        this._customBox.connect('leave-event', () => this._customBox.remove_style_pseudo_class('hover'));
        // this._customBox.connect('button-press-event', () => this._customBox.add_style_pseudo_class('active'));
        // this._customBox.connect('button-release-event', () => {
        //     this._customBox.remove_style_pseudo_class('active');
        //     // this._dateMenu.menu.toggle();
        //     // Run the toggle in the next idle cycle to allow the style update to apply first
        //     GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        //         this._dateMenu.menu.toggle();
        //         return GLib.SOURCE_REMOVE; // run once
        //     });
        // });

        // 1. Visual feedback on press
        // this._customBox.connect('button-press-event', () => {
        //     this._customBox.add_style_pseudo_class('active');
        // });

        // 2. Handle release and toggle
        this._customBox.connect('button-release-event', () => {
            this._dateMenu.menu.toggle();
        });

        // 3. Sync 'active' state with the menu actually being open/closed
        this._dateMenu.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._customBox.add_style_pseudo_class('active');
            } else {
                this._customBox.remove_style_pseudo_class('active');
            }
        });

        this._clockSignal = this._originalClockDisplay.connect('notify::text', () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try { this._updateClockText(); } catch (e) { logError(e); }
                return GLib.SOURCE_REMOVE;
            });
        });

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { this._sync(); return GLib.SOURCE_REMOVE; });

        // settings observers
        this.observe('changed::clock-move-enabled', () => this._syncPos());
        this.observe('changed::clock-position', () => this._syncPos());
        this.observe('changed::clock-target', () => this._syncPos());
        this.observe('changed::clock-format-mode', () => this._updateClockText());
        this.observe('changed::clock-custom-format', () => this._updateClockText());
        this.observe('changed::clock-multiline', () => this._updateClockText());
        this.observe('changed::clock-dim-separator', () => this._updateClockText());
    }

    onDisable() { this._restore(); }

    _sync() { this._syncPos(); this._updateClockText(); }

    _syncPos() {
        if (!this._dateMenu) return;
        const settings = this.getSettings();
        if (!settings.get_boolean('clock-move-enabled')) { this._restorePos(); return; }

        const target = settings.get_enum('clock-target');
        const position = settings.get_enum('clock-position');
        if (target === 0) this._move(this._leftBox, this._activities, position);
        else this._move(this._rightBox, this._systemMenu, position);
    }

    _move(targetBox, anchorObj, positionMode) {
        if (!this._dateMenu || !targetBox) return;
        const container = this._dateMenu.container;
        const parent = container.get_parent(); if (parent) parent.remove_child(container);
        const children = targetBox.get_children();
        const anchorContainer = anchorObj ? anchorObj.container : null;
        let anchorIndex = anchorContainer ? children.indexOf(anchorContainer) : -1;
        if (anchorIndex === -1) anchorIndex = targetBox === this._leftBox ? 0 : children.length;
        const targetIndex = positionMode === 0 ? anchorIndex : anchorIndex + 1;
        targetBox.insert_child_at_index(container, targetIndex);
    }

    _restorePos() {
        if (!this._dateMenu || !this._centerBox) return;
        const container = this._dateMenu.container;
        const parent = container.get_parent();
        if (parent === this._centerBox) return;
        if (parent) parent.remove_child(container);
        this._centerBox.insert_child_at_index(container, 0);
    }

    _updateClockText() {
        if (!this._customBox || !this._originalClockDisplay) return;
        const settings = this.getSettings();
        const mode = settings.get_enum('clock-format-mode');
        const multiline = settings.get_boolean('clock-multiline');
        const dimSep = settings.get_boolean('clock-dim-separator');

        let text = '';
        if (mode === 1) {
            const format = settings.get_string('clock-custom-format') || '%H:%M\n%A, %d %B';
            const now = GLib.DateTime.new_now_local();
            try { text = now.format(format); } catch(e) { logError(e); text = this._originalClockDisplay.text || ' '; }
        } else { text = this._originalClockDisplay.text || ' '; }

        this._originalClockDisplay.visible = false;
        this._customBox.visible = true;

        if (multiline) {
            this._customBox.vertical = true;
            this._dateLabel.opacity = 255;

            // const timeRegex = /([0-9]{1,2}[:∶][0-9]{2}(?:\s?[AP]M)?)/;
            // const parts = text.split(timeRegex);
            // if (parts.length >= 2) {
            //     this._timeLabel.text = parts[1].trim();
            //     this._dateLabel.text = ((parts[0] + ' ' + (parts[2] || '')).trim().replace(/\s{2,}/g,' ')) || ' ';
            // } else {
            //     const split = text.split(' ');
            //     this._timeLabel.text = split[0] || ' ';
            //     this._dateLabel.text = split.slice(1).join(' ') || ' ';
            // }
            const timeRegex = /([0-9]{1,2}[:∶][0-9]{2}(?:[:∶][0-9]{2})?(?:\s?[AP]M)?)/;
            
            const parts = text.split(timeRegex);
            
            if (parts.length >= 2) {
                this._timeLabel.text = parts[1].trim();
                // Reconstruct the date from the parts before (parts[0]) and after (parts[2]) the time
                this._dateLabel.text = ((parts[0] + ' ' + (parts[2] || '')).trim().replace(/\s{2,}/g,' ')) || ' ';
            } else {
                const split = text.split(' ');
                this._timeLabel.text = split[0] || ' ';
                this._dateLabel.text = split.slice(1).join(' ') || ' ';
            }

        } else {
            this._customBox.vertical = false;
            this._dateLabel.opacity = 0; this._dateLabel.text = ' ';
            if (dimSep) {
                this._timeLabel.clutter_text.set_use_markup(true);
                let safe = GLib.markup_escape_text(text,-1).replace(/([|•\-\u2013\u2014])/g,"<span foreground='#888888'>$1</span>");
                if(!safe.trim()) safe='&nbsp;';
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE,()=>{ try { this._timeLabel.clutter_text.set_markup(safe); } catch(e){ logError(e); this._timeLabel.clutter_text.set_use_markup(false); this._timeLabel.text=text||' '; } return GLib.SOURCE_REMOVE; });
            } else {
                this._timeLabel.clutter_text.set_use_markup(false);
                this._timeLabel.text=text;
            }
        }
    }

    _restore() {
        this._restorePos();
        if(this._originalClockDisplay){ if(this._clockSignal){ this._originalClockDisplay.disconnect(this._clockSignal); this._clockSignal=null; } this._originalClockDisplay.visible=true; }
        if(this._customBox){ try{ this._customBox.destroy(); } catch(e){ logError(e); } this._customBox=null; this._timeLabel=null; this._dateLabel=null; }
    }
}