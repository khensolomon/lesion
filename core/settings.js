import Gio from 'gi://Gio';
import { loadMetadata } from './config.js';

export class Settings {
    constructor() {
        const metadata = loadMetadata();
        this.schemaId = metadata.schemaId;

        try {
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            const schema = schemaSource.lookup(this.schemaId, true);
            if (!schema)
                throw new Error(`GSettings schema not found: ${this.schemaId}`);

            this.settings = new Gio.Settings({ settings_schema: schema });
        } catch (e) {
            logError(e, `⚠️ Failed to initialize GSettings for ${this.schemaId}`);
        }
    }

    get(key) {
        return this.settings?.get_value(key);
    }

    set(key, value) {
        if (this.settings)
            this.settings.set_value(key, value);
    }
}
