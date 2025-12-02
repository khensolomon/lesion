const { HomePage } = imports.home;
const { AnalyticsPage } = imports.analytics;
const { SettingsPage } = imports.settings;
// Note: We need to create an about.js file for this to work.
// const { AboutPage } = imports.about; 

var pageRegistration = [
    {
        type: 'page',
        name: 'home',
        title: 'Home',
        icon: 'go-home-symbolic',
        content: HomePage,
    },
    {
        type: 'group',
        title: 'Management'
    },
    {
        type: 'page',
        name: 'analytics',
        title: 'Analytics',
        icon: 'view-statistics-symbolic',
        content: AnalyticsPage,
    },
    {
        type: 'group',
        title: 'Configuration'
    },
    {
        type: 'page',
        name: 'settings',
        title: 'Settings',
        icon: 'emblem-system-symbolic',
        content: SettingsPage,
    },
    {
        type: 'page',
        name: 'broken',
        title: 'Broken Page',
        icon: 'dialog-error-symbolic',
        content: null,
    },
];

