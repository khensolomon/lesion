import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import { AppConfig } from '../config.js'; // Import Unified Config

export function createAboutUI(navigator, goToPage) {
    const page = new Adw.PreferencesPage();

    // Use the unified metadata
    const metadata = AppConfig.metadata;

    // --- 1. HEADER SECTION ---
    const headerBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6, 
        margin_top: 32,
        margin_bottom: 32,
        halign: Gtk.Align.CENTER
    });

    // A. LOGO 
    // Logic remains similar but relies on explicit paths or theme
    // For standalone, we might still check the file, but for extensions,
    // icons are usually handled by the theme installed by the extension.
    const currentDir = GLib.get_current_dir();
    const iconPath = GLib.build_filenamev([currentDir, 'app', 'icon', 'icon.svg']);
    
    let logoWidget;
    // Simple check: if standalone & file exists, use file. Else use themed icon.
    if (!AppConfig.isExtension && GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
        logoWidget = new Gtk.Image({ file: iconPath, pixel_size: 96, margin_bottom: 12 });
    } else {
        // In extension mode, or fallback, assume icon is installed in theme
        // or use a generic one
        logoWidget = new Gtk.Image({ 
            icon_name: 'application-x-executable', // or AppConfig.appId
            pixel_size: 96,
            margin_bottom: 12
        });
    }

    // B. METADATA
    const appName = new Gtk.Label({
        label: metadata.name,
        css_classes: ['title-1'], 
        margin_bottom: 0,
        wrap: true,
        justify: Gtk.Justification.CENTER
    });

    const version = new Gtk.Label({
        label: `v${metadata.version}`,
        css_classes: ['title-4', 'dim-label'], 
        margin_bottom: 12 
    });

    const developer = new Gtk.Label({
        label: metadata["developer-name"] || 'Unknown Developer',
        css_classes: ['heading'], 
    });

    const description = new Gtk.Label({
        label: metadata.description || '',
        justify: Gtk.Justification.CENTER,
        wrap: true,
        css_classes: ['body'],
        margin_top: 6,
        max_width_chars: 40
    });

    headerBox.append(logoWidget);
    headerBox.append(appName);
    headerBox.append(version);
    headerBox.append(developer);
    headerBox.append(description);

    const headerGroup = new Adw.PreferencesGroup();
    headerGroup.add(headerBox);
    page.add(headerGroup);

    // --- 2. DOCUMENTATION SECTION ---
    if (metadata.links && Object.keys(metadata.links).length > 0) {
        const docGroup = new Adw.PreferencesGroup({
            title: 'Documentation',
            description: 'Resources and help'
        });

        const createLinkRow = (title, uri) => {
            const row = new Adw.ActionRow({ title: title, activatable: true });
            
            row.add_suffix(new Gtk.Image({ 
                icon_name: 'external-link-symbolic',
                css_classes: ['dim-label']
            }));

            row.connect('activated', () => {
                // MODERN API: Gtk.UriLauncher (GTK 4.10+)
                // Replaces the deprecated Gtk.show_uri
                try {
                    const launcher = new Gtk.UriLauncher({ uri: uri });
                    // launch() takes (parent, cancellable, callback)
                    // We can pass null for parent/cancellable in simple cases
                    launcher.launch(null, null, (obj, res) => {
                        try {
                            launcher.launch_finish(res);
                        } catch (e) {
                            console.warn(`Failed to launch URI ${uri}: ${e.message}`);
                        }
                    });
                } catch (e) {
                    console.error("Gtk.UriLauncher failed:", e);
                }
            });

            return row;
        };

        Object.entries(metadata.links).forEach(([key, rawUrl]) => {
            let targetUrl = rawUrl;
            const isFullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');

            if (!isFullUrl && metadata.url) {
                const baseUrl = metadata.url.endsWith('/') ? metadata.url.slice(0, -1) : metadata.url;
                const path = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
                targetUrl = `${baseUrl}/${path}`;
            }

            const title = key
                .split(/[-_]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            docGroup.add(createLinkRow(title, targetUrl));
        });

        page.add(docGroup);
    }

    return page;
}