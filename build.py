#!/usr/bin/env python3
"""
GNOME Extension Builder
-----------------------
This script automates the packaging of a GNOME Shell extension.
It reads the `metadata.json` file to determine the UUID and version,
creates a zip file with the correct naming convention, and moves
it to a target directory.

USAGE EXAMPLES:
-----------------------
1. Standard Build (Recommended)
   Includes 'build.py' in the zip so you have the tool available in backups.
   $ python3 build.py

2. Production Build (Clean)
   Excludes 'build.py' from the final zip file.
   $ python3 build.py --no-self

3. Help
   View available options.
   $ python3 build.py --help
"""

import json
import os
import zipfile
import shutil
import fnmatch
import argparse
import sys

# --- CONFIGURATION ---
TARGET_DIR = os.path.expanduser("~/dev/backup")

# Global exclude patterns (always ignored)
ALWAYS_EXCLUDE = [
    "*.git*", 
    "*.vscode*", 
    ".idea/*", 
    "__pycache__*",
    "tmp",
    "*.zip", 
    "schemas/gschemas.compiled"
]
# ---------------------

def parse_arguments():
    """Defines and parses command line arguments."""
    parser = argparse.ArgumentParser(
        description="Package a GNOME Shell extension into a deployable zip file.",
        epilog="Example: python3 build.py --no-self",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--no-self", 
        action="store_false", 
        dest="include_self",
        help="Do NOT include this build.py script in the final zip file."
    )

    # Default is True (include self)
    parser.set_defaults(include_self=True)

    return parser.parse_args()

def main():
    args = parse_arguments()

    # 1. Read metadata.json
    meta_file = "metadata.json"
    if not os.path.exists(meta_file):
        print(f"Error: {meta_file} not found in {os.getcwd()}")
        sys.exit(1)

    try:
        with open(meta_file, 'r') as f:
            data = json.load(f)
            uuid = data.get("uuid")
            # Prioritize version-name, fallback to integer version
            version = data.get("version-name", str(data.get("version", "0")))
            
            if not uuid:
                print("Error: 'uuid' missing in metadata.json")
                sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Failed to parse {meta_file}. Check your JSON syntax.")
        sys.exit(1)

    # 2. Define Filename
    zip_filename = f"{uuid}_v{version}.zip"
    print(f"Packaging: {zip_filename}")

    # 3. Create Zip File
    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk("."):
                for file in files:
                    file_path = os.path.join(root, file)
                    archive_name = os.path.relpath(file_path, ".")

                    # --- EXCLUSION LOGIC ---
                    
                    # 1. Check global patterns
                    if should_exclude(archive_name, ALWAYS_EXCLUDE):
                        continue

                    # 2. Check build.py specifically
                    if file == os.path.basename(__file__) and not args.include_self:
                        print(f"   [Excluded] Builder script ({file})")
                        continue
                    
                    # -----------------------

                    zipf.write(file_path, arcname=archive_name)
                    
        print("Zip created successfully.")

    except Exception as e:
        print(f"Error creating zip: {e}")
        sys.exit(1)

    # 4. Move to Target Directory
    try:
        if not os.path.exists(TARGET_DIR):
            os.makedirs(TARGET_DIR)
            print(f"   Created directory: {TARGET_DIR}")

        destination = os.path.join(TARGET_DIR, zip_filename)
        shutil.move(zip_filename, destination)
        
        print("-" * 40)
        print("Build Complete.")
        print(f"File moved to: {destination}")
        print("-" * 40)

    except Exception as e:
        print(f"Error moving file: {e}")

def should_exclude(filename, patterns):
    """Checks if a filename matches any exclude pattern."""
    for pattern in patterns:
        if fnmatch.fnmatch(filename, pattern):
            return True
        if fnmatch.fnmatch(os.path.dirname(filename), pattern):
            return True
    return False

if __name__ == "__main__":
    main()