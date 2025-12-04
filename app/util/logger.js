import { AppConfig } from '../config.js';

// A reference to the original, global log function provided by GJS
const _originalLog = globalThis.log;

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
 * @param {string} message - The message to log.
 * @param  {...any} args - Additional arguments to pass to the logger.
 */
export function logError(message, ...args) {
    const msg = `ERROR: ${AppConfig.prefix} ${message}`;
    if (args.length > 0) {
        _originalLog(msg, ...args);
    } else {
        _originalLog(msg);
    }
}