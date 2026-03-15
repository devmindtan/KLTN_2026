"""
Service riêng biệt để sync actual values vào camera_forecasts
Chạy độc lập với prediction service (offset 2-3 phút)
Purpose: Verify data quality và tính metrics chính xác
Date: 2026-02-25
"""
from shared.monitor_performance import monitor_performance
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


load_dotenv()

# ENV
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_DBS = os.getenv("POSTGRES_DBS")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

DATABASE_URL = f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
engine = create_engine(
    DATABASE_URL, poolclass=QueuePool, pool_size=10, max_overflow=20, pool_timeout=30
)


@monitor_performance
def sync_actual_values():
    """
    Sync actual values vào camera_forecasts chưa có actual_value (trong 5 giờ đổ lại)

    LOGIC QUAN TRỌNG:
    - Sync forecast có actual_value IS NULL trong khoảng 5 giờ gần đây
    - CHỈ sync bucket ĐÃ HOÀN THÀNH (forecast_for_time <= NOW() - 5 minutes)
    - VD: Sync chạy lúc 10:06 → Sync bucket 10:00-10:05 (đã đủ 5 phút)
    - KHÔNG sync bucket 10:05-10:10 (chưa đủ data do service delay)
    - Bù đắp forecast bị sót do service downtime/delay (tối đa 5h)
    - Đảm bảo sync_sample_count từ FULL 5-minute window
    - KHÔNG filter total_objects > 5: actual_value phải ghi đúng traffic thực tế
      kể cả giờ thấp điểm (traffic 0-5 xe vẫn là dữ liệu hợp lệ)

    Lưu thêm sync_sample_count để verify data quality
    """
    current_time_utc = datetime.now(timezone.utc)

    sync_query = text("""
        UPDATE camera_forecasts f
        SET
            actual_value = sub.real_avg,
            sync_sample_count = sub.sample_count,
            error_value = ABS(f.predicted_value - sub.real_avg)
        FROM (
            SELECT
                camera_id,
                time_bucket,
                real_avg,
                sample_count
            FROM (
                SELECT
                    camera_id,
                    to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket,
                    AVG(total_objects) AS real_avg,
                    COUNT(*) AS sample_count
                FROM camera_detections
                -- Lấy dữ liệu trong 5 giờ đổ lại để sync forecast bị sót
                -- NOTE: KHÔNG filter total_objects > 5 ở đây — actual_value phải
                -- phản ánh traffic thực tế kể cả giờ thấp điểm (0-5 xe/khung hình)
                WHERE created_at >= :now - interval '5 hour'
                GROUP BY camera_id, time_bucket
            ) inner_agg
            -- CHỈ lấy bucket ĐÃ HOÀN THÀNH (đủ 5 phút)
            WHERE time_bucket <= :now - interval '5 minutes'
        ) sub
        WHERE f.camera_id = sub.camera_id
          AND f.forecast_for_time = sub.time_bucket
          AND f.actual_value IS NULL
          -- Double-check: Chỉ sync forecast cho thời gian đã qua đủ 5 phút
          AND f.forecast_for_time <= :now - interval '5 minutes';
    """)

    try:
        with engine.begin() as conn:
            result = conn.execute(sync_query, {"now": current_time_utc})
            if result.rowcount > 0:
                logger.info(
                    f"📊 Đã đối soát thành công {result.rowcount} mốc dự báo.")
            else:
                logger.info(
                    "ℹ️  Không có forecast nào cần sync (có thể đã sync trước đó)")
    except Exception as e:
        logger.error(f"❌ Lỗi sync actual values: {e}")
        raise


if __name__ == "__main__":
    try:
        logger.info("🔄 Bắt đầu sync actual values...")
        sync_actual_values()
        logger.info("✅ Sync hoàn tất!")
    except Exception as e:
        logger.error(f"❌ Sync thất bại: {e}")
        sys.exit(1)
