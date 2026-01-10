/**
 * Wallpaper Presets Configuration
 * * * New Structure:
 * - name: Display name
 * - wallpaper: String (path relative to extension root) OR Object { light, dark }
 * - system: Settings for 'org.gnome.desktop.background'
 * - extension: Settings for our extension schema
 * * * Path Examples:
 * - "wallpaper/forest.jpg"  -> looks inside [extension_root]/wallpaper/
 * - "assets/bg.png"         -> looks inside [extension_root]/assets/
 * - "/usr/share/backgrounds/gnome/adwaita-l.jpg" -> Absolute path
 */
export const WallpaperPresets = [
    {
        name: "Midnight Gradient",
        // No wallpaper property = use system colors defined below
        system: {
            "primary-color": "#858583",
            "secondary-color": "#636362",
            "color-shading-type": "vertical",
            "picture-options": "none",
            "picture-uri": "",
            "picture-uri-dark": ""
        },
        extension: {
            "wallpaper-primary-color-dark": "#1A1818",
            "wallpaper-secondary-color-dark": "#141414",
            "wallpaper-blur-sigma": 0,
            "wallpaper-monochrome": false,
            "wallpaper-brightness": 1.0,
            "wallpaper-show-image": false
        }
    },
    {
        name: "Hornbill Forest",
        // Simple string: applies to both Light and Dark
        // Flexible path: we now explicitly say "wallpaper/..."
        wallpaper: "icon/hornbill-symbolic.svg", 
        system: {
            "primary-color": "#6e6e6eff",
            "secondary-color": "#555555ff",
            "color-shading-type": "solid",
            "picture-options": "zoom"
        },
        extension: {
            "wallpaper-primary-color-dark": "#1e3020",
            "wallpaper-secondary-color-dark": "#0f1a10",
            "wallpaper-blur-sigma": 5,
            "wallpaper-monochrome": false,
            "wallpaper-brightness": 0.9,
            "wallpaper-show-image": true
        }
    },
    {
        name: "Day & Night",
        // Object: distinct images for modes
        wallpaper: {
            light: "wallpaper/chain-light.png",
            dark: "wallpaper/chain-dark.jpg"
        },
        system: {
            "primary-color": "#9B9797",
            "secondary-color": "#7E7D7D",
            "picture-options": "zoom"
        },
        extension: {
            "wallpaper-primary-color-dark": "#000000",
            "wallpaper-secondary-color-dark": "#000000",
            "wallpaper-blur-sigma": 0,
            "wallpaper-monochrome": false,
            "wallpaper-brightness": 1.0,
            "wallpaper-show-image": true
        }
    },
    {
        name: "Mono Minimal",
        // Example: could be in a different folder if you wanted
        wallpaper: "wallpaper/hornbill.svg", 
        system: {
            "primary-color": "#929292ff",
            "secondary-color": "#dedede",
            "picture-options": "scaled"
        },
        extension: {
            "wallpaper-primary-color-dark": "#333333",
            "wallpaper-secondary-color-dark": "#111111",
            "wallpaper-blur-sigma": 0,
            "wallpaper-monochrome": true,
            "wallpaper-brightness": 1.0,
            "wallpaper-show-image": true
        }
    }
];