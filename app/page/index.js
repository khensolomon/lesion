import { createHomeUI } from "./home.js";
import { createAboutUI } from "./about.js";
import { createSettingUI } from "./setting.js";
import { createCssUI } from "./css.js";
import { createWallpaperUI } from "./wallpaper.js";
import { createShowAppsUI } from './showapps.js';
import Adw from "gi://Adw";

export function getPages() {
  return [
    {
      title: "General",
      items: [
        {
          id: "home",
          title: "Dashboard",
          icon: "user-home-symbolic", //"preferences-system-symbolic",
          description: "View system information and basic OS details",
          keywords: ["dashboard", "information", "version", "home", "name"],
          ui: createHomeUI,
        },
        {
          id: "showapps",
          title: "Show apps Button",
          icon: "start-here-symbolic",
          description: "Show or hide the Show Apps button on the panel",
          ui: createShowAppsUI,
        },
        {
          id: "about",
          title: "About",
          icon: "help-about-symbolic",
          description: "Learn more about this application",
          ui: createAboutUI,
        },
      ],
    },
    {
      title: "Appearance",
      items: [
        // NEW: Wallpaper Page
        {
          id: "wallpaper",
          title: "Wallpaper",
          icon: "preferences-desktop-wallpaper-symbolic",
          description: "Customize background images and colors",
          keywords: ["background", "image", "picture", "color", "dark"],
          ui: createWallpaperUI,
        },
        {
          id: "settings",
          title: "Display & Monitor",
          icon: "video-display-symbolic",
          description: "Manage screen resolution",
          keywords: ["screen", "monitor", "hardware"],
          ui: createSettingUI,
          pages: [
            {
              id: "nightlight",
              title: "Night Light",
              description: "Blue light reduction filter",
              keywords: ["warm", "color", "temperature", "sleep", "eyes"],
              ui: () => {
                const page = new Adw.PreferencesPage();
                const group = new Adw.PreferencesGroup({
                  title: "Color Temperature",
                });
                group.add(
                  new Adw.SwitchRow({ title: "Warm Mode", active: true })
                );
                page.add(group);
                return page;
              },
            },
          ],
        },
        {
          id: "themes",
          title: "Themes & Styles",
          icon: "preferences-desktop-theme-symbolic",
          description: "Manage bundled and custom CSS",
          keywords: ["css", "style", "theme", "color", "custom"],
          ui: createCssUI,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          id: "system-tools",
          title: "System Tools",
          icon: "utilities-terminal-symbolic",
          groups: [
            {
              title: "Diagnostics",
              pages: [
                {
                  id: "logs",
                  title: "System Logs",
                  ui: () =>
                    new Adw.StatusPage({
                      title: "Logs",
                      icon_name: "text-x-script-symbolic",
                    }),
                },
              ],
            },
            {
              title: "Storage",
              pages: [
                {
                  id: "usage",
                  title: "Disk Usage",
                  ui: () =>
                    new Adw.StatusPage({
                      title: "Disk Usage",
                      icon_name: "drive-harddisk-symbolic",
                    }),
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}
