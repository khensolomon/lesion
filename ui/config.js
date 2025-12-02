const GLib = imports.gi.GLib;

var SizeConfiguration = class {
    constructor() {
        this.SIDEBAR_MIN_WIDTH = 180;
        this.SIDEBAR_MAX_WIDTH = 250;
        this.SIDEBAR_INITIAL_WIDTH = 250;
        this.SIDEBAR_PROPORTION = 0.28;
        this.OVERLAY_MARGIN = 50;
        this.TITLE_COLLAPSE_THRESHOLD = 390;
        this.TITLE_COLLAPSE_THRESHOLD_ULTRA = 250;
        // --- NEW --- This setting controls the auto-show behavior
        this.showBasedOnWindowWidth = true;
    }
};

var StyleConfiguration = class {
    constructor() {
        this.CSS = `
            .navigation-sidebar {
                padding-top: 6px;
                padding-bottom: 6px;
            }
            .navigation-sidebar .list-row {
                padding-top: 6px;
                padding-bottom: 6px;
                padding-left: 12px;
                padding-right: 12px;
                border-radius: 6px;
            }
            .navigation-sidebar .list-row:hover {
                background-color: rgba(0, 0, 0, 0.05);
            }
            .navigation-sidebar .list-row:selected {
                background-color: @accent_color;
                color: white;
            }
            .navigation-sidebar .list-row:selected image,
            .navigation-sidebar .list-row:selected label {
                color: white;
            }
            .menu-group-title {
                font-size: 0.8rem;
                font-weight: bold;
                opacity: 0.7;
                padding-top: 18px;
                padding-bottom: 6px;
                padding-left: 12px;
                padding-right: 12px;
                text-transform: uppercase;
                background-color: transparent;
            }
            flap > .separator, .sidebar.overlay-visible {
                border-right: 1px solid @borders;
            }
            .sidebar {
                background-color: @headerbar_bg_color;
            }
            .main-content {
                background-color: @window_bg_color;
            }
        `;
    }
};

