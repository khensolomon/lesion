import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js'; 

export function createAboutUI(navigator, goToPage) {
    const page = new Adw.PreferencesPage();
    const metadata = AppConfig.metadata;

    // --- 1. HEADER SECTION ---
    const headerBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6, 
        margin_top: 32,
        margin_bottom: 32,
        halign: Gtk.Align.CENTER
    });

    // Logo Logic
    const rootDir = AppConfig.path || GLib.get_current_dir();
    const iconPath = GLib.build_filenamev([rootDir, 'app', 'icon', 'icon.svg']);
    
    let logoWidget;
    if (GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
        logoWidget = new Gtk.Image({ file: iconPath, pixel_size: 96, margin_bottom: 12 });
    } else {
        logoWidget = new Gtk.Image({ icon_name: 'application-x-executable', pixel_size: 96, margin_bottom: 12 });
    }

    // Metadata Labels
    const appName = new Gtk.Label({ label: metadata.name, css_classes: ['title-1'], margin_bottom: 0, wrap: true, justify: Gtk.Justification.CENTER });
    const version = new Gtk.Label({ label: `v${metadata.version}`, css_classes: ['title-4', 'dim-label'], margin_bottom: 12 });
    const developer = new Gtk.Label({ label: metadata["developer-name"] || 'Unknown Developer', css_classes: ['heading'] });
    const description = new Gtk.Label({ label: metadata.description || '', justify: Gtk.Justification.CENTER, wrap: true, css_classes: ['body'], margin_top: 6, max_width_chars: 40 });

    headerBox.append(logoWidget);
    headerBox.append(appName);
    headerBox.append(version);
    headerBox.append(developer);
    headerBox.append(description);

    const headerGroup = new Adw.PreferencesGroup();
    headerGroup.add(headerBox);
    page.add(headerGroup);

    // --- 2. DOCUMENTATION SECTION ---
    // Check if links exist in the metadata loaded by AppConfig
    if (metadata.links && Object.keys(metadata.links).length > 0) {
        const docGroup = new Adw.PreferencesGroup({
            title: 'Documentation',
            description: 'Resources and help'
        });

        const createLinkRow = (title, uri) => {
            const row = new Adw.ActionRow({ title: title, activatable: true });
            row.add_suffix(new Gtk.Image({ icon_name: 'external-link-symbolic', css_classes: ['dim-label'] }));
            row.connect('activated', () => {
                try {
                    const launcher = new Gtk.UriLauncher({ uri: uri });
                    launcher.launch(null, null, null);
                } catch (e) {
                    console.error("Gtk.UriLauncher failed:", e);
                }
            });
            return row;
        };

        Object.entries(metadata.links).forEach(([key, rawUrl]) => {
            let targetUrl = rawUrl;
            const isFullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');

            // Resolve relative URLs using metadata.url
            if (!isFullUrl && metadata.url) {
                const baseUrl = metadata.url.endsWith('/') ? metadata.url.slice(0, -1) : metadata.url;
                const path = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
                targetUrl = `${baseUrl}/${path}`;
            }

            const title = key.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            docGroup.add(createLinkRow(title, targetUrl));
        });

        page.add(docGroup);
    }

    return page;
}