#!/usr/bin/env python3
"""
Universal GNOME Shell Extension Installer & Dev Tool.

This script manages the installation of GNOME Shell extensions for both
end-users (installing from GitHub) and developers (symlinking local source).

--------------------------------------------------------------------------------
MODES OF OPERATION
--------------------------------------------------------------------------------

1. Auto-Detection (Default behavior):
   - The script checks for 'metadata.json' in the current directory.
   - If FOUND: It assumes you are a DEVELOPER working in the source repo.
     It switches to 'Dev Mode' (symlinking).
   - If MISSING: It assumes you are a USER running a standalone script.
     It switches to 'Remote Mode' (downloading from GitHub).

2. Dev Mode (--mode dev):
   - Creates a symbolic link from the current directory (or --src) to
     ~/.local/share/gnome-shell/extensions/<uuid>.
   - Compiles GSettings schemas:
     a) Locally in the extension folder (for self-containment).
     b) Globally in ~/.local/share/glib-2.0/schemas (so settings apply immediately
        without needing a logout/login cycle for schemas to load).
   - Utility: Can reset GSettings keys to defaults via --reset-settings.

3. Remote Mode (--mode remote):
   - Downloads a specific tag/branch (default: master) from GitHub.
   - Extracts the archive to a temporary location.
   - Copies (does NOT symlink) the files to the extensions directory.
   - Compiles schemas locally only.
   - Enables the extension using 'gnome-extensions enable'.

--------------------------------------------------------------------------------
USAGE EXAMPLES
--------------------------------------------------------------------------------

  [Developer]
  1. Setup environment (run from repo root):
     ./install.py

  2. Reset extension settings to default:
     ./install.py --reset-settings

  [End-User]
  1. Install latest master branch (one-liner):
     curl https://raw.githubusercontent.com/khensolomon/lesion/master/install.py | python3 -

  2. Install a specific release tag:
     ./install.py --ref v1.2.0

  3. Install from a fork/different repo:
     ./install.py --repo myuser/my-fork --ref feature-branch

--------------------------------------------------------------------------------
"""

import os
import sys
import shutil
import json
import argparse
import subprocess
import tarfile
import tempfile
import urllib.request
import textwrap

# --- Configuration ---
DEFAULT_REPO = "khensolomon/lesion"
DEFAULT_REF = "master"

def get_metadata_path(src_dir):
    """Return the full path to metadata.json in the source directory."""
    return os.path.join(src_dir, "metadata.json")

