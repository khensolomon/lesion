#!/usr/bin/env python3
import os
import shutil
import subprocess

UID_NAME = "lesion"
UUID = f"{UID_NAME}@example.com"
SCHEMA_ID = "dev.lethil.lesion"

home = os.path.expanduser("~")
ext_src = f"{home}/dev/{UID_NAME}"
ext_dst = f"{home}/.local/share/gnome-shell/extensions/{UUID}"
schema_src = f"{ext_dst}/schemas/{SCHEMA_ID}.gschema.xml"
schema_dst_dir = f"{home}/.local/share/glib-2.0/schemas"

if not os.path.isdir(ext_src):
    raise SystemExit(f"Extension source not found: {ext_src}")

os.makedirs(schema_dst_dir, exist_ok=True)

# Symlink
if os.path.islink(ext_dst):
    print("Symlink already exists:", ext_dst)
elif os.path.exists(ext_dst):
    raise SystemExit("A non-symlink directory exists at destination.")
else:
    os.symlink(ext_src, ext_dst)
    print("Created symlink →", ext_dst)

# Copy schema
if os.path.isfile(schema_src):
    shutil.copy(schema_src, schema_dst_dir)
    print("Copied schema to:", schema_dst_dir)
else:
    print("Schema not found:", schema_src)

# Compile schemas
subprocess.run(["glib-compile-schemas", schema_dst_dir], check=True)
print("Schemas compiled!")
