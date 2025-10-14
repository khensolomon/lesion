# Readme

theme-manager

GNOME development tools

```bash
sudo apt install gnome-shell-extensions gnome-shell-extension-manager gir1.2-gtk-4.0
sudo apt install pkgconf libadwaita-1-dev gir1.2-adw-1
sudo apt install gir1.2-adw-1
sudo apt install gir1.2-gtk-4.0 gir1.2-adw-1


ls /usr/lib*/girepository-1.0/Adw-1.typelib
ls -l /usr/lib/x86_64-linux-gnu/girepository-1.0/Adw-1.typelib

echo 'export GI_TYPELIB_PATH=/usr/lib/x86_64-linux-gnu/girepository-1.0' >> ~/.bashrc
source ~/.bashrc
```

A GNOME extension is essentially a directory

```bash
~/.local/share/gnome-shell/extensions/theme-manager@lethil/
├── extension.js      # The main logic that runs in the background
├── metadata.json     # Information about your extension (name, UUID, etc.)
├── prefs.js          # The code for the settings window
└── stylesheet.css
```

Test

```bash
# compile it
glib-compile-schemas schemas/

# Check
gnome-extensions list | grep theme-manager
gsettings list-schemas | grep theme-manager

# Run
gnome-extensions prefs theme-manager@lethil

# temporarily tells GSettings where your local schema lives
GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/theme-manager@lethil/schemas \
  gnome-extensions prefs theme-manager@lethil

# Permanent shell alias
alias prefs-theme="GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/theme-manager@lethil/schemas gnome-extensions prefs theme-manager@lethil"
# then
prefs-theme
```

## app.js

```bash
# Make it executable
chmod +x app.js

# Launch
./app.js
gjs --module ./app.js
GSETTINGS_SCHEMA_DIR=schemas gjs --module ./app.js
GSETTINGS_SCHEMA_DIR=schemas ./app.js

```

## app.desktop

```bash
# desktop launcher icon
nano ~/.local/share/applications/com.lethil.ThemeManager.desktop
```bash


```int
[Desktop Entry]
Name=Theme & Extension Manager
Comment=Customize themes and extensions
Exec=/home/YOURUSERNAME/path/to/app.js
Icon=preferences-desktop-theme
Terminal=false
Type=Application
StartupNotify=true
Categories=GNOME;Settings;Utility;
Exec=gjs --module /home/YOURUSERNAME/path/to/app.js

Name=Theme Manager
Exec=gjs -m /path/to/theme-manager/app.js
Type=Application
Icon=preferences-desktop-theme-symbolic
Categories=Settings;GNOME;GTK;


```bash
# run:
update-desktop-database ~/.local/share/applications/
```

Create the Symbolic Link

```bash
cd scripts
bash symbolic-link.sh
bash user-dirs.sh

# Clean Up Completely
rm -rf ~/.local/share/gnome-shell/extensions/theme-manager@lethil
```

```bash
journalctl -f -o cat /usr/bin/gnome-shell

gnome-shell --version

sudo apt update
sudo apt install --reinstall gnome-shell gnome-shell-common


sudo apt install gnome-shell-extensions
sudo apt install gnome-extensions-app


sudo apt install libglib2.0-bin
# List its Contents and Filter for the File
gresource list /usr/share/gnome-shell/org.gnome.Shell.gresource | grep "extension.js"

gsettings set org.gnome.desktop.calendar show-weekdate true

```

Selector

```CSS
// Force All Corners Rounded
window,
decoration,
.background,
window.background,
.window-frame {
    border-radius: 12px !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}

# Force All Corners Flat (No Rounding)
window,
decoration,
.background,
window.background,
.window-frame {
    border-radius: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}



```
