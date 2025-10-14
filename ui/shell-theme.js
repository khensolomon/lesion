import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export function buildThemesPage(settings) {
    const pageBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
        spacing: 18,
    });

    const scrolledWindow = new Gtk.ScrolledWindow({
        child: pageBox,
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vexpand: true,
    });
    
    const group = new Adw.PreferencesGroup({ title: 'Theme Settings' });
    pageBox.append(group);
    
    if (!settings) {
        group.set_sensitive(false);
        group.set_description('Could not load settings. Ensure schemas are compiled and installed.');
        return scrolledWindow;
    }

    const themeSwitchRow = new Adw.SwitchRow({
        title: 'Enable Custom Theme',
        subtitle: 'Toggle all custom themeing on or off',
        subtitle_lines: 1,
    });
    settings.bind('enable-custom-theme', themeSwitchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(themeSwitchRow);

    const customStyleSwitch = new Adw.SwitchRow({
        title: 'Enable Custom Stylesheets',
        subtitle: 'Load and apply all .css files from the ./style directory',
        subtitle_lines: 1,
    });
    settings.bind('enable-custom-style', customStyleSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(customStyleSwitch);

    const themeModel = new Gtk.StringList();
    themeModel.append('Default');
    themeModel.append('Sweet-Dark');
    themeModel.append('Orchis-Light');
    
    const themeComboRow = new Adw.ComboRow({
        title: 'Active Theme',
        subtitle: 'Select a theme to apply',
        model: themeModel,
        subtitle_lines: 1,
    });
    group.add(themeComboRow);

    const cssExpander = new Adw.ExpanderRow({
        title: 'Custom CSS Snippet',
        subtitle: 'Apply additional CSS rules',
        subtitle_lines: 1,
    });
    
    const cssTextView = new Gtk.TextView({
        wrap_mode: Gtk.WrapMode.WORD_CHAR,
        monospace: true,
        accepts_tab: true,
        vexpand: true,
    });
    settings.bind('custom-css', cssTextView.get_buffer(), 'text', Gio.SettingsBindFlags.DEFAULT);

    const scrolledCssWindow = new Gtk.ScrolledWindow({
         height_request: 150,
         child: cssTextView,
         propagate_natural_height: true,
    });
    cssExpander.add_row(scrolledCssWindow);
    group.add(cssExpander);

    return scrolledWindow;
}
