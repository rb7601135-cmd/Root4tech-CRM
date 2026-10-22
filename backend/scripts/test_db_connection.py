"""
Test Database Connection Utility for Roo4Tech CRM
Verifies connection to PostgreSQL / Supabase or SQLite database.
"""
import os
import sys
from pathlib import Path

# Set up Django environment
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.db import connection
from django.conf import settings

def test_connection():
    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')
    host = db_config.get('HOST', 'localhost')
    name = db_config.get('NAME', '')
    user = db_config.get('USER', '')

    print("=" * 60)
    print(" Roo4Tech CRM — Database Connection Test")
    print("=" * 60)
    print(f" Engine   : {engine}")
    print(f" Host     : {host}")
    print(f" Database : {name}")
    print(f" User     : {user}")
    print("-" * 60)

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            result = cursor.fetchone()
            if result and result[0] == 1:
                print(" [SUCCESS] Database Connection Established Successfully!")
                print("=" * 60)
                return True
    except Exception as e:
        print(f" [ERROR] Connection Failed: {e}")
        print("-" * 60)
        error_msg = str(e).lower()
        if 'password authentication failed' in error_msg:
            print(" [TIP] The database password in DATABASE_URL appears to be incorrect.")
            print("       Please check your Supabase database password in Project Settings -> Database.")
        elif 'could not translate host name' in error_msg or 'timeout' in error_msg or 'network is unreachable' in error_msg:
            print(" [TIP] Direct host connection failed (IPv6 issue). Use the Supabase Connection Pooler URL.")
        elif 'ssl' in error_msg:
            print(" [TIP] Supabase requires SSL. Ensure ?sslmode=require is appended to your DATABASE_URL.")
        print("=" * 60)
        return False

if __name__ == '__main__':
    success = test_connection()
    sys.exit(0 if success else 1)
