import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';

export class StyleManager {
    constructor(settings) {
        this._settings = settings.settings;
        if (!this._settings) {
            log('StyleManager: GSettings not available.');
            return;
        }

        const display = Gdk.Display.get_default();
        this._provider = new Gtk.CssProvider();
        Gtk.StyleContext.add_provider_for_display(display, this._provider, Gtk.STYLE_PROVIDER_PRIORITY_USER);

        // Initial application of styles
        this._applyStyles();

        // Listen for changes to any of the relevant settings.
        this._settings.connect('changed::enable-custom-theme', () => this._applyStyles());
        this._settings.connect('changed::enable-custom-style', () => this._applyStyles());
        this._settings.connect('changed::custom-css', () => this._applyStyles());
    }

    _applyStyles() {
        if (!this._settings.get_boolean('enable-custom-theme')) {
            this._provider.load_from_string('');
            return;
        }

        let fileCss = '';
        // Load CSS from all .css files in the style directory if enabled.
        if (this._settings.get_boolean('enable-custom-style')) {
            const baseDir = GLib.get_current_dir();
            const styleDir = Gio.File.new_for_path(GLib.build_filenamev([baseDir, 'style']));

            try {
                if (styleDir.query_exists(null)) {
                    const enumerator = styleDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
                    let fileInfo;
                    while ((fileInfo = enumerator.next_file(null))) {
                        const fileName = fileInfo.get_name();
                        if (fileName.endsWith('.css')) {
                            const cssPath = GLib.build_filenamev([baseDir, 'style', fileName]);
                            const [ok, contents] = GLib.file_get_contents(cssPath);
                            if (ok) {
                                const decodedContents = new TextDecoder().decode(contents);
                                fileCss += decodedContents + '\n';
                            }
                        }
                    }
                }
            } catch (e) {
                logError(e, 'Failed to read custom style files.');
            }
        }

        // Get the custom CSS snippet from settings.
        const snippetCss = this._settings.get_string('custom-css');

        // Combine file styles and the snippet. Snippet comes last to have override priority.
        const finalCss = fileCss + snippetCss;
        
        this._provider.load_from_string(finalCss);
    }
}

