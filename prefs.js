import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createUI, installLayout } from './app/window.js';
import { AppConfig } from './app/config.js';
import { log, logError } from './app/util/logger.js';

export default class GnomeSplitViewPrefs extends ExtensionPreferences {
    _settings = null;
    _settingsSignal = null;

    fillPreferencesWindow(window) {
        try {
            // FIX: Robustly load fresh metadata from disk using Gio
            const freshMetadata = this._loadLocalMetadata(this.path);
            
            // Merge: Shell metadata (base) + Disk metadata (overrides)
            // This ensures 'links' appear even if Shell cached an old version
            const finalMetadata = { ...this.metadata, ...freshMetadata };

            // 1. Init Config
            AppConfig.init(finalMetadata, this.path, true);
            
            // Debug: Check if links are actually loaded
            const linkCount = finalMetadata.links ? Object.keys(finalMetadata.links).length : 0;
            log(`Preferences initializing... Loaded ${linkCount} links from metadata.`);

            // 2. Set Size Defaults
            window.set_default_size(
                AppConfig.defaults.window.width,
                AppConfig.defaults.window.height
            );
            window.set_size_request(
                AppConfig.defaults.window.minWidth,
                AppConfig.defaults.window.minHeight
            );

            // 3. Load CSS
            this._loadCustomStyles();

            // 4. Create UI
            const splitView = createUI();
            window.set_content(splitView);
            
            installLayout(window, splitView);
            this._setupDeepLinking(splitView);

            // 5. Cleanup
            window.connect('close-request', () => {
                if (this._settings && this._settingsSignal) {
                    this._settings.disconnect(this._settingsSignal);
                }
                this._settings = null;
            });

        } catch (e) {
            console.error(`PREFS ERROR: ${e.message}`);
            // Fallback UI
            const errorPage = new Adw.StatusPage({
                title: "Preferences Error",
                description: e.message,
                icon_name: "dialog-error-symbolic"
            });
            window.set_content(errorPage);
        }
    }

    /**
     * Helper: Reads metadata.json using Gio.File (Robust)
     */
    _loadLocalMetadata(extensionPath) {
        try {
            const jsonPath = GLib.build_filenamev([extensionPath, 'metadata.json']);
            const file = Gio.File.new_for_path(jsonPath);
            
            const [success, contents] = file.load_contents(null);
            if (success) {
                const decoder = new TextDecoder('utf-8');
                return JSON.parse(decoder.decode(contents));
            }
        } catch (e) {
            console.warn(`Failed to reload metadata from disk: ${e.message}`);
        }
        return {};
    }

    _loadCustomStyles() {
        try {
            const cssPath = GLib.build_filenamev([this.path, 'style', 'prefs.css']);
            const file = Gio.File.new_for_path(cssPath);
            
            if (file.query_exists(null)) {
                const cssProvider = new Gtk.CssProvider();
                cssProvider.load_from_path(cssPath);
                Gtk.StyleContext.add_provider_for_display(
                    Gdk.Display.get_default(),
                    cssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_USER
                );
            }
        } catch (e) {
            logError(`Failed to load prefs.css`, e);
        }
    }

    _setupDeepLinking(splitView) {
        try {
            this._settings = new Gio.Settings({ schema_id: AppConfig.schemaId });

            const checkOpenPage = () => {
                const pageId = this._settings.get_string("open-page");
                if (pageId && pageId.length > 0) {
                    const contentPage = splitView.get_content(); 
                    if (contentPage) {
                        const navView = contentPage.get_child();
                        if (navView && typeof navView.pushName === 'function') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                                navView.pushName(pageId);
                                return GLib.SOURCE_REMOVE;
                            });
                        }
                    }
                    this._settings.set_string("open-page", "");
                }
            };

            checkOpenPage();
            this._settingsSignal = this._settings.connect('changed::open-page', checkOpenPage);

        } catch (e) {
            log(`Failed to initialize deep linking: ${e.message}`);
        }
    }
}