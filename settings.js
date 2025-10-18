'use strict';

const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;

function getSettings() {
    const schema = 'dev.lethil.lesion';
    const GioSSS = Gio.SettingsSchemaSource;

    const extension = ExtensionUtils.getCurrentExtension();
    const schemaDir = extension.dir.get_child('schemas');
    const schemaSrc = GioSSS.new_from_directory(
        schemaDir.get_path(),
        GioSSS.get_default(),
        false
    );

    const schemaObj = schemaSrc.lookup(schema, true);
    if (!schemaObj)
        throw new Error(`[Lesion] Schema ${schema} not found`);

    return new Gio.Settings({ settings_schema: schemaObj });
}
