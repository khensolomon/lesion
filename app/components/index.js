// Panel Widgets
import { Indicator } from '../panel/indicator.js';
import { AppButton } from '../panel/appbutton.js';

// Logic Modules (Moved from app/ext to app/components)
import { WallpaperManager } from './wallpaper.js';
import { StyleManager } from './styles.js';
import { CornersManager } from './corners.js';
import { GeometryManager } from './geometry.js';
import { ClockManager } from './clock.js';
import { AppsManager } from './apps.js';
// import { DockManager } from './dock.js';
// import { MimicManager } from './mimic.js';

/**
 * Returns the list of component classes to be instantiated.
 * The order can matter (e.g., load styles before UI).
 */
export function getComponents() {
    return [
        Indicator,
        AppButton,
        
        WallpaperManager,
        StyleManager,
        CornersManager,
        GeometryManager,
        ClockManager,
        // DockManager,
        AppsManager,
        // MimicManager,
    ];
}