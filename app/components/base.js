import Gio from 'gi://Gio';
import { AppConfig } from '../config.js';
import { logError } from '../util/logger.js';

/**
 * Base class for all extension components.
 * Handles Settings initialization and Signal cleanup automatically.
 */
export class ExtensionComponent {
    constructor(extension) {
        this._extension = extension;
        this._settings = null;
        this._signals = [];
        this._isEnabled = false;
    }

    /**
     * Helper to safely get settings
     */
    getSettings() {
        if (!this._settings) {
            try {
                this._settings = this._extension.getSettings(AppConfig.schemaId);
            } catch {
                this._settings = this._extension.getSettings();
            }
        }
        return this._settings;
    }

    /**
     * Helper to connect settings signal with auto-cleanup
     * @param {string} signal - e.g., 'changed::key-name'
     * @param {Function} callback 
     */
    observe(signal, callback) {
        const settings = this.getSettings();
        const id = settings.connect(signal, callback);
        this._signals.push({ obj: settings, id: id });
    }

    /**
     * Lifecycle: Called when extension is enabled
     */
    enable() {
        this._isEnabled = true;
        this.onEnable();
    }

    /**
     * Lifecycle: Called when extension is disabled
     */
    disable() {
        this._isEnabled = false;
        this.onDisable();
        this._cleanup();
    }

    /**
     * Override this for setup logic
     */
    onEnable() {}

    /**
     * Override this for teardown logic
     */
    onDisable() {}

    /**
     * Internal cleanup (signals, etc)
     */
    _cleanup() {
        this._signals.forEach(sig => sig.obj.disconnect(sig.id));
        this._signals = [];
        this._settings = null;
    }
}