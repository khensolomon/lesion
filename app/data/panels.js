/**
 * Configuration structure for Panel Presets.
 * @typedef {Object} PanelPreset
 * @property {string} name 
 * @property {string} description 
 * @property {Object.<string, (string|number|boolean)>} data
 */

export const PanelsPresets = [
    {
        name: 'Default (GNOME)',
        description: 'Reset to standard GNOME appearance',
        data: {
            'panel-enabled': true,
            'panel-position': 0, 
            'panel-bg-color': 'rgba(0,0,0,1)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 0,
            'panel-shadow-enabled': false,
            'panel-blur-enabled': false,
            'panel-blur-sigma': 0,
            'panel-margin': 0,
            'panel-corner-radius': 0,
            'panel-btn-color': 'rgba(255,255,255,1)', // Default White
            'panel-btn-radius': 0,
            'panel-btn-pad-min': 4,
            'panel-btn-pad-nat': 8,
            'panel-btn-hover-enabled': false,
            'popup-radius': 12,
            'popup-shadow-enabled': true,
            'popup-border-size': 0,
            
            // Apps (Default Hidden/Native)
            'apps-showgrid-enabled': false,
            'apps-favorites-enabled': false,
            'apps-running-enabled': false
        }
    },
    {
        name: 'MacOS Dark',
        description: 'Translucent top bar. Clean, legible, and modern.',
        data: {
            'panel-enabled': true,
            'panel-position': 0, // Top
            'panel-bg-color': 'rgba(28, 28, 30, 0.75)', 
            'panel-bg-gradient-enabled': false,
            'panel-blur-enabled': true,
            'panel-blur-sigma': 0,
            
            'panel-border-size': 1,
            'panel-border-color': 'rgba(255,255,255,0.1)',
            'panel-border-style': 0,
            'panel-border-bottom-only': true, 
            
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,0,0,0.12)',
            'panel-shadow-y': 1,
            'panel-shadow-blur': 2,
            
            'panel-margin': 0,
            'panel-corner-radius': 0,

            'panel-btn-color': 'rgba(255,255,255,1)', // White Text
            'panel-btn-radius': 5,
            'panel-btn-pad-min': 4,
            'panel-btn-pad-nat': 10,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(255,255,255,0.1)',
            'panel-btn-bg-active': 'rgba(255,255,255,0.2)',

            'popup-radius': 10,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(255,255,255,0.1)',
            'popup-shadow-enabled': true,
            'popup-shadow-color': 'rgba(0,0,0,0.3)',

            'apps-showgrid-enabled': true, 
            'apps-showgrid-icon': 'start-here-symbolic', 
            'apps-showgrid-text': '', 
            'apps-favorites-enabled': true, 
            'apps-running-enabled': true
        }
    },
    {
        name: 'Daylight (Light)',
        description: 'White panel with black icons and text. Great for light wallpapers.',
        data: {
            'panel-enabled': true,
            'panel-position': 0, // Top
            'panel-bg-color': 'rgba(255, 255, 255, 0.85)', // White background
            'panel-bg-gradient-enabled': false,
            'panel-blur-enabled': true,
            'panel-blur-sigma': 0,
            
            'panel-border-size': 1,
            'panel-border-color': 'rgba(0,0,0,0.1)', // Subtle dark border
            'panel-border-style': 0,
            'panel-border-bottom-only': true, 
            
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,0,0,0.05)',
            'panel-shadow-y': 2,
            'panel-shadow-blur': 5,
            
            'panel-margin': 0,
            'panel-corner-radius': 0,

            // KEY CHANGE: BLACK TEXT
            'panel-btn-color': 'rgba(0,0,0,0.85)', 
            
            'panel-btn-radius': 5,
            'panel-btn-pad-min': 4,
            'panel-btn-pad-nat': 10,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(0,0,0,0.05)',
            'panel-btn-bg-active': 'rgba(0,0,0,0.1)',

            'popup-radius': 10,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(0,0,0,0.1)',
            'popup-shadow-enabled': true,
            'popup-shadow-color': 'rgba(0,0,0,0.1)',

            'apps-showgrid-enabled': true, 
            'apps-showgrid-icon': 'start-here-symbolic', 
            'apps-showgrid-text': '', 
            'apps-favorites-enabled': true, 
            'apps-running-enabled': true
        }
    },
    {
        name: 'Windows 11',
        description: 'Bottom taskbar style with centered feel and high contrast.',
        data: {
            'panel-enabled': true,
            'panel-position': 2, // Bottom
            // Dark Mica-like background
            'panel-bg-color': 'rgba(32, 32, 32, 0.90)', 
            'panel-bg-gradient-enabled': false,
            'panel-blur-enabled': true,
            'panel-blur-sigma': 0, 
            
            // 1px Border at the TOP edge (logic handles this)
            'panel-border-size': 1,
            'panel-border-color': 'rgba(255,255,255,0.08)', 
            'panel-border-style': 0,
            'panel-border-bottom-only': true, 

            'panel-shadow-enabled': false,
            
            'panel-margin': 0, 
            'panel-corner-radius': 0,

            'panel-btn-color': 'rgba(255,255,255,1)',
            'panel-btn-radius': 4,
            'panel-btn-pad-min': 6,
            'panel-btn-pad-nat': 10,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(255,255,255,0.05)',
            'panel-btn-bg-active': 'rgba(255,255,255,0.08)',

            'popup-radius': 8,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(255,255,255,0.08)',
            'popup-shadow-enabled': true,

            // Taskbar Elements
            'apps-showgrid-enabled': true,
            'apps-showgrid-icon': 'view-grid-symbolic',
            'apps-favorites-enabled': true,
            'apps-running-enabled': true,
            'apps-running-pos': 0,
            'apps-running-index': 0
        }
    },
    {
        name: 'Neon Cyber',
        description: 'High contrast black with colored glowing borders',
        data: {
            'panel-enabled': true,
            'panel-position': 0,
            'panel-bg-color': 'rgba(5,5,5,0.95)',
            'panel-bg-gradient-enabled': false,
            'panel-border-size': 2,
            'panel-border-color': 'rgba(0,255,255,1)', // Cyan
            'panel-border-style': 0,
            'panel-border-bottom-only': true,
            'panel-shadow-enabled': true,
            'panel-shadow-color': 'rgba(0,255,255,0.5)',
            'panel-shadow-y': 0,
            'panel-shadow-blur': 15,
            'panel-blur-enabled': false,
            'panel-blur-sigma': 0,
            'panel-btn-color': 'rgba(0,255,255,1)', // Cyan Text
            'panel-btn-radius': 0,
            'panel-btn-pad-min': 10,
            'panel-btn-pad-nat': 15,
            'panel-btn-hover-enabled': true,
            'panel-btn-bg-hover': 'rgba(0,255,255,0.15)',
            'panel-btn-bg-active': 'rgba(0,255,255,0.25)',
            'popup-radius': 0,
            'popup-border-size': 1,
            'popup-border-color': 'rgba(0,255,255,1)',
            'popup-shadow-enabled': true,
            'popup-shadow-color': 'rgba(0,255,255,0.2)',
            
            'apps-showgrid-enabled': true,
            'apps-favorites-enabled': true,
            'apps-running-enabled': true
        }
    }
];