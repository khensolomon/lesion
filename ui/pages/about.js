const { Gtk, GObject } = imports.gi;

var AboutPage = GObject.registerClass({ GTypeName: 'AboutPage' },
    class AboutPage extends Gtk.Box {
        constructor() {
            super({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                spacing: 12,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 36,
                margin_end: 36,
            });

            const shortDescLabel = new Gtk.Label({
                label: 'A modern application shell built with GJS and Libadwaita.',
                css_classes: ['title-3'],
                halign: Gtk.Align.CENTER,
            });

            const versionBox = new Gtk.Box({
                halign: Gtk.Align.CENTER,
                spacing: 6,
            });
            versionBox.append(new Gtk.Label({ label: 'Version:', css_classes: ['body', 'bold']}));
            versionBox.append(new Gtk.Label({ label: '1.0.0', css_classes: ['body']}));

            const linkButton = new Gtk.LinkButton({
                uri: 'https://www.gnome.org',
                label: 'Visit Project Website',
                halign: Gtk.Align.CENTER,
            });

            const longDescLabel = new Gtk.Label({
                label: 'This application demonstrates a dynamic, data-driven shell architecture. It features a responsive layout, automatic theme adaptation, and a modular page system that can be easily extended.',
                wrap: true,
                justify: Gtk.Justification.CENTER,
                halign: Gtk.Align.CENTER,
                css_classes: ['body'],
                max_width_chars: 60,
            });

            this.append(new Gtk.Label({ label: 'About This App', css_classes: ['title-1'] }));
            this.append(shortDescLabel);
            this.append(versionBox);
            this.append(linkButton);
            this.append(longDescLabel);
        }
    }
);
