import { AppConfig } from '../config.js';

// A reference to the global log function provided by GJS.
// In GNOME 45+ log() is just an alias for console.log(); fall back explicitly
// so this also works in contexts where the alias is absent.
const _originalLog = globalThis.log ?? console.log;

/**
 * The custom log function.
 * It will only print if 'debug: true' is in metadata.json (via AppConfig).
 * @param {string} message - The message to log.
 * @param  {...any} args - Additional arguments to pass to the logger.
 */
export function log(message, ...args) {
    if (AppConfig.debug) {
        const msg = `${AppConfig.prefix} ${message}`;
        if (args.length > 0) {
            _originalLog(msg, ...args);
        } else {
            _originalLog(msg);
        }
    }
}

/**
 * A log function that *always* prints, regardless of debug status.
 * Use this for important warnings or errors.
 * Tolerates being called as logError(error) or logError(message, error) —
 * both patterns exist in the codebase.
 * @param {string|Error} message - The message (or an Error) to log.
 * @param  {...any} args - Additional arguments to pass to the logger.
 */
export function logError(message, ...args) {
    if (message instanceof Error) {
        const err = message;
        const extra = args.length > 0 ? `${args.join(' ')}: ` : '';
        _originalLog(`ERROR: ${AppConfig.prefix} ${extra}${err.message}\n${err.stack ?? ''}`);
        return;
    }
    const msg = `ERROR: ${AppConfig.prefix} ${message}`;
    if (args.length > 0) {
        _originalLog(msg, ...args);
    } else {
        _originalLog(msg);
    }
}