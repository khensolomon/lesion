#!/bin/bash
# dev.sh
set -e
echo "Compiling schemas..."
glib-compile-schemas schemas/
echo "Reloading GNOME Shell..."
gnome-extensions disable lesion@lethil || true
gnome-extensions enable lesion@lethil
echo "Done."

# bash dev.sh