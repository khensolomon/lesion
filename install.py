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
   - Compiles GSettings schemas globally in ~/.local/share/glib-2.0/schemas. 
     CRITICAL: This allows settings to work immediately upon Shell restart
     (Alt+F2 -> r) without needing a full logout/login.

3. Remote Mode (--mode remote):
   - Downloads a specific tag/branch (default: master) from GitHub.
   - Installs files (copy) to the extensions directory.
   - NOW ALSO compiles schemas globally (just like Dev Mode) to fix 
     "Preferences Error" issues.

--------------------------------------------------------------------------------
USAGE EXAMPLES
--------------------------------------------------------------------------------

  [Developer]
  1. Setup environment (run from repo root):
     ./install.py

  [End-User]
  1. Install latest master branch (one-liner):
     curl https://raw.githubusercontent.com/khensolomon/lesion/master/install.py | python3 -
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
import xml.etree.ElementTree as ET

# --- Configuration ---
DEFAULT_REPO = "khensolomon/lesion"
DEFAULT_REF = "master"

# Colors for diagnostics
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
RESET = "\033[0m"

def get_metadata_path(src_dir):
    return os.path.join(src_dir, "metadata.json")

def load_metadata(src_dir):
    path = get_metadata_path(src_dir)
    if not os.path.isfile(path):
        sys.exit(f"{RED}Error: metadata.json not found in {src_dir}{RESET}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        sys.exit(f"{RED}Error parsing metadata.json: {e}{RESET}")

def run_cmd(cmd, check=False, quiet=False):
    stdout = subprocess.DEVNULL if quiet else None
    stderr = subprocess.DEVNULL if quiet else None
    try:
        subprocess.run(cmd, check=check, stdout=stdout, stderr=stderr)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def get_schema_ids_from_file(xml_path):
    ids = []
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        if root.tag == 'schema':
             if 'id' in root.attrib: ids.append(root.attrib['id'])
        else:
            for schema in root.findall(".//schema"):
                if 'id' in schema.attrib:
                    ids.append(schema.attrib['id'])
    except Exception:
        pass
    return ids

def install_schemas(src_schemas_dir):
    """
    Compiles schemas locally AND installs them globally to user's local share.
    Returns a list of Schema IDs found in the files.
    """
    found_ids = []
    global_schemas_dir = os.path.expanduser("~/.local/share/glib-2.0/schemas")
    
    if os.path.isdir(src_schemas_dir):
        # 1. Global Install (for immediate effect and stability)
        os.makedirs(global_schemas_dir, exist_ok=True)
        files_found = 0
        
        for f in os.listdir(src_schemas_dir):
            if f.endswith(".gschema.xml"):
                src_file = os.path.join(src_schemas_dir, f)
                found_ids.extend(get_schema_ids_from_file(src_file))
                shutil.copy(src_file, global_schemas_dir)
                files_found += 1
        
        if files_found > 0:
            try:
                subprocess.run(["glib-compile-schemas", global_schemas_dir], check=True)
                print(f"Compiled {files_found} global schema(s) in {global_schemas_dir}")
            except subprocess.CalledProcessError:
                print(f"{RED}Warning: Failed to compile global schemas.{RESET}")
        
        # 2. Local Compile (for portability/standard compliance)
        subprocess.run(["glib-compile-schemas", src_schemas_dir], check=False)
        print("Compiled schemas locally.")
    
    return found_ids

def run_diagnostics(target_schema_id, found_ids):
    """Checks if the system can actually see the schema."""
    if not target_schema_id:
        return

    # A. Check Consistency
    if target_schema_id not in found_ids:
        print(f"\n{RED}!!! CONFIGURATION ERROR DETECTED !!!{RESET}")
        print(f"{YELLOW}metadata.json asks for schema: '{target_schema_id}'{RESET}")
        print(f"{YELLOW}But your XML files only defined: {found_ids}{RESET}")
        print(f"-> Please open schemas/*.gschema.xml and ensure <schema id=\"{target_schema_id}\" ...>")
        return

    print(f"{GREEN}✓ Schema ID '{target_schema_id}' found in XML files.{RESET}")

    # B. Check System Registry
    print(f"Verifying system registry...")
    proc = subprocess.run(
        ["gsettings", "list-keys", target_schema_id], 
        stdout=subprocess.PIPE, 
        stderr=subprocess.PIPE, 
        text=True
    )
    
    if proc.returncode == 0:
            print(f"{GREEN}✓ System successfully sees schema '{target_schema_id}'.{RESET}")
    else:
            print(f"\n{RED}X System cannot find schema '{target_schema_id}' yet.{RESET}")
            print(f"{YELLOW}Diagnosed Cause:{RESET}")
            print(f"The XML file is installed, but the desktop session hasn't loaded it.")
            print(f"{YELLOW}Solution:{RESET}")
            print(f"You MUST log out and log back in to fix the Preferences window.")

def get_archive_url(repo, ref):
    if ref.startswith("v"):
        return f"https://github.com/{repo}/archive/refs/tags/{ref}.tar.gz"
    return f"https://github.com/{repo}/archive/refs/heads/{ref}.tar.gz"

def install_remote(args, target_base):
    """Downloads and installs the extension from GitHub (User Mode)."""
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
            sys.exit(f"{RED}Download failed: {e}{RESET}")

        try:
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(tmpdir)
        except Exception as e:
            sys.exit(f"{RED}Extraction failed: {e}{RESET}")

        extracted_items = [
            os.path.join(tmpdir, d) for d in os.listdir(tmpdir)
            if os.path.isdir(os.path.join(tmpdir, d))
        ]
        if not extracted_items:
            sys.exit(f"{RED}Error: Archive contained no directories.{RESET}")
        
        src_dir = extracted_items[0]
        metadata = load_metadata(src_dir)
        uuid = metadata.get("uuid")
        if not uuid:
            sys.exit(f"{RED}Error: UUID missing in downloaded metadata.json{RESET}")

        dest_dir = os.path.join(target_base, uuid)
        
        if os.path.exists(dest_dir):
            if os.path.islink(dest_dir):
                os.unlink(dest_dir)
            else:
                shutil.rmtree(dest_dir)

        os.makedirs(target_base, exist_ok=True)
        shutil.copytree(src_dir, dest_dir)
        print(f"Installed to: {dest_dir}")

        # --- UNIFIED SCHEMA LOGIC ---
        # We now compile global schemas even for remote installs to fix Prefs errors
        schemas_dir = os.path.join(dest_dir, "schemas")
        found_ids = install_schemas(schemas_dir)

        # Enable
        if run_cmd(["which", "gnome-extensions"], quiet=True):
            run_cmd(["gnome-extensions", "enable", uuid])
            print("Extension enabled via gnome-extensions.")
        
        # Check
        target_schema_id = metadata.get("settings-schema")
        run_diagnostics(target_schema_id, found_ids)
        
        print("\nDone! If the extension doesn't appear, log out and back in.")

def install_local(args, target_base):
    """Symlinks the current directory for development (Dev Mode)."""
    src_dir = os.path.abspath(args.src) if args.src else os.getcwd()
    metadata = load_metadata(src_dir)
    
    uuid = args.uuid or metadata.get("uuid")
    target_schema_id = args.schema or metadata.get("settings-schema")

    if not uuid:
        sys.exit(f"{RED}Error: UUID not found in metadata.json{RESET}")

    dest_dir = os.path.join(target_base, uuid)

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
        sys.exit(f"{RED}Error: Target {dest_dir} exists and is not a symlink. Remove it manually.{RESET}")
    else:
        os.symlink(src_dir, dest_dir)
        print("Created symlink.")

    # 2. Schemas (Unified)
    local_schemas_dir = os.path.join(src_dir, "schemas")
    found_ids = install_schemas(local_schemas_dir)

    # 3. Diagnostics
    run_diagnostics(target_schema_id, found_ids)

    # 4. Reset Settings
    if args.reset_settings:
        if target_schema_id:
            print(f"Resetting settings for {target_schema_id}...")
            subprocess.run(["gsettings", "reset-recursively", target_schema_id])
        else:
            print(f"{YELLOW}Warning: No 'settings-schema' in metadata.json. Cannot reset settings.{RESET}")

    print("\nDev setup complete.")
    print("If this is your first install, restart GNOME Shell (Alt+F2 -> r).")

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

    mode = args.mode
    if mode == "auto":
        has_local_meta = os.path.isfile("metadata.json") or (args.src and os.path.isfile(os.path.join(args.src, "metadata.json")))
        mode = "dev" if has_local_meta else "remote"

    if mode == "remote":
        install_remote(args, extensions_path)
    else:
        install_local(args, extensions_path)

if __name__ == "__main__":
    main()