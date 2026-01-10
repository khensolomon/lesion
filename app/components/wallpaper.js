import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { log, logError } from '../util/logger.js';
import { ExtensionComponent } from './base.js';

export class WallpaperManager extends ExtensionComponent {
    
    onEnable() {
        this.backupFile = 'backup.wallpaper.v1.json';
        this._bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        
        // 1. Initial Backup (if needed)
        this._backupWallpaper();

        // 2. Watch for Master Switch
        this.observe('changed::wallpaper-enabled', () => this._updateMasterState());

        // 3. Initialize
        this._updateMasterState();
    }

    onDisable() {
        // Force cleanup
        this._cleanupFeatures();
        this._restoreWallpaper();
        this._bgSettings = null;
        this._interfaceSettings = null;
    }

    /**
     * MASTER STATE HANDLER
     * If enabled: Connects signals and applies logic.
     * If disabled: Disconnects signals and restores original state.
     */
    _updateMasterState() {
        const enabled = this.getSettings().get_boolean('wallpaper-enabled');

        if (enabled) {
            log("WallpaperManager: Enabled");
            // Connect Signals
            if (!this._featureSignals) {
                this._featureSignals = [];
                const s = this.getSettings();
                
                // Helper to track signal ID with its owner object
                const track = (obj, id) => this._featureSignals.push({ obj, id });

                // Watch for feature changes
                track(s, s.connect('changed::wallpaper-show-image', () => this._updateVisibility()));
                track(s, s.connect('changed::wallpaper-monochrome', () => this._updateEffects()));
                track(s, s.connect('changed::wallpaper-blur-sigma', () => this._updateEffects()));
                track(s, s.connect('changed::wallpaper-brightness', () => this._updateEffects()));
                
                track(s, s.connect('changed::wallpaper-primary-color-dark', () => this._updateColors()));
                track(s, s.connect('changed::wallpaper-secondary-color-dark', () => this._updateColors()));

                // Watch System
                track(this._interfaceSettings, this._interfaceSettings.connect('changed::color-scheme', () => this._updateColors()));
            }

            // Apply Initial State
            this._updateVisibility();
            this._updateColors();
            this._updateEffects();

        } else {
            log("WallpaperManager: Disabled");
            this._cleanupFeatures();
        }
    }

    _cleanupFeatures() {
        // Disconnect internal signals precisely
        if (this._featureSignals) {
            this._featureSignals.forEach(sig => {
                try { 
                    // Only disconnect from the object that actually owns the signal
                    sig.obj.disconnect(sig.id); 
                } catch(e) {
                    // Suppress errors only if object is already destroyed
                }
            });
            this._featureSignals = null;
        }

        // Remove Effects
        this._removeEffects();
    }

    /**
     * Logic for "Show Background Image"
     */
    _updateVisibility() {
        const show = this.getSettings().get_boolean('wallpaper-show-image');
        const currentOption = this._bgSettings.get_string('picture-options');
        
        if (!show) {
            if (currentOption !== 'none') {
                this.getSettings().set_string('wallpaper-restore-options', currentOption);
                this._bgSettings.set_string('picture-options', 'none');
            }
        } else {
            if (currentOption === 'none') {
                let restore = this.getSettings().get_string('wallpaper-restore-options');
                if (!restore || restore === 'none') restore = 'zoom';
                this._bgSettings.set_string('picture-options', restore);
            }
        }
    }

    /**
     * Logic for Colors (Dark Mode)
     */
    _updateColors() {
        const colorScheme = this._interfaceSettings.get_string('color-scheme');
        const isDark = colorScheme === 'prefer-dark';

        if (isDark) {
            const darkPrimary = this.getSettings().get_string('wallpaper-primary-color-dark');
            const darkSecondary = this.getSettings().get_string('wallpaper-secondary-color-dark');
            if (darkPrimary) this._bgSettings.set_string('primary-color', darkPrimary);
            if (darkSecondary) this._bgSettings.set_string('secondary-color', darkSecondary);
        }
        // If Light mode, we leave it to System default (or whatever was last set)
    }

    /**
     * Logic for Effects (Monochrome, Blur, Brightness)
     */
    _updateEffects() {
        const s = this.getSettings();
        const mono = s.get_boolean('wallpaper-monochrome');
        const blurSigma = s.get_int('wallpaper-blur-sigma');
        const brightness = s.get_double('wallpaper-brightness');

        const layoutManager = Main.layoutManager;
        const bgGroup = layoutManager._backgroundGroup;
        if (!bgGroup) return;

        bgGroup.get_children().forEach(actor => {
            // 1. Monochrome
            const monoName = 'lesion-mono';
            if (mono) {
                if (!actor.get_effect(monoName)) {
                    const effect = new Clutter.DesaturateEffect({ factor: 1.0 });
                    actor.add_effect_with_name(monoName, effect);
                }
            } else {
                actor.remove_effect_by_name(monoName);
            }

            // 2. Blur
            const blurName = 'lesion-blur';
            if (blurSigma > 0) {
                let effect = actor.get_effect(blurName);
                if (!effect) {
                    effect = new Clutter.BlurEffect();
                    actor.add_effect_with_name(blurName, effect);
                }
                // Check if set_sigma is available (GNOME 45+) or use fallback
                if (effect.set_sigma) {
                    effect.set_sigma(blurSigma);
                } else {
                    // Fallback for older Clutter versions if needed, though most now support set_sigma
                    effect.sigma = blurSigma; 
                }
            } else {
                actor.remove_effect_by_name(blurName);
            }

            // 3. Brightness
            const brightName = 'lesion-bright';
            // Only apply if not 1.0 (default)
            if (Math.abs(brightness - 1.0) > 0.01) {
                let effect = actor.get_effect(brightName);
                if (!effect) {
                    effect = new Clutter.BrightnessContrastEffect();
                    actor.add_effect_with_name(brightName, effect);
                }
                // Map user 0..1 to -1..0 range for darkening
                const clutterVal = brightness - 1.0; 
                effect.set_brightness(clutterVal);
            } else {
                actor.remove_effect_by_name(brightName);
            }
        });
    }

    _removeEffects() {
        const layoutManager = Main.layoutManager;
        const bgGroup = layoutManager._backgroundGroup;
        if (!bgGroup) return;

        bgGroup.get_children().forEach(actor => {
            actor.remove_effect_by_name('lesion-mono');
            actor.remove_effect_by_name('lesion-blur');
            actor.remove_effect_by_name('lesion-bright');
        });
    }

    _backupWallpaper() {
        try {
            const backupPath = GLib.build_filenamev([this._extension.path, this.backupFile]);
            
            if (!GLib.file_test(backupPath, GLib.FileTest.EXISTS)) {
                const backupData = {
                    'picture-uri': this._bgSettings.get_string('picture-uri'),
                    'picture-uri-dark': this._bgSettings.get_string('picture-uri-dark'),
                    'primary-color': this._bgSettings.get_string('primary-color'),
                    'secondary-color': this._bgSettings.get_string('secondary-color'),
                    'picture-options': this._bgSettings.get_string('picture-options')
                };

                const jsonString = JSON.stringify(backupData, null, 2);
                const file = Gio.File.new_for_path(backupPath);
                file.replace_contents(jsonString, null, false, Gio.FileCreateFlags.NONE, null);
                
                log("Wallpaper config backed up.");
            }
        } catch (e) {
            logError("Failed to backup wallpaper settings", e);
        }
    }

    _restoreWallpaper() {
        try {
            const backupPath = GLib.build_filenamev([this._extension.path, this.backupFile]);
            const file = Gio.File.new_for_path(backupPath);

            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const backupData = JSON.parse(decoder.decode(contents));
                    
                    if (backupData['picture-uri']) this._bgSettings.set_string('picture-uri', backupData['picture-uri']);
                    if (backupData['picture-uri-dark']) this._bgSettings.set_string('picture-uri-dark', backupData['picture-uri-dark']);
                    if (backupData['primary-color']) this._bgSettings.set_string('primary-color', backupData['primary-color']);
                    if (backupData['secondary-color']) this._bgSettings.set_string('secondary-color', backupData['secondary-color']);
                    
                    // Always restore options last to avoid flashing 'none'
                    if (backupData['picture-options']) this._bgSettings.set_string('picture-options', backupData['picture-options']);

                    log("Wallpaper config restored.");
                    file.delete(null);
                }
            }
        } catch (e) {
            logError("Failed to restore wallpaper settings", e);
        }
    }
}