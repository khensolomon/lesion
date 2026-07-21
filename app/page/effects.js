import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { AppConfig } from '../config.js';

/**
 * Creates the "Window Corners" preferences page.
 *
 * @returns {Adw.PreferencesPage} The constructed preferences page.
 */
export function createEffectsUI() {
    const page = new Adw.PreferencesPage();
    const settings = AppConfig.getSettings();

    const mainGroup = new Adw.PreferencesGroup({
        title: 'Window Corners',
        description: 'Round all four corners of application windows uniformly, so legacy apps with flat bottom corners match modern ones. Maximized and fullscreen windows are automatically square.'
    });
    page.add(mainGroup);

    const enableRow = new Adw.SwitchRow({
        title: 'Uniform Rounded Corners',
        subtitle: 'Apply the same rounding to every window corner'
    });
    settings.bind('corners-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(enableRow);

    const radiusRow = new Adw.SpinRow({
        title: 'Corner Radius',
        subtitle: 'Pixels (matching GNOME\u2019s own decoration is around 12)',
        adjustment: new Gtk.Adjustment({
            lower: 1,
            upper: 40,
            step_increment: 1
        }),
        value: settings.get_int('corners-radius')
    });
    settings.bind('corners-radius', radiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('corners-enabled', radiusRow, 'sensitive', Gio.SettingsBindFlags.GET);
    mainGroup.add(radiusRow);

    const smartRow = new Adw.SwitchRow({
        title: 'Square Corners at Screen Edges',
        subtitle: 'Corners flush against a screen edge stay square, like tiled windows; corners facing the desktop stay rounded'
    });
    settings.bind('corners-smart-edges', smartRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('corners-enabled', smartRow, 'sensitive', Gio.SettingsBindFlags.GET);
    mainGroup.add(smartRow);

    const x11Row = new Adw.SwitchRow({
        title: 'Manage X11 Windows',
        subtitle: 'Applies effects to apps running through Xwayland. Disable if X11 apps destabilize the session'
    });
    settings.bind('effects-manage-x11', x11Row, 'active', Gio.SettingsBindFlags.DEFAULT);
    mainGroup.add(x11Row);

    // --- Window Transparency ---
    const transGroup = new Adw.PreferencesGroup({
        title: 'Window Transparency',
        description: 'Make unfocused windows slightly translucent. The focused window always stays fully opaque, so the window you are actively working in \u2014 a graphics editor, say \u2014 is never affected.'
    });
    page.add(transGroup);

    const transRow = new Adw.SwitchRow({
        title: 'Unfocused Transparency',
        subtitle: 'Dim windows in the background'
    });
    settings.bind('transparency-enabled', transRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    transGroup.add(transRow);

    const focusedRow = new Adw.SpinRow({
        title: 'Focused Opacity',
        subtitle: 'Percent \u2014 keep at 100 for graphics work; the active window is never dimmed by default',
        adjustment: new Gtk.Adjustment({
            lower: 50,
            upper: 100,
            step_increment: 1
        }),
        value: settings.get_int('transparency-focused-opacity')
    });
    settings.bind('transparency-focused-opacity', focusedRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('transparency-enabled', focusedRow, 'sensitive', Gio.SettingsBindFlags.GET);
    transGroup.add(focusedRow);

    const opacityRow = new Adw.SpinRow({
        title: 'Unfocused Opacity',
        subtitle: 'Percent \u2014 100 is fully opaque',
        adjustment: new Gtk.Adjustment({
            lower: 50,
            upper: 100,
            step_increment: 1
        }),
        value: settings.get_int('transparency-opacity')
    });
    settings.bind('transparency-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('transparency-enabled', opacityRow, 'sensitive', Gio.SettingsBindFlags.GET);
    transGroup.add(opacityRow);

    // Honest limitation, stated in the UI so nobody hunts for a hidden toggle
    const noteGroup = new Adw.PreferencesGroup();
    page.add(noteGroup);
    noteGroup.add(new Adw.ActionRow({
        title: 'Why is there no \u201Csquare corners\u201D mode?',
        subtitle: 'Apps draw their own rounded top corners; the pixels outside that curve do not exist, and an effect can only remove pixels \u2014 never invent window content. Uniformity is therefore achieved by rounding the flat corners to match.',
        activatable: false
    }));

    return page;
}
