# Your extension's UUID from metadata.json
UUID="theme-manager@lethil"

cd ..
CURRENT_DIR=$(pwd)
# The full path to your project directory
# PROJECT_DIR="$HOME/dev/theme-manager"
PROJECT_DIR=$CURRENT_DIR

# The directory where GNOME Shell looks for extensions
EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"

# Create the symbolic link
ln -s "$PROJECT_DIR" "$EXTENSIONS_DIR/$UUID"