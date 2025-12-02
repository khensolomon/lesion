const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

var SettingsPage = GObject.registerClass({ GTypeName: 'SettingsPage' },
    class SettingsPage extends Gtk.Box {
        constructor() {
            super({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                spacing: 12,
            });
            this.append(new Gtk.Label({
                label: 'Application Settings',
                css_classes: ['title-1']
            }));
        }
    }
);
