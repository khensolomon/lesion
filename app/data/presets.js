/**
 * Wallpaper Presets Configuration
 * * Structure:
 * - name: Display name
 * - image: (Optional) Single image for both modes
 * - image_light: (Optional) Light mode specific image
 * - image_dark: (Optional) Dark mode specific image
 * - system: Settings for 'org.gnome.desktop.background'
 * - primary-color, secondary-color, color-shading-type, picture-options
 * - extension: Settings for our extension schema
 */
export const WallpaperPresets = [
    {
        name: "Midnight Gradient",
        // No image = use color gradient
        system: {
            "primary-color": "#858583",
            "secondary-color": "#636362",
            "color-shading-type": "vertical", // 'solid', 'vertical', 'horizontal'
            "picture-options": "none", // 'none' usually hides image to show color
            "picture-uri": "",         // Clear image to show gradient
            "picture-uri-dark": ""
        },
        extension: {
            "wallpaper-primary-color-dark": "#1A1818",
            "wallpaper-secondary-color-dark": "#141414",
            "wallpaper-blur-sigma": 0,
            "wallpaper-monochrome": false,
            "wallpaper-brightness": 1.0,
            "wallpaper-show-image": false // Ensure image is toggled off
        }
    },
    {
        name: "Forest Focus",
        // Single image example
        image: "forest.jpg", 
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
        // Dual image example
        image_light: "chain-light.png",
        image_dark: "chain-dark.jpg",
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
        // Example with monochrome effect
        image: "hornbill.svg", 
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