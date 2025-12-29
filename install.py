#!/usr/bin/env python3
"""
Development installer for GNOME Shell extensions."
"Automatically reads uuid, settings-schema, and name from metadata.json."
"Creates/updates a symlink for live development and handles GSettings schema compilation "
"(both locally in extension and globally).

Usage examples:
  1. Run inside your extension directory (recommended):
       ./install.py

  2. Specify source directory explicitly:
       ./install.py --src ~/dev/lesion

  3. Override UUID and schema (e.g., for testing a different ID):
       ./install.py --uuid lesion@test.com --schema dev.lethil.lesion.test

  4. Quick setup for a new extension in the default location:
       ./install.py --src ~/dev/my-new-extension

Tips:
  • Rerun this script whenever you modify extension.js, stylesheet.css, or *.gschema.xml
  • To reload the extension after code changes:
        - On X11: Alt+F2 → type 'r' → Enter
        - On Wayland: Log out and log back in, or use 'gnome-extensions disable/enable'
  • This script is safe to run multiple times — it updates symlinks and recompiles schemas idempotently.
"""
import os
import shutil
import subprocess
import sys
import json
import argparse
import re

def slugify_name(name):
    """Convert extension name to a slug: lowercase, spaces/dashes to single dash."""
    return re.sub(r'-+', '-', re.sub(r'\s+', '-', name.strip().lower()))

def load_metadata(ext_src):
    metadata_path = os.path.join(ext_src, "metadata.json")
    if not os.path.isfile(metadata_path):
        sys.exit(f"metadata.json not found in {ext_src}")
    
    with open(metadata_path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            sys.exit(f"Invalid JSON in metadata.json: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Development installer for GNOME Shell extensions.\n"
                    "Automatically reads uuid, settings-schema, and name from metadata.json.\n"
                    "Creates/updates a symlink for live development and handles GSettings schema compilation "
                    "(both locally in extension and globally).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Usage examples:
  1. Run inside your extension directory (recommended):
       ./install.py

  2. Specify source directory explicitly:
       ./install.py --src ~/dev/lesion

  3. Override UUID and schema (e.g., for testing a different ID):
       ./install.py --uuid lesion@test.com --schema dev.lethil.lesion.test

  4. Quick setup for a new extension in the default location:
       ./install.py --src ~/dev/my-new-extension

Tips:
  • Rerun this script whenever you modify extension.js, stylesheet.css, or *.gschema.xml
  • To reload the extension after code changes:
        - On X11: Alt+F2 → type 'r' → Enter
        - On Wayland: Log out and log back in, or use 'gnome-extensions disable/enable'
  • This script is safe to run multiple times — it updates symlinks and recompiles schemas idempotently.
        """
    )
    parser.add_argument(
        "--src",
        help="Source directory of the extension (default: current working directory)"
    )
    parser.add_argument(
        "--uuid",
        help="Override the 'uuid' from metadata.json (e.g., for temporary testing)"
    )
    parser.add_argument(
        "--schema",
        help="Override the 'settings-schema' from metadata.json"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )

    args = parser.parse_args()

    # Determine source directory
    if args.src:
        ext_src = os.path.abspath(args.src)
    else:
        ext_src = os.getcwd()
        print(f"No --src provided, using current directory: {ext_src}")

    if args.dry_run:
        print("*** DRY RUN MODE: No changes will be made ***")

    # Load metadata
    metadata = load_metadata(ext_src)

    # Extract defaults
    uuid = metadata.get("uuid", "").strip()
    if not uuid:
        sys.exit("Missing 'uuid' in metadata.json")

    settings_schema = metadata.get("settings-schema", "").strip() or None
    if settings_schema is None:
        print("No 'settings-schema' in metadata.json – schema handling will be skipped.")

    name = metadata.get("name", "Unnamed Extension").strip()
    default_uid_name = slugify_name(name)

    # Apply overrides
    uuid = args.uuid.strip() if args.uuid else uuid
    if args.schema:
        settings_schema = args.schema.strip() or None

    # Paths
    home = os.path.expanduser("~")
    ext_dst = f"{home}/.local/share/gnome-shell/extensions/{uuid}"
    ext_schemas_dir = f"{ext_dst}/schemas"
    schema_file = f"{settings_schema}.gschema.xml" if settings_schema else None
    schema_src = f"{ext_schemas_dir}/{schema_file}" if schema_file else None
    global_schemas_dir = f"{home}/.local/share/glib-2.0/schemas"
    source_schema_xml = os.path.join(ext_src, "schemas", schema_file) if schema_file else None

    print(f"\nExtension: {name}")
    print(f"UUID: {uuid}")
    print(f"Source: {ext_src}")
    print(f"Install destination (symlink): {ext_dst}")
    if settings_schema:
        print(f"Settings schema: {settings_schema}")

    if args.dry_run:
        print("\nDry run complete. Exiting without changes.")
        return

    # Ensure global schemas dir
    os.makedirs(global_schemas_dir, exist_ok=True)

    # Symlink handling
    if os.path.islink(ext_dst):
        current_target = os.readlink(ext_dst)
        if current_target == ext_src:
            print(f"Symlink already points to correct source: {ext_dst}")
        else:
            print(f"Updating symlink → {ext_src} (was {current_target})")
            os.unlink(ext_dst)
            os.symlink(ext_src, ext_dst)
    elif os.path.exists(ext_dst):
        sys.exit(f"Error: Destination exists but is not a symlink: {ext_dst}")
    else:
        os.symlink(ext_src, ext_dst)
        print(f"Created symlink: {ext_dst} → {ext_src}")

    # Schema compilation
    if settings_schema and schema_file:
        print(f"\nHandling GSettings schema: {schema_file}")

        # 1. Compile in extension's schemas/ dir (via symlink)
        if os.path.isdir(ext_schemas_dir):
            expected_local_xml = os.path.join(ext_schemas_dir, schema_file)
            if os.path.isfile(expected_local_xml):
                try:
                    subprocess.run(["glib-compile-schemas", ext_schemas_dir], check=True)
                    print(f"Compiled schemas locally in extension dir")
                except subprocess.CalledProcessError:
                    print("Warning: Failed to compile schemas in extension directory")
            else:
                print(f"Schema file not found via symlink: {expected_local_xml}")
        else:
            print("No schemas/ directory found in extension (via symlink)")

        # 2. Copy source XML and compile globally
        if source_schema_xml and os.path.isfile(source_schema_xml):
            shutil.copy(source_schema_xml, global_schemas_dir)
            print(f"Copied {schema_file} → {global_schemas_dir}")
            try:
                subprocess.run(["glib-compile-schemas", global_schemas_dir], check=True)
                print("Compiled global schemas")
            except subprocess.CalledProcessError:
                sys.exit("Failed to compile global schemas")
        else:
            if source_schema_xml:
                print(f"Schema file not found in source: {source_schema_xml}")

    else:
        print("No settings-schema defined – skipping schema steps")

    print("\nSetup complete!")
    print("Reload GNOME Shell to apply changes:")
    print("   • X11: Alt+F2 → 'r' → Enter")
    print("   • Wayland: Log out/in or use 'gnome-extensions disable/enable <uuid>'")

if __name__ == "__main__":
    main()