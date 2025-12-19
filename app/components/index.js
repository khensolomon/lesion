// Logic Modules (Moved from app/ext to app/components)
import { WallpaperManager } from './wallpaper.js';
import { StyleManager } from './styles.js';
import { CornersManager } from './corners.js';
import { GeometryManager } from './geometry.js';
import { ClockManager } from './clock.js';
import { DockManager } from './dock.js';

// Panel Widgets
import { Indicator } from '../panel/indicator.js';
import { ShowAppsButton } from '../panel/showapps.js';

/**
 * Returns the list of component classes to be instantiated.
 * The order can matter (e.g., load styles before UI).
 */
export function getComponents() {
    return [
        WallpaperManager,
        StyleManager,
        CornersManager,
        GeometryManager,
        ClockManager,
        DockManager,
        Indicator,
        ShowAppsButton
    ];
}