#!/bin/bash
EXT=responsive-prefs@example.com

echo "--Reloading extension ${EXT} ..."
gnome-extensions disable ${EXT}
sleep 0.5
gnome-extensions enable ${EXT}
# echo "Done."

# echo "--Opening preferences for ${EXT} ..."
# gnome-extensions prefs ${EXT}


echo "--Watching logs:"
journalctl -f -o cat /usr/bin/gnome-shell


