/**
 * A singleton configuration object.
 * Acts as the Single Source of Truth for App ID, Dimensions, Metadata, and Context.
 */
export const AppConfig = {
    // 1. Static Configuration (Design-time defaults)
    defaults: {
        id: 'com.example.GnomeSplitViewDemo',
        title: 'Gnome Split View Demo',
        window: {
            width: 800,
            height: 600,
            minWidth: 360,
            minHeight: 200
        }
    },

    // 2. Runtime State
    isExtension: false,
    path: null,       // File system path
    debug: false,     // Debug flag from metadata
    prefix: '[App]',  // Logging prefix
    appId: '',        // Calculated App ID
    
    metadata: {
        name: '', 
        version: '0.0.0',
        description: '',
        url: '',
        links: {},
        "schema-id": "",
        "developer-name": ""
    },
    
    /**
     * Initialize with data from app.js (File) or prefs.js (Shell)
     * @param {Object} metadata - The JSON content
     * @param {string} path - The file system path to the root directory
     * @param {boolean} isExtension - Whether running as an extension
     */
    init(metadata, path, isExtension = false) {
        this.metadata = { 
            ...this.metadata, 
            ...metadata 
        };
        
        this.path = path;
        this.isExtension = isExtension;
        
        // Context features
        this.debug = this.metadata.debug ?? false;
        
        // Ensure name has a fallback for prefix generation
        if (!this.metadata.name) {
            this.metadata.name = this.defaults.title;
        }
        this.prefix = `[${this.metadata.name}]`;

        // Determine actual App ID
        this.appId = metadata.uuid || metadata['application-id'] || this.defaults.id;
    },

    // --- Getters (Merged from Contexts) ---

    get uuid() {
        return this.metadata.uuid || this.defaults.id;
    },

    get name() {
        return this.metadata.name || this.defaults.title;
    },

    get schemaId() {
        // Fallback to a default if not present in metadata
        return this.metadata["schema-id"] || "dev.lethil.lesion";
    },
    
    get developer() {
        return this.metadata["developer-name"] || "Lethil";
    }
};