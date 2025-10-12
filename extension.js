import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyExtension extends Extension {
  enable() {
    // apply or toggle theme logic here
  }
  disable() {
    // revert theme logic here
  }
}
