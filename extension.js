import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyThemeManagerExtension extends Extension {
    enable() {
        console.log(`[${this.uuid}] enabled.`);
    }

    disable() {
        console.log(`[${this.uuid}] disabled.`);
    }
}