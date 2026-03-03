#!/usr/bin/env python3
"""
Backup PostgreSQL sử dụng rclone thay vì Google Drive API
Phù hợp với personal Google account
"""

import os
import subprocess
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
    """
    Chạy pg_dump với định dạng custom (-Fc) và nén tích hợp.
    Loại bỏ bước gzip riêng biệt → giảm 50% I/O disk.
    Thêm lock-timeout để không block traffic production.
    """
    Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    # .dump = custom binary format (nén tích hợp, không cần gzip riêng)
    dump_file = f"{BACKUP_DIR}/postgres_backup_{timestamp}.dump"

    cmd = [
        'pg_dump',
        f'--host={DB_HOST}',
        f'--port={DB_PORT}',
        f'--username={DB_USER}',
        f'--dbname={DB_NAME}',
        '--no-password',
        '--format=custom',       # Binary format với nén tích hợp
        '--compress=6',          # Level 6: cân bằng tốc độ/kích thước
        f'--file={dump_file}',   # lock_timeout được set qua PGOPTIONS env bên dưới
    ]

    if BACKUP_TYPE == 'schema-only':
        cmd.append('--schema-only')

    env = os.environ.copy()
    env['PGPASSWORD'] = DB_PASSWORD
    # lock_timeout: fail nhanh nếu bị block bởi lock khác (30s)
    # statement_timeout=0: không timeout COPY của bảng lớn
    # tcp_keepalives_*: gửi TCP keepalive mỗi 10s để CNI không drop connection
    #   khi COPY bảng lớn (camera_detections có thể stream hàng trăm ngàn rows)
    env['PGOPTIONS'] = (
        '-c lock_timeout=30000'
        ' -c statement_timeout=0'
        ' -c tcp_keepalives_idle=10'
        ' -c tcp_keepalives_interval=5'
        ' -c tcp_keepalives_count=3'
    )

    print(f"🔄 Running pg_dump (format=custom, compress=6) to {dump_file}...")
    result = subprocess.run(cmd, env=env, stderr=subprocess.PIPE, text=True)

    if result.returncode != 0:
        # Dọn file dump bị lỗi tránh tốn disk
        if os.path.exists(dump_file):
            os.remove(dump_file)
        raise Exception(f"pg_dump failed: {result.stderr}")

    file_size_mb = os.path.getsize(dump_file) / (1024 * 1024)
    print(f"✅ pg_dump completed - {dump_file} ({file_size_mb:.2f} MB)")
    return dump_file, file_size_mb


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
    """
    Lấy thống kê database để lưu metadata.
    Gộp 3 queries cũ thành 1 query duy nhất để giảm round-trip DB.
    """
    cursor.execute("""
        SELECT
            schemaname,
            relname AS table_name,
            n_live_tup AS row_count,
            pg_size_pretty(pg_total_relation_size(
                quote_ident(schemaname) || '.' || quote_ident(relname)
            )) AS table_size
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n_live_tup DESC
    """)
    tables = cursor.fetchall()

    # Tổng hợp schema counts từ kết quả duy nhất
    schema_counts: dict[str, int] = {}
    for row in tables:
        schema_counts[row[0]] = schema_counts.get(row[0], 0) + 1

    return {
        'total_tables': len(tables),
        'schemas': [{'name': k, 'table_count': v} for k, v in schema_counts.items()],
        'top_tables': [
            {'name': t[1], 'rows': t[2], 'size': t[3]}
            for t in tables[:10]
        ]
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

        # 2. Get database stats (single query)
        metadata = get_database_stats(cursor)
        print(f"📊 Database stats: {metadata['total_tables']} tables")

        # 3. Run pg_dump với custom format + nén tích hợp (không cần bước gzip riêng)
        dump_file, file_size_mb = run_pg_dump()

        # 4. Upload with rclone (file .dump đã được nén sẵn)
        storage_location = upload_with_rclone(dump_file)

        # 5. Update metadata
        metadata['rclone_remote'] = RCLONE_REMOTE
        metadata['rclone_folder'] = RCLONE_FOLDER
        metadata['original_filename'] = os.path.basename(dump_file)
        metadata['dump_format'] = 'custom'  # Có thể restore bằng pg_restore

        # 6. Log completion
        log_backup_complete(
            cursor=cursor,
            backup_id=backup_id,
            storage_location=storage_location,
            file_size_mb=file_size_mb,
            metadata=metadata
        )

        # Cleanup
        os.remove(dump_file)

        print("=" * 60)
        print("✅ Backup completed successfully!")
        print(f"📦 File: {os.path.basename(dump_file)}")
        print(f"💾 Size: {file_size_mb:.2f} MB")
        print(f"📁 Location: {storage_location}")
        print("=" * 60)

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Backup failed: {error_msg}")

        if backup_id and conn:
            try:
                cursor = conn.cursor()
                log_backup_complete(
                    cursor=cursor,
                    backup_id=backup_id,
                    storage_location=None,
                    file_size_mb=None,
                    metadata={},
                    error_message=error_msg
                )
            except Exception:
                pass  # Không để lỗi log che khuất lỗi chính

        raise

    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
