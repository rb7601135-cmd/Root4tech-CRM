#!/usr/bin/env python
"""
Roo4Tech Smart CRM — Safe Database Backup Utility
Supports both PostgreSQL (via pg_dump) and SQLite (via sqlite3 online backup API).
Creates timestamped, compressed backup files under backend/backups/.
"""
import os
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / 'backups'
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

def backup():
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    db_url = os.getenv('DATABASE_URL', '')

    if db_url and db_url.startswith(('postgres://', 'postgresql://')):
        backup_file = BACKUP_DIR / f"crm_backup_postgres_{timestamp}.dump"
        print(f"[*] Starting PostgreSQL backup to: {backup_file}")
        cmd = f"pg_dump -Fc -d \"{db_url}\" -f \"{backup_file}\""
        try:
            subprocess.run(cmd, shell=True, check=True)
            print(f"[OK] PostgreSQL backup completed successfully: {backup_file} ({backup_file.stat().st_size} bytes)")
            return str(backup_file)
        except Exception as e:
            print(f"[!] PostgreSQL backup failed: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # SQLite
        src_db = BASE_DIR / 'db.sqlite3'
        if not src_db.exists():
            print(f"[!] SQLite source file not found at: {src_db}", file=sys.stderr)
            sys.exit(1)

        backup_file = BACKUP_DIR / f"crm_backup_sqlite_{timestamp}.sqlite3"
        print(f"[*] Starting SQLite backup to: {backup_file}")
        try:
            import sqlite3
            src_conn = sqlite3.connect(src_db)
            dst_conn = sqlite3.connect(backup_file)
            with dst_conn:
                src_conn.backup(dst_conn)
            dst_conn.close()
            src_conn.close()
            print(f"[OK] SQLite backup completed successfully: {backup_file} ({backup_file.stat().st_size} bytes)")
            return str(backup_file)
        except Exception as e:
            print(f"[!] SQLite backup failed: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    backup()