def load_metadata(src_dir):
    """
    Parse metadata.json from the source directory.
    
    Args:
        src_dir (str): Directory containing metadata.json.
        
    Returns:
        dict: The parsed JSON content.
        
    Raises:
        SystemExit: If file is missing or invalid JSON.
    """
    path = get_metadata_path(src_dir)
    if not os.path.isfile(path):
        sys.exit(f"Error: metadata.json not found in {src_dir}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        sys.exit(f"Error parsing metadata.json: {e}")

def run_cmd(cmd, check=False, quiet=False):
    """
    Run a subprocess command safely with optional output suppression.
    
    Args:
        cmd (list): Command to run (e.g. ['ls', '-la']).
        check (bool): If True, raises CalledProcessError on failure.
        quiet (bool): If True, suppresses stdout/stderr.
        
    Returns:
        bool: True if command succeeded (exit code 0), False otherwise.
    """
    stdout = subprocess.DEVNULL if quiet else None
    stderr = subprocess.DEVNULL if quiet else None
    try:
        subprocess.run(cmd, check=check, stdout=stdout, stderr=stderr)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def get_archive_url(repo, ref):
    """
    Generate GitHub archive URL for a specific repo and reference.
    
    Args:
        repo (str): "user/repo" format.
        ref (str): Tag (e.g., "v1.0") or branch name (e.g., "master").
        
    Returns:
        str: URL to the .tar.gz archive.
    """
    if ref.startswith("v"):
        return f"https://github.com/{repo}/archive/refs/tags/{ref}.tar.gz"
    return f"https://github.com/{repo}/archive/refs/heads/{ref}.tar.gz"

def install_remote(args, target_base):
    """
    Downloads and installs the extension from GitHub (User Mode).
    
    Steps:
    1. Downloads .tar.gz from GitHub.
    2. Extracts to temp dir.
    3. Reads metadata to get UUID.
    4. Copies files to ~/.local/share/gnome-shell/extensions/<uuid>.
    5. Compiles schemas locally.
    6. Enables extension.
    """
    repo = args.repo or DEFAULT_REPO
    ref = args.ref or DEFAULT_REF
    url = get_archive_url(repo, ref)

    print(f"--- Remote Install Mode ---")
    print(f"Source: GitHub ({repo} @ {ref})")
    print(f"Downloading: {url}...")

    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = os.path.join(tmpdir, "source.tar.gz")
        
        try:
            urllib.request.urlretrieve(url, archive_path)
        except Exception as e:
            sys.exit(f"Download failed: {e}")

        try:
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(tmpdir)
        except Exception as e:
            sys.exit(f"Extraction failed: {e}")

        # Find the extracted folder (GitHub tarballs usually contain one top-level folder)
        extracted_items = [
            os.path.join(tmpdir, d) for d in os.listdir(tmpdir)
            if os.path.isdir(os.path.join(tmpdir, d))
        ]
        if not extracted_items:
            sys.exit("Error: Archive contained no directories.")
        
        src_dir = extracted_items[0]
        metadata = load_metadata(src_dir)
        uuid = metadata.get("uuid")
        if not uuid:
            sys.exit("Error: UUID missing in downloaded metadata.json")

        dest_dir = os.path.join(target_base, uuid)
        
        # Cleanup old installation
        if os.path.exists(dest_dir):
            if os.path.islink(dest_dir):
                os.unlink(dest_dir)
            else:
                shutil.rmtree(dest_dir)

        # Install
        os.makedirs(target_base, exist_ok=True)
        shutil.copytree(src_dir, dest_dir)
        print(f"Installed to: {dest_dir}")

        # Local Schema Compilation
        schemas_dir = os.path.join(dest_dir, "schemas")
        if os.path.isdir(schemas_dir) and run_cmd(["which", "glib-compile-schemas"], quiet=True):
            run_cmd(["glib-compile-schemas", schemas_dir])
            print("Compiled schemas locally.")

        # Enable Extension
        if run_cmd(["which", "gnome-extensions"], quiet=True):
            run_cmd(["gnome-extensions", "enable", uuid])
            print("Extension enabled via gnome-extensions.")
        
        print("\nDone! If it doesn't appear, log out and back in.")

def install_local(args, target_base):
    """
    Symlinks the current directory for development (Dev Mode).
    
    Why Symlink?
    Changes to .js files are reflected immediately upon GNOME Shell restart (Alt+F2 -> r)
    without needing to reinstall/copy files every time.
    
    Why Global Schemas?
    GNOME Shell only reads local schemas (inside the extension folder) after a full
    login/logout. For rapid dev, we compile schemas to the global user path
    (~/.local/share/glib-2.0/schemas) so changes apply on simple Shell restart.
    """
    src_dir = os.path.abspath(args.src) if args.src else os.getcwd()
    metadata = load_metadata(src_dir)
    
    uuid = args.uuid or metadata.get("uuid")
    if not uuid:
        sys.exit("Error: UUID not found in metadata.json")

    dest_dir = os.path.join(target_base, uuid)
    global_schemas_dir = os.path.expanduser("~/.local/share/glib-2.0/schemas")

    print(f"--- Dev Install Mode ---")
    print(f"UUID: {uuid}")
    print(f"Source: {src_dir}")
    print(f"Destination: {dest_dir}")

    # 1. Symlink
    os.makedirs(target_base, exist_ok=True)
    if os.path.islink(dest_dir):
        if os.readlink(dest_dir) != src_dir:
            os.unlink(dest_dir)
            os.symlink(src_dir, dest_dir)
            print("Updated existing symlink.")
    elif os.path.exists(dest_dir):
        sys.exit(f"Error: Target {dest_dir} exists and is not a symlink. Remove it manually.")
    else:
        os.symlink(src_dir, dest_dir)
        print("Created symlink.")

    # 2. Schemas
    schema_id = args.schema or metadata.get("settings-schema")
    if schema_id:
        # Global compile (for dev convenience)
        schema_file = f"{schema_id}.gschema.xml"
        src_schema = os.path.join(src_dir, "schemas", schema_file)
        
        if os.path.isfile(src_schema):
            os.makedirs(global_schemas_dir, exist_ok=True)
            shutil.copy(src_schema, global_schemas_dir)
            try:
                subprocess.run(["glib-compile-schemas", global_schemas_dir], check=True)
                print(f"Compiled global schemas in {global_schemas_dir}")
            except subprocess.CalledProcessError:
                print("Warning: Failed to compile global schemas.")
        
        # Local compile (ensure extension folder is self-contained)
        local_schemas_dir = os.path.join(src_dir, "schemas")
        if os.path.isdir(local_schemas_dir):
             subprocess.run(["glib-compile-schemas", local_schemas_dir], check=False)

        # 3. Reset Settings
        if args.reset_settings:
            print(f"Resetting settings for {schema_id}...")
            subprocess.run(["gsettings", "reset-recursively", schema_id])

    print("\nDev setup complete.")
    print("Restart GNOME Shell (Alt+F2 -> r) to apply.")

def main():
    parser = argparse.ArgumentParser(
        description="Install GNOME Shell Extension (Dev & User modes)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
            examples:
              # Dev: Link current dir and compile schemas
              ./install.py
              
              # Dev: Wipe settings for a fresh start
              ./install.py --reset-settings
              
              # User: Download and install master branch
              ./install.py --mode remote
        """)
    )
    
    # Mode selection
    parser.add_argument("--mode", choices=["auto", "dev", "remote"], default="auto", 
                        help="Force install mode (default: auto-detect based on metadata.json presence)")
    
    # Dev options
    parser.add_argument("--src", help="Source directory (Dev mode only)")
    parser.add_argument("--uuid", help="Override UUID (Dev mode only)")
    parser.add_argument("--schema", help="Override schema ID (Dev mode only)")
    parser.add_argument("--reset-settings", action="store_true", help="Reset GSettings to defaults (Dev mode only)")
    
    # Remote options
    parser.add_argument("--ref", help=f"Git reference/tag to install (default: {DEFAULT_REF})")
    parser.add_argument("--repo", help=f"GitHub repository (default: {DEFAULT_REPO})")

    args = parser.parse_args()
    
    extensions_path = os.path.expanduser("~/.local/share/gnome-shell/extensions")

    # Mode Detection Logic
    mode = args.mode
    if mode == "auto":
        # If metadata.json exists in CWD or --src is provided, assume Dev
        has_local_meta = os.path.isfile("metadata.json") or (args.src and os.path.isfile(os.path.join(args.src, "metadata.json")))
        mode = "dev" if has_local_meta else "remote"

    if mode == "remote":
        install_remote(args, extensions_path)
    else:
        install_local(args, extensions_path)

if __name__ == "__main__":
    main()