/**
 * Configuration structure for Panel Presets.
 * * Each preset object contains metadata and a data object mapping 
 * GSettings keys to their values.
 *
 * @typedef {Object} PanelPreset
 * @property {string} name - The display name of the preset.
 * @property {string} description - A brief description of the style.
 * @property {Object.<string, (string|number|boolean)>} data - Key-value pairs matching the GSchema keys.
 * * Supported Keys in `data`:
 * - panel-enabled (boolean)
 * - panel-bg-color (string rgba)
 * - panel-bg-gradient-enabled (boolean)
 * - panel-bg-gradient-color (string rgba)
 * - panel-bg-gradient-dir (int: 0=vertical, 1=horizontal)
 * - panel-border-size (int)
 * - panel-border-color (string rgba)
 * - panel-border-style (int enum: 0=solid, 1=dotted, 2=dashed, 3=double, 4=groove, 5=ridge, 6=inset, 7=outset, 8=none)
 * - panel-border-bottom-only (boolean)
 * - panel-shadow-enabled (boolean)
 * - panel-shadow-color (string rgba)
 * - panel-shadow-x (int)
 * - panel-shadow-y (int)
 * - panel-shadow-blur (int)
 * - panel-shadow-spread (int)
 * - panel-shadow-inset (boolean)
 * - panel-btn-radius (int)
 * - panel-btn-pad-min (int)
 * - panel-btn-pad-nat (int)
 * - panel-btn-hover-enabled (boolean)
 * - panel-btn-bg-hover (string rgba)
 * - panel-btn-bg-active (string rgba)
 * - popup-radius (int)
 * - popup-border-size (int)
 * - popup-border-color (string rgba)
 * - popup-border-style (int enum)
 * - popup-shadow-enabled (boolean)
 * - popup-shadow-color (string rgba)
 * - popup-shadow-x (int)
 * - popup-shadow-y (int)
 * - popup-shadow-blur (int)
 * - popup-shadow-spread (int)
 */

/**
 * List of available panel customization presets.
 * @type {PanelPreset[]}
 */
export const PanelsPresets = [
    {
        name: 'Default (GNOME)',
        description: 'Reset to standard GNOME appearance',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgba(0,0,0,1)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 0,
            'panel-shadow-enabled': false,
            'panel-btn-radius': 0,
            'panel-btn-pad-min': 4,
            'panel-btn-pad-nat': 8,
            'panel-btn-hover-enabled': false,
            'popup-radius': 12,
            'popup-shadow-enabled': true,
            'popup-border-size': 0
        }
    },
    {
        name: 'Chain link',
        description: 'Modern, floating, semi-transparent dark theme',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgba(0,0,0,0.86)',
            'panel-bg-gradient-enabled': true,
            'panel-bg-gradient-color': 'rgba(0,0,0,0.70)',
            'panel-bg-gradient-dir': 0, // Vertical

            'panel-border-size': 1,
            'popup-border-color': 'rgba(255,255,255,0.09)',
            'panel-border-style': 0, // Solid
            'panel-border-bottom-only': true,

            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,0,0,0.76)',
            'panel-shadow-x': 0,
            'panel-shadow-y': -2,
            'panel-shadow-blur': 3,
            'panel-shadow-spread': 0,

            'panel-btn-radius': 8,
            'panel-btn-pad-min': 8,
            'panel-btn-pad-nat': 8,
            'panel-btn-hover-enabled': false,
            'popup-radius': 8,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(255,255,255,0.1)',
            'popup-shadow-enabled': true
        }
    },
    {
        name: 'Glassy Dark',
        description: 'Modern, floating, semi-transparent dark theme',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgba(30,30,30,0.85)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 1,
            'panel-border-color': 'rgba(255,255,255,0.1)',
            'panel-border-style': 0, // Solid
            'panel-border-bottom-only': false,
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,0,0,0.5)',
            'panel-shadow-y': 4,
            'panel-shadow-blur': 12,
            'panel-btn-radius': 12,
            'panel-btn-pad-min': 8,
            'panel-btn-pad-nat': 12,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(255,255,255,0.15)',
            'panel-btn-bg-active': 'rgba(255,255,255,0.25)',
            'popup-radius': 16,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(255,255,255,0.1)',
            'popup-shadow-enabled': true
        }
    },
    {
        name: 'Floating Light (Mac-ish)',
        description: 'Bright, translucent with soft shadows',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgba(255,255,255,0.7)',
            'panel-bg-gradient-enabled': true,
            'panel-bg-gradient-color': 'rgba(240,240,240,0.8)',
            'panel-bg-gradient-dir': 0, // Vertical
            'panel-border-size': 1,
            'panel-border-color': 'rgba(255,255,255,0.5)',
            'panel-border-style': 0,
            'panel-border-bottom-only': false,
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,0,0,0.15)',
            'panel-shadow-y': 2,
            'panel-shadow-blur': 10,
            'panel-btn-radius': 8,
            'panel-btn-pad-min': 6,
            'panel-btn-pad-nat': 10,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(0,0,0,0.05)',
            'panel-btn-bg-active': 'rgba(0,0,0,0.1)',
            'popup-radius': 12,
            'popup-border-size': 0,
            'popup-shadow-enabled': true
        }
    },
    {
        name: 'Retro 95',
        description: 'Classic gray bevels and sharp corners',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgb(192,192,192)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 2,
            'panel-border-color': 'white',
            'panel-border-style': 7, // Outset
            'panel-border-bottom-only': false,
            'panel-shadow-enabled': false,
            'panel-btn-radius': 0,
            'panel-btn-pad-min': 4,
            'panel-btn-pad-nat': 6,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgb(220,220,220)',
            'panel-btn-bg-active': 'rgb(128,128,128)',
            'popup-radius': 0,
            'popup-border-size': 2,
            'popup-border-color': 'rgb(255,255,255)',
            'popup-border-style': 7, // Outset
            'popup-shadow-enabled': false
        }
    },
    {
        name: 'Neon Cyber',
        description: 'High contrast black with colored glowing borders',
        data: {
            'panel-enabled': true,
            'panel-bg-color': 'rgba(10,10,10,0.95)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 2,
            'panel-border-color': 'rgba(0,255,255,1)', // Cyan
            'panel-border-style': 0,
            'panel-border-bottom-only': true,
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,255,255,0.6)', // Cyan glow
            'panel-shadow-y': 0,
            'panel-shadow-blur': 15,
            'panel-shadow-spread': 2,
            'panel-btn-radius': 0,
            'panel-btn-pad-min': 10,
            'panel-btn-pad-nat': 15,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(0,255,255,0.1)',
            'panel-btn-bg-active': 'rgba(0,255,255,0.2)',
            'popup-radius': 0,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(0,255,255,1)',
            'popup-shadow-enabled': true,
            'popup-shadow-color': 'rgba(0,255,255,0.3)'
        }
    }
];