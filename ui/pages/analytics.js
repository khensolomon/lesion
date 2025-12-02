const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

var AnalyticsPage = GObject.registerClass({ GTypeName: 'AnalyticsPage' },
    class AnalyticsPage extends Gtk.Box {
        constructor() {
            super({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                spacing: 12,
            });
            this.append(new Gtk.Label({
                label: 'Analytics Dashboard',
                css_classes: ['title-1']
            }));
        }
    }
);
