#!/bin/bash
# EXT=responsive-prefs@example.com

if dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'true' &>/dev/null; then
    dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'global.reexec_self();'
    echo "GNOME Shell restarted."
else
    echo "GNOME Shell not available on D-Bus."
fi


