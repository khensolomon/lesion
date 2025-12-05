/**
 * A singleton configuration object.
 * Acts as the Single Source of Truth for App ID, Dimensions, Metadata, and Context.
 */
export const AppConfig = {
    // 1. Static Configuration
    defaults: {
        id: 'com.lethil.GnomeSplitViewDemo',
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
    path: null,       
    debug: false,     
    prefix: '[App]',  
    appId: '',        
    
    metadata: {
        name: '', 
        version: '0.0.0',
        description: '',
        url: '',
        links: {},
        "settings-schema": "", // Standard Key
        "schema-id": "",       // Custom Key
        "developer-name": ""
    },
    
    init(metadata, path, isExtension = false) {
        this.metadata = { ...this.metadata, ...metadata };
        this.path = path;
        this.isExtension = isExtension;
        
        this.debug = this.metadata.debug ?? false;
        
        if (!this.metadata.name) {
            this.metadata.name = this.defaults.title;
        }
        this.prefix = `[${this.metadata.name}]`;

        this.appId = metadata.uuid || metadata['application-id'] || this.defaults.id;
    },

    get uuid() {
        return this.metadata.uuid || this.defaults.id;
    },

    get name() {
        return this.metadata.name || this.defaults.title;
    },

    get schemaId() {
        // FIX: Prioritize the standard 'settings-schema' key which usually matches the XML.
        // Fallback to 'schema-id' (custom) or a hardcoded default.
        return this.metadata["settings-schema"] || 
               this.metadata["schema-id"] || 
               "org.gnome.shell.extensions.lesion";
    },
    
    get developer() {
        return this.metadata["developer-name"] || "Lethil";
    }
};