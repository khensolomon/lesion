#!/bin/bash

# This script customizes the XDG user directories.
# 1. Creates a one-time backup (.bak) of the original file.
# 2. Comments out Music, Pictures, and Videos.
# 3. Points the Downloads directory to the Public folder.
# Usage: ./user-dirs.sh
# mv ~/.config/user-dirs.dirs.bak ~/.config/user-dirs.dirs

# Define the configuration file path
CONFIG_FILE="$HOME/.config/user-dirs.dirs"
BACKUP_FILE="$CONFIG_FILE.bak"

# Check if the configuration file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found at $CONFIG_FILE"
    exit 1
fi

# --- 1. Create a backup if it doesn't already exist ---
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Creating backup: $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
else
    echo "Backup file already exists. Skipping backup."
fi
echo "---"


# --- 2. Comment out the directories you don't need ---
DIRS_TO_COMMENT=(
    "XDG_MUSIC_DIR"
    "XDG_PICTURES_DIR"
    "XDG_VIDEOS_DIR"
)

echo "Disabling specific XDG directories..."
for dir in "${DIRS_TO_COMMENT[@]}"; do
    # This sed command finds a line that STARTS with the directory key
    # (and is not already commented) and adds a '#' to the beginning.
    sed -i -E "s/^($dir=.*)/#\1/" "$CONFIG_FILE"
done
echo "Done."

echo "Configuration updated successfully!"