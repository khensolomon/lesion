/**
 * A singleton configuration object.
 * Acts as the Single Source of Truth for App ID, Dimensions, and Metadata.
 */
export const AppConfig = {
    // 1. Static Configuration (Design-time defaults)
    defaults: {
        id: 'com.example.GnomeSplitViewDemo',
        title: 'Gnome Split View Demo',
        window: {
            width: 800,
            height: 600,
            minWidth: 360,  // Required for AdwBreakpoint
            minHeight: 200
        }
    },

    // 2. Runtime State (Populated at startup)
    isExtension: false,
    appId: '', // Will be populated in init()
    metadata: {
        name: '', // Will fallback to defaults.title if empty
        version: '0.0.0',
        description: '',
        url: '',
        links: {}
    },
    
    // Initialize with data from either app.js (File) or prefs.js (Shell)
    init(metadata, isExtension = false) {
        // Merge loaded metadata into our state
        this.metadata = { 
            ...this.metadata, 
            ...metadata 
        };
        
        // Ensure name has a fallback
        if (!this.metadata.name) {
            this.metadata.name = this.defaults.title;
        }

        this.isExtension = isExtension;
        
        // Determine actual App ID:
        // 1. Metadata UUID (Extension)
        // 2. Metadata application-id (Flatpak)
        // 3. Default ID (Standalone fallback)
        this.appId = metadata.uuid || metadata['application-id'] || this.defaults.id;
    }
};