'use strict';

const { Adw, Gtk, Gio } = imports.gi;
Adw.init();

const win = new Adw.ApplicationWindow({
    application: new Adw.Application(),
    default_height: 400,
    default_width: 600,
    title: 'ViewSwitcher Test',
});

const headerbar = new Adw.HeaderBar();
win.set_titlebar(headerbar);

// Create the stack
const stack = new Adw.ViewStack();

// Add a few pages
stack.add_titled_with_icon(new Gtk.Label({ label: 'Page 1' }), 'page1', 'Page 1', 'face-smile-symbolic');
stack.add_titled_with_icon(new Gtk.Label({ label: 'Page 2' }), 'page2', 'Page 2', 'folder-symbolic');
stack.add_titled_with_icon(new Gtk.Label({ label: 'Page 3' }), 'page3', 'Page 3', 'help-about-symbolic');

// Step 1: get the live reference to pages
const pages = stack.get_pages();

// Step 2: Add “+” to each label before connecting to title
for (let i = 0; i < pages.get_n_items(); i++) {
    const page = pages.get_item(i);
    page.set_title('+' + page.get_title());
}

// Create the title switcher
const switcherTitle = new Adw.ViewSwitcherTitle({ title: 'Demo' });
switcherTitle.set_stack(stack);

// Step 3: Now modify labels for the bottom bar
for (let i = 0; i < pages.get_n_items(); i++) {
    const page = pages.get_item(i);
    page.set_title('-' + page.get_title().replace(/^\+/, ''));
}

// Create the bottom switcher
const switcherBar = new Adw.ViewSwitcherBar({ stack });
switcherBar.set_stack(stack);

// Layout
const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
vbox.append(stack);
vbox.append(switcherBar);

headerbar.pack_start(switcherTitle);
win.set_content(vbox);
win.present();
