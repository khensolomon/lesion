import Clutter from 'gi://Clutter';

/**
 * Compatibility helpers.
 *
 * Every API that behaves differently across supported GNOME versions
 * (46–49) lives here, so a new GNOME release means updating ONE file
 * instead of hunting through every component.
 */

/**
 * St.BoxLayout 'vertical' is deprecated since GNOME 48 in favor of
 * 'orientation'. Use whichever the running shell supports.
 */
export function setVertical(box, vertical) {
    if ('orientation' in box) {
        box.orientation = vertical
            ? Clutter.Orientation.VERTICAL
            : Clutter.Orientation.HORIZONTAL;
    } else {
        box.vertical = vertical;
    }
}

/**
 * Meta.Window.get_maximized() was removed in GNOME 49; is_maximized()
 * replaces it. Falls back through the property pair and the legacy method.
 */
export function isMaximized(win) {
    if (typeof win.is_maximized === 'function') return win.is_maximized();
    if ('maximized_horizontally' in win)
        return win.maximized_horizontally && win.maximized_vertically;
    if (typeof win.get_maximized === 'function') return win.get_maximized() !== 0;
    return false;
}
