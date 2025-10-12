import GLib from 'gi://GLib';

export function loadMetadata() {
    const baseDir = GLib.get_current_dir();
    const metadataPath = GLib.build_filenamev([baseDir, 'metadata.json']);

    try {
        const [ok, contents] = GLib.file_get_contents(metadataPath);
        if (!ok)
            throw new Error(`Cannot read file: ${metadataPath}`);

        const text = new TextDecoder().decode(contents);
        const metadata = JSON.parse(text);

        // Basic validation
        if (!metadata.schemaId || !metadata.applicationId)
            throw new Error(`Missing required fields in metadata.json`);

        return metadata;
    } catch (e) {
        logError(e, `⚠️ Failed to load or parse ${metadataPath}`);
        throw e;
    }
}
