import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import { ExtensionComponent } from './base.js';

// 1. Define the class cleanly (Standard ES6 Syntax)
class MimicButtonBase extends PanelMenu.Button {
    
    _init(iconName, name) {
        super._init(0.0, name);

        // Icon
        const icon = new St.Icon({
            icon_name: iconName, 
            style_class: 'system-status-icon',
        });
        this.add_child(icon);
        this.set_accessible_name(name);

        this._buildMenu();
        this._setupDragAndDrop();
    }

    _setupDragAndDrop() {
        this._dragged = false;
        this._draggable = DND.makeDraggable(this, {
            manualMode: false
        });

        this._draggable.connect('drag-begin', () => {
            this._dragged = true;
            this.opacity = 100;
        });

        this._draggable.connect('drag-end', () => {
            this.opacity = 255;
            this._dragged = false;
            this._handleReorder();
        });
        
        this.connect('button-press-event', () => Clutter.EVENT_PROPAGATE);
    }

    _handleReorder() {
        const parent = this.get_parent();
        if (!parent) return;

        const [x, y] = global.get_pointer();
        const children = parent.get_children();
        let targetIndex = children.length; 
        
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child === this) continue;
            
            const [childX, childY] = child.get_transformed_position();
            if (x < childX + (child.width / 2)) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex >= children.length) parent.add_child(this); 
        else parent.insert_child_at_index(this, targetIndex);
    }

    _buildMenu() {
        const header = new PopupMenu.PopupMenuItem('Mimic Options', { reactive: false });
        header.actor.add_style_class_name('popup-subtitle-menu-item');
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addAction('Reload Extension', () => console.log('Reload'));
        this.menu.addAction('Reset Layout', () => console.log('Reset'));
    }

    vfunc_event(event) {
        const type = event.type();

        if (type === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            if (button === 3) { // Right Click
                this.menu.toggle();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE; 
        }

        if (type === Clutter.EventType.BUTTON_RELEASE) {
            const button = event.get_button();
            if (button === 1 && !this._dragged) { // Left Click
                Main.overview.toggle();
                return Clutter.EVENT_STOP;
            }
        }

        return super.vfunc_event(event);
    }
}

// 2. Register it at the end (Much cleaner)
// We assign it to a const so we can instantiate it below
const MimicButton = GObject.registerClass(
    { GTypeName: 'LesionMimicButton' }, // Optional: Unique name helps debugging
    MimicButtonBase
);

// 3. Manager Component
export class MimicManager extends ExtensionComponent {
    onEnable() {
        this._buttons = [];

        const btn1 = new MimicButton('face-laugh-symbolic', 'Mimic Laugh');
        Main.panel.addToStatusArea('mimic-button-1', btn1, 0, 'left');
        this._buttons.push(btn1);

        const btn2 = new MimicButton('face-cool-symbolic', 'Mimic Cool');
        Main.panel.addToStatusArea('mimic-button-2', btn2, 1, 'left');
        this._buttons.push(btn2);
    }

    onDisable() {
        this._buttons.forEach(btn => btn.destroy());
        this._buttons = [];
    }
}