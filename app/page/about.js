import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';

export function createAboutUI(navigator, goToPage) {
    const page = new Adw.PreferencesPage();

    // --- 0. LOAD METADATA ---
    const currentDir = GLib.get_current_dir();
    const metadataPath = GLib.build_filenamev([currentDir, 'metadata.json']);
    
    // Default values in case file is missing
    let metadata = {
        name: 'Demo',
        version: '0.beta',
        "developer-name": 'Lethil',
        description: 'A demonstration of responsive sidebar and deep linking.',
        url: '', // Base URL for relative links
        links: {
            "report-issue": "https://github.com",
            "license": "LICENSE" 
        }
    };

    try {
        if (GLib.file_test(metadataPath, GLib.FileTest.EXISTS)) {
            const [success, contents] = GLib.file_get_contents(metadataPath);
            if (success) {
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(contents);
                const loadedData = JSON.parse(jsonString);
                // Merge loaded data into defaults
                metadata = { ...metadata, ...loadedData };
            }
        } else {
            console.warn(`metadata.json not found at ${metadataPath}, using defaults.`);
        }
    } catch (e) {
        console.error('Error loading metadata.json:', e);
    }

    // --- 1. HEADER SECTION ---
    const headerBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6, 
        margin_top: 32,
        margin_bottom: 32,
        halign: Gtk.Align.CENTER
    });

    // A. LOGO 
    const iconPath = GLib.build_filenamev([currentDir, 'app', 'icon', 'icon.svg']);
    let logoWidget;
    
    if (GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
        logoWidget = new Gtk.Image({
            file: iconPath,
            pixel_size: 96, 
            margin_bottom: 12
        });
    } else {
        logoWidget = new Gtk.Image({
            icon_name: 'application-x-executable',
            pixel_size: 96,
            margin_bottom: 12
        });
    }

    // B. METADATA (Dynamic)
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
        label: metadata["developer-name"],
        css_classes: ['heading'], 
    });

    const description = new Gtk.Label({
        label: metadata.description,
        justify: Gtk.Justification.CENTER,
        wrap: true,
        css_classes: ['body'],
        margin_top: 6,
        max_width_chars: 40 // Prevent extremely wide text
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
    // Only show if links exist
    if (metadata.links && Object.keys(metadata.links).length > 0) {
        const docGroup = new Adw.PreferencesGroup({
            title: 'Documentation',
            description: 'Resources and help'
        });

        const createLinkRow = (title, uri) => {
            const row = new Adw.ActionRow({
                title: title,
                activatable: true
            });
            
            row.add_suffix(new Gtk.Image({ 
                icon_name: 'external-link-symbolic',
                css_classes: ['dim-label']
            }));

            row.connect('activated', () => {
                Gtk.show_uri(null, uri, Gdk.CURRENT_TIME);
            });

            return row;
        };

        // Iterate over links in metadata
        Object.entries(metadata.links).forEach(([key, rawUrl]) => {
            // 1. Smart URL Resolution
            let targetUrl = rawUrl;
            
            // Check if it is a full URL (http/https)
            const isFullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');

            if (!isFullUrl && metadata.url) {
                // Clean up slashes to avoid double slashes (e.g. url/ + /path)
                const baseUrl = metadata.url.endsWith('/') ? metadata.url.slice(0, -1) : metadata.url;
                const path = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
                targetUrl = `${baseUrl}/${path}`;
            }

            // 2. Format Title (e.g. "getting-started" -> "Getting Started")
            const title = key
                .split(/[-_]/) // Split by hyphen or underscore
                .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize
                .join(' ');

            docGroup.add(createLinkRow(title, targetUrl));
        });

        page.add(docGroup);
    }

    return page;
}