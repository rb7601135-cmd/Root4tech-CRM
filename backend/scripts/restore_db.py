#!/usr/bin/env python
"""
Roo4Tech Smart CRM — Safe Database Restoration Utility
Restores database from a verified backup file.
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def restore(backup_path: str):
    backup_file = Path(backup_path)
    if not backup_file.exists():
        print(f"[!] Backup file not found: {backup_file}", file=sys.stderr)
        sys.exit(1)

    db_url = os.getenv('DATABASE_URL', '')
    if db_url and db_url.startswith(('postgres://', 'postgresql://')):
        print(f"[*] Restoring PostgreSQL database from: {backup_file}")
        cmd = f"pg_restore --clean --if-exists -d \"{db_url}\" \"{backup_file}\""
        try:
            subprocess.run(cmd, shell=True, check=True)
            print(f"[OK] PostgreSQL restore completed successfully from {backup_file}")
        except Exception as e:
            print(f"[!] PostgreSQL restore failed: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        target_db = BASE_DIR / 'db.sqlite3'
        print(f"[*] Restoring SQLite database to: {target_db} from {backup_file}")
        try:
            shutil.copy2(backup_file, target_db)
            print(f"[OK] SQLite database restored successfully: {target_db} ({target_db.stat().st_size} bytes)")
        except Exception as e:
            print(f"[!] SQLite restore failed: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python restore_db.py <path_to_backup_file>")
        sys.exit(1)
    restore(sys.argv[1])
