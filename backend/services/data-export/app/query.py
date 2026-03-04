"""
Query module - Lấy dữ liệu từ PostgreSQL cho data-export service
"""
import logging
from datetime import date, datetime, timezone
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)


def create_db_engine(database_url: str):
    """Tạo SQLAlchemy engine kết nối PostgreSQL"""
    return create_engine(database_url, pool_pre_ping=True)


def query_detections(engine, date_from: datetime, date_to: datetime) -> pd.DataFrame:
    """
    Query camera_detections trong khoảng ngày cho trước
    Trả về DataFrame với các cột: camera_id, minio_key, total_objects, detections, created_at
    """
    sql = text("""
        SELECT
            camera_id,
            minio_key,
            total_objects,
            detections,
            created_at
        FROM camera_detections
        WHERE created_at >= :date_from
          AND created_at < :date_to
        ORDER BY created_at ASC
    """)

    with engine.connect() as conn:
        result = conn.execute(sql, {"date_from": date_from, "date_to": date_to})
        rows = result.fetchall()
        columns = result.keys()

    df = pd.DataFrame(rows, columns=list(columns))
    logger.info(f"[query_detections] Lấy được {len(df)} records từ {date_from.date()}")
    return df


def query_forecasts(engine, date_from: datetime, date_to: datetime) -> pd.DataFrame:
    """
    Query camera_forecasts trong khoảng ngày cho trước
    Trả về DataFrame với đầy đủ các cột dự báo và sync
    """
    sql = text("""
        SELECT
            camera_id,
            forecast_for_time,
            horizon_minutes,
            predicted_value,
            actual_value,
            error_value,
            input_value,
            created_at
        FROM camera_forecasts
        WHERE created_at >= :date_from
          AND created_at < :date_to
        ORDER BY forecast_for_time ASC, horizon_minutes ASC
    """)

    with engine.connect() as conn:
        result = conn.execute(sql, {"date_from": date_from, "date_to": date_to})
        rows = result.fetchall()
        columns = result.keys()

    df = pd.DataFrame(rows, columns=list(columns))
    logger.info(f"[query_forecasts] Lấy được {len(df)} records từ {date_from.date()}")
    return df


def upsert_collection(engine, title: str, data_type: str) -> str:
    """
    Lấy collection_id của internal collection, tạo mới nếu chưa có
    Trả về UUID của collection
    """
    sql_select = text("""
        SELECT id FROM data_library_collections
        WHERE source = 'internal' AND data_type = :data_type
        LIMIT 1
    """)
    sql_insert = text("""
        INSERT INTO data_library_collections (source, title, data_type)
        VALUES ('internal', :title, :data_type)
        RETURNING id
    """)

    with engine.connect() as conn:
        row = conn.execute(sql_select, {"data_type": data_type}).fetchone()
        if row:
            return str(row[0])
        result = conn.execute(sql_insert, {"title": title, "data_type": data_type})
        collection_id = str(result.fetchone()[0])
        conn.commit()
        logger.info(f"[upsert_collection] Tạo collection mới: {title} ({collection_id})")
        return collection_id


def insert_entry(
    engine,
    collection_id: str,
    snapshot_date: date,
    minio_keys: dict,
    file_sizes: dict,
    record_count: int,
) -> Optional[str]:
    """
    Insert hoặc cập nhật entry vào data_library_entries
    Dùng ON CONFLICT để tránh trùng lặp nếu cronjob chạy lại
    """
    sql = text("""
        INSERT INTO data_library_entries
            (collection_id, snapshot_date, minio_keys, file_sizes, record_count, uploaded_by)
        VALUES
            (:collection_id, :snapshot_date, :minio_keys, :file_sizes, :record_count, NULL)
        ON CONFLICT (collection_id, snapshot_date)
        DO UPDATE SET
            minio_keys   = EXCLUDED.minio_keys,
            file_sizes   = EXCLUDED.file_sizes,
            record_count = EXCLUDED.record_count
        RETURNING id
    """)

    import json
    with engine.connect() as conn:
        result = conn.execute(sql, {
            "collection_id": collection_id,
            "snapshot_date": snapshot_date,
            "minio_keys":    json.dumps(minio_keys),
            "file_sizes":    json.dumps(file_sizes),
            "record_count":  record_count,
        })
        entry_id = str(result.fetchone()[0])
        conn.commit()
        logger.info(f"[insert_entry] Entry upserted: {snapshot_date} → {entry_id}")
        return entry_id
