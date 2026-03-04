"""
Data Export CronJob - Export dữ liệu ngày hôm qua lên MinIO và cập nhật metadata DB
Schedule: 0 1 * * * (01:00 UTC = 08:00 ICT)
"""
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ENV
POSTGRES_HOST     = os.getenv("POSTGRES_HOST")
POSTGRES_DBS      = os.getenv("POSTGRES_DBS")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_PORT     = int(os.getenv("POSTGRES_PORT", 5432))

DATABASE_URL = (
    f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
)

# Tên collection internal (cố định, chỉ tạo 1 lần)
INTERNAL_COLLECTION_TITLE = "Dữ liệu Phát hiện & Dự báo"
INTERNAL_DATA_TYPE        = "detections_forecasts"


def main():
    """
    Entry point: export toàn bộ dữ liệu ngày hôm qua lên MinIO và insert metadata vào DB
    """
    from query import create_db_engine, query_detections, query_forecasts, upsert_collection, insert_entry
    from exporter import export_detections, export_forecasts, export_summary

    now_utc = datetime.now(timezone.utc)

    # Ngày hôm qua (D-1), từ 00:00:00 → 23:59:59 UTC
    yesterday = (now_utc - timedelta(days=1)).date()
    date_from = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0, tzinfo=timezone.utc)
    date_to   = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59, tzinfo=timezone.utc)

    # Timestamp prefix cho tên file: YYYYMMDD_HHmmss (theo giờ chạy job)
    timestamp_str = now_utc.strftime("%Y%m%d_%H%M%S")

    logger.info(f"🚀 Data Export bắt đầu | Ngày: {yesterday} | Timestamp: {timestamp_str}")

    engine = create_db_engine(DATABASE_URL)

    # ---- 1. Query dữ liệu từ PostgreSQL ----
    logger.info("📥 Đang query detections...")
    detections_df = query_detections(engine, date_from, date_to)

    logger.info("📥 Đang query forecasts...")
    forecasts_df = query_forecasts(engine, date_from, date_to)

    if detections_df.empty and forecasts_df.empty:
        logger.warning(f"⚠️  Không có dữ liệu cho ngày {yesterday}. Bỏ qua.")
        return

    # ---- 2. Export lên MinIO ----
    all_minio_keys = {}
    all_file_sizes = {}

    if not detections_df.empty:
        logger.info(f"📤 Uploading detections ({len(detections_df):,} records)...")
        det_keys, det_sizes = export_detections(detections_df, yesterday, timestamp_str)
        all_minio_keys.update(det_keys)
        all_file_sizes.update(det_sizes)

    if not forecasts_df.empty:
        logger.info(f"📤 Uploading forecasts ({len(forecasts_df):,} records)...")
        fore_keys, fore_sizes = export_forecasts(forecasts_df, yesterday, timestamp_str)
        all_minio_keys.update(fore_keys)
        all_file_sizes.update(fore_sizes)

    # ---- 3. Summary ----
    logger.info("📤 Uploading summary.json...")
    summary_key = export_summary(yesterday, timestamp_str, detections_df, forecasts_df, all_minio_keys)
    all_minio_keys["summary"] = summary_key

    # ---- 4. Upsert metadata vào DB ----
    logger.info("💾 Cập nhật metadata vào database...")
    collection_id = upsert_collection(engine, INTERNAL_COLLECTION_TITLE, INTERNAL_DATA_TYPE)

    total_records = len(detections_df) + len(forecasts_df)
    insert_entry(
        engine,
        collection_id=collection_id,
        snapshot_date=yesterday,
        minio_keys=all_minio_keys,
        file_sizes=all_file_sizes,
        record_count=total_records,
    )

    logger.info(
        f"✅ Hoàn thành! {len(all_minio_keys)} files | "
        f"{total_records:,} records | Ngày: {yesterday}"
    )


if __name__ == "__main__":
    main()
