# Readme

theme-manager

GNOME development tools

```bash
sudo apt install gnome-shell-extensions gnome-shell-extension-manager gir1.2-gtk-4.0
```

A GNOME extension is essentially a directory

```bash
~/.local/share/gnome-shell/extensions/my-theme-manager@yourname.com/
├── extension.js      # The main logic that runs in the background
├── metadata.json     # Information about your extension (name, UUID, etc.)
└── prefs.js          # The code for the settings window
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

```
