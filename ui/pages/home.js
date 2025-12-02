const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

var HomePage = GObject.registerClass({ GTypeName: 'HomePage' },
    class HomePage extends Gtk.Box {
        constructor() {
            super({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                spacing: 12,
            });
            this.append(new Gtk.Label({
                label: 'Welcome to the Home Page!',
                css_classes: ['title-1']
            }));
        }
    }
);

