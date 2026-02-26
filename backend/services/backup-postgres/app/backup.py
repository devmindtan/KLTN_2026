#!/usr/bin/env python3
"""
Backup PostgreSQL sử dụng rclone thay vì Google Drive API
Phù hợp với personal Google account
"""

import os
import subprocess
import gzip
import shutil
from datetime import datetime, timezone
from pathlib import Path
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Environment variables
DB_HOST = os.getenv('POSTGRES_HOST')
DB_PORT = os.getenv('POSTGRES_PORT')
DB_NAME = os.getenv('POSTGRES_DB')
DB_USER = os.getenv('POSTGRES_USER')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD')

RCLONE_REMOTE = os.getenv('RCLONE_REMOTE', 'gdrive')  # rclone remote name
RCLONE_FOLDER = os.getenv(
    'RCLONE_FOLDER', 'School/KLTN_2026/In-project/Backups')  # Folder path in Drive
BACKUP_DIR = '/tmp/backups'
BACKUP_TYPE = os.getenv('BACKUP_TYPE', 'full')


def log_backup_start(cursor):
    """Log thời gian bắt đầu backup vào Postgres"""
    cursor.execute("""
        INSERT INTO backup_logs (backup_type, started_at, status)
        VALUES (%s, %s, 'running')
        RETURNING id
    """, (BACKUP_TYPE, datetime.now(timezone.utc)))
    backup_id = cursor.fetchone()[0]
    cursor.connection.commit()
    print(f"✅ Logged backup start - ID: {backup_id}")
    return backup_id


def log_backup_complete(cursor, backup_id, storage_location, file_size_mb, metadata, error_message=None):
    """Log thời gian hoàn thành backup vào Postgres"""
    completed_at = datetime.now(timezone.utc)
    status = 'success' if not error_message else 'failed'

    cursor.execute("""
        UPDATE backup_logs
        SET completed_at = %s,
            duration_seconds = EXTRACT(EPOCH FROM (%s - started_at))::INTEGER,
            status = %s,
            storage_location = %s,
            file_size_mb = %s,
            compressed = TRUE,
            error_message = %s,
            metadata = %s
        WHERE id = %s
    """, (completed_at, completed_at, status, storage_location, file_size_mb, error_message, Json(metadata), backup_id))
    cursor.connection.commit()
    print(f"✅ Logged backup complete - Status: {status}")


def run_pg_dump():
    """Chạy pg_dump để backup database"""
    Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    dump_file = f"{BACKUP_DIR}/postgres_backup_{timestamp}.sql"

    cmd = [
        'pg_dump',
        f'--host={DB_HOST}',
        f'--port={DB_PORT}',
        f'--username={DB_USER}',
        f'--dbname={DB_NAME}',
        '--no-password',
        '--verbose',
        '--format=plain',
    ]

    if BACKUP_TYPE == 'schema-only':
        cmd.append('--schema-only')

    env = os.environ.copy()
    env['PGPASSWORD'] = DB_PASSWORD

    print(f"🔄 Running pg_dump to {dump_file}...")
    with open(dump_file, 'w') as f:
        result = subprocess.run(cmd, env=env, stdout=f,
                                stderr=subprocess.PIPE, text=True)

    if result.returncode != 0:
        raise Exception(f"pg_dump failed: {result.stderr}")

    print(f"✅ pg_dump completed - {dump_file}")
    return dump_file


def compress_file(source_file):
    """Compress file bằng gzip"""
    compressed_file = f"{source_file}.gz"
    print(f"🔄 Compressing {source_file}...")

    with open(source_file, 'rb') as f_in:
        with gzip.open(compressed_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    os.remove(source_file)

    file_size_mb = os.path.getsize(compressed_file) / (1024 * 1024)
    print(f"✅ Compressed to {compressed_file} - Size: {file_size_mb:.2f} MB")
    return compressed_file, file_size_mb


def upload_with_rclone(file_path):
    """Upload file lên Google Drive bằng rclone"""
    print(f"🔄 Uploading to Google Drive via rclone...")

    file_name = os.path.basename(file_path)
    remote_path = f"{RCLONE_REMOTE}:{RCLONE_FOLDER}/{file_name}"

    # rclone copy with progress
    cmd = [
        'rclone', 'copy',
        file_path,
        f"{RCLONE_REMOTE}:{RCLONE_FOLDER}",
        '--progress',
        '--stats', '5s'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise Exception(f"rclone upload failed: {result.stderr}")

    # Get file link (approximate)
    storage_location = f"rclone://{remote_path}"

    print(f"✅ Uploaded to Google Drive")
    print(f"📁 Remote path: {remote_path}")

    return storage_location


def get_database_stats(cursor):
    """Lấy thống kê database để lưu vào metadata"""
    cursor.execute("""
        SELECT 
            schemaname,
            COUNT(*) as table_count
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY schemaname
    """)
    schema_stats = cursor.fetchall()

    cursor.execute("""
        SELECT 
            COUNT(*) as total_tables
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    """)
    total_tables = cursor.fetchone()[0]

    cursor.execute("""
        SELECT 
            relname as table_name,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
    """)
    top_tables = cursor.fetchall()

    return {
        'total_tables': total_tables,
        'schemas': [{'name': s[0], 'table_count': s[1]} for s in schema_stats],
        'top_tables': [{'name': t[0], 'rows': t[1]} for t in top_tables]
    }


def main():
    """Main backup workflow với rclone"""
    print("=" * 60)
    print("🚀 PostgreSQL Backup to Google Drive (rclone) - Starting...")
    print(f"⏰ Time: {datetime.now(timezone.utc).isoformat()}")
    print(f"📦 Backup Type: {BACKUP_TYPE}")
    print("=" * 60)

    backup_id = None
    conn = None

    try:
        # Connect to database
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()

        # 1. Log start time
        backup_id = log_backup_start(cursor)

        # 2. Get database stats
        metadata = get_database_stats(cursor)
        print(f"📊 Database stats: {metadata['total_tables']} tables")

        # 3. Run pg_dump
        dump_file = run_pg_dump()

        # 4. Compress
        compressed_file, file_size_mb = compress_file(dump_file)

        # 5. Upload with rclone
        storage_location = upload_with_rclone(compressed_file)

        # 6. Update metadata
        metadata['rclone_remote'] = RCLONE_REMOTE
        metadata['rclone_folder'] = RCLONE_FOLDER
        metadata['original_filename'] = os.path.basename(compressed_file)

        # 7. Log completion
        log_backup_complete(
            cursor=cursor,
            backup_id=backup_id,
            storage_location=storage_location,
            file_size_mb=file_size_mb,
            metadata=metadata
        )

        # Cleanup
        os.remove(compressed_file)

        print("=" * 60)
        print("✅ Backup completed successfully!")
        print(f"📦 File: {os.path.basename(compressed_file)}")
        print(f"💾 Size: {file_size_mb:.2f} MB")
        print(f"📁 Location: {storage_location}")
        print("=" * 60)

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Backup failed: {error_msg}")

        if backup_id and conn:
            cursor = conn.cursor()
            log_backup_complete(
                cursor=cursor,
                backup_id=backup_id,
                storage_location=None,
                file_size_mb=None,
                metadata={},
                error_message=error_msg
            )

        raise

    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
