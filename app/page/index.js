import { createHomeUI } from './home.js';
import { createAboutUI } from './about.js';
import { createSettingUI } from './setting.js';
import Adw from 'gi://Adw';

export function getPages() {
    return [
        {
            title: "General",
            items: [
                {
                    id: 'home',
                    title: 'System Info',
                    icon: 'preferences-system-symbolic',
                    description: 'View system information and basic OS details',
                    keywords: ['system', 'information', 'version', 'os', 'name'],
                    ui: createHomeUI
                },
                {
                    id: 'about',
                    title: 'About',
                    icon: 'help-about-symbolic',
                    description: 'Learn more about this application',
                    ui: createAboutUI
                }
            ]
        },
        {
            title: "Hardware",
            description: "Device configuration",
            items: [
                {
                    id: 'settings',
                    title: 'Display & Monitor',
                    icon: 'video-display-symbolic',
                    description: 'Manage screen resolution',
                    keywords: ['screen', 'monitor', 'hardware'], 
                    ui: createSettingUI, 
                    pages: [
                        {
                            id: 'nightlight',
                            title: 'Night Light',
                            description: 'Blue light reduction filter',
                            keywords: ['warm', 'color', 'temperature', 'sleep', 'eyes'],
                            ui: () => {
                                const page = new Adw.PreferencesPage();
                                const group = new Adw.PreferencesGroup({ title: 'Color Temperature' });
                                group.add(new Adw.SwitchRow({ title: 'Warm Mode', active: true }));
                                page.add(group);
                                return page;
                            }
                        }
                    ]
                }
            ]
        },
        {
            title: "System",
            items: [
                {
                    id: 'system-tools',
                    title: 'System Tools',
                    icon: 'utilities-terminal-symbolic',
                    groups: [
                        {
                            title: 'Diagnostics',
                            pages: [
                                {
                                    id: 'logs',
                                    title: 'System Logs',
                                    ui: () => new Adw.StatusPage({ title: 'Logs', icon_name: 'text-x-script-symbolic' })
                                }
                            ]
                        },
                        {
                            title: 'Storage',
                            pages: [
                                {
                                    id: 'usage',
                                    title: 'Disk Usage',
                                    ui: () => new Adw.StatusPage({ title: 'Disk Usage', icon_name: 'drive-harddisk-symbolic' })
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ];
}