import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { log, logError } from './app/util/logger.js';
import { AppConfig } from './app/config.js';
// Updated import path to components
import { getComponents } from './app/components/index.js';

export default class LesionExtension extends Extension {
    _instances = [];

    enable() {
        AppConfig.init(this.metadata, this.path, true);
        log("System started.");

        // Instantiate and Enable all components from the registry
        this._instances = getComponents().map(ComponentClass => {
            try {
                const instance = new ComponentClass(this);
                if (typeof instance.enable === 'function') {
                    instance.enable();
                }
                return instance;
            } catch (e) {
                logError(`Failed to load component ${ComponentClass.name}`, e);
                return null;
            }
        }).filter(i => i !== null);
    }

    disable() {
        log("System stopping.");

        // Disable in reverse order (LIFO) for safe dependency teardown
        [...this._instances].reverse().forEach(instance => {
            try {
                if (typeof instance.disable === 'function') {
                    instance.disable();
                }
            } catch (e) {
                logError("Error disabling component", e);
            }
        });

        this._instances = [];
    }

    openPreferences(page) {
        super.openPreferences();
        
        if (page) {
            try {
                // We access the schema ID via AppConfig, but need to be careful if Config isn't initialized yet 
                // (though in openPreferences it usually is).
                // Safest to use metadata fallback if needed.
                const schema = AppConfig.schemaId || this.metadata['settings-schema'];
                const s = this.getSettings(schema);
                s.set_string("open-page", page);
            } catch(e) {}
        }
    }
}