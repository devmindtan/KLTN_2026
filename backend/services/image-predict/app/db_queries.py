import logging
import os
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))

# Import sau khi sys.path đã được set
from shared.monitor_performance import monitor_performance  # noqa: E402


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

# postgresql+psycopg2://user:password@host:port/dbname
DATABASE_URL = f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,          # Kiểm tra connection còn sống trước mỗi query
    pool_recycle=1800,            # Recycle connection sau 30 phút tránh stale
    connect_args={
        "keepalives": 1,           # Bật TCP keepalive
        "keepalives_idle": 5,      # Gửi keepalive sau 5s idle (thay vì 30s) — tránh k8s CNI drop connection trong lúc query nặng
        "keepalives_interval": 5,  # Gửi lại mỗi 5s nếu không có ACK
        "keepalives_count": 5,     # Drop connection sau 5 lần thất bại
        "options": "-c statement_timeout=180000",  # Timeout query tối đa 3 phút
    },
)


@monitor_performance
def query_from_db_total(start_date, end_date):
    """
    Truy vấn dữ liệu lịch sử với LAG/LEAD features cho training và evaluation
    Args:
        start_date: Ngày bắt đầu (format: YYYY-MM-DD)
        end_date: Ngày kết thúc (format: YYYY-MM-DD)
    Returns:
        pandas DataFrame chứa features và targets hoặc empty DataFrame nếu lỗi
    """
    start_time = f"{start_date} 00:00:00"
    end_time = f"{end_date} 23:59:59"
    try:
        query = text("""
            WITH base_data AS (
                SELECT
                    camera_id,
                    total_objects,
                    to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket
                FROM camera_detections
                WHERE created_at >= CAST(:start AS TIMESTAMP) - interval '2 hour'
                  AND created_at <= CAST(:end AS TIMESTAMP)
                  AND total_objects > 5
            ),
            aggregated_stats AS (
                SELECT
                    camera_id,
                    time_bucket,
                    AVG(total_objects) AS avg_objects,
                    MIN(total_objects) AS min_objects,
                    MAX(total_objects) AS max_objects,
                    COUNT(*) as sample_count
                FROM base_data
                GROUP BY camera_id, time_bucket
            )
            SELECT
                camera_id,
                time_bucket,
                EXTRACT(YEAR FROM time_bucket)::int AS year,
                EXTRACT(MONTH FROM time_bucket)::int AS month,
                EXTRACT(WEEK FROM time_bucket)::int AS week,
                EXTRACT(DAY FROM time_bucket)::int AS day,
                EXTRACT(DOW FROM time_bucket)::int AS day_of_week,
                EXTRACT(HOUR FROM time_bucket)::int AS hour,
                EXTRACT(MINUTE FROM time_bucket)::int AS minute,

                -- Chỉ số hiện tại
                avg_objects,
                min_objects,
                max_objects,
                sample_count,

                -- Features (Quá khứ)
                LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_5m,
                LAG(avg_objects, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_10m,
                LAG(avg_objects, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_15m,
                LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_30m,
                LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_60m,

                -- Sample counts cho mỗi LAG window
                LAG(sample_count, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_5m_count,
                LAG(sample_count, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_10m_count,
                LAG(sample_count, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_15m_count,
                LAG(sample_count, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_30m_count,
                LAG(sample_count, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_60m_count,

                -- Trends (Quá khứ)
                (avg_objects - LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_5m,
                (avg_objects - LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_30m,
                (avg_objects - LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_60m,

                -- Targets (Đáp án tương lai)
                LEAD(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS target_5m,
                LEAD(avg_objects, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS target_10m,
                LEAD(avg_objects, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS target_15m,
                LEAD(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS target_30m,
                LEAD(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS target_60m

            FROM aggregated_stats
            WHERE time_bucket >= CAST(:start AS TIMESTAMP)
            ORDER BY time_bucket DESC, camera_id ASC;
        """)

        chunks = pd.read_sql(
            query,
            engine,
            params={"start": start_time, "end": end_time},
            # chunksize=30000,
        )

        logger.info(
            f"✅ Xử lý xong. Tổng số dòng thỏa điều kiện (>5): {len(chunks)}")
        return chunks

    except Exception as e:
        logger.error(f"Lỗi Postgres: {e}")
        return pd.DataFrame()


@monitor_performance
def query_from_db_realtime():
    """
    Truy vấn dữ liệu realtime (2 giờ gần nhất) với LAG features cho prediction

    LOGIC QUAN TRỌNG:
    - CHỈ lấy bucket ĐÃ HOÀN THÀNH (time_bucket <= NOW() - 5 minutes)
    - VD: Predict chạy lúc 10:01 → Lấy bucket 9:55-10:00 làm input (đã đủ 5 phút)
    - KHÔNG lấy bucket 10:00-10:05 (chưa đủ data do service delay và cronjob lệch)

    Returns:
        pandas DataFrame chứa dữ liệu hiện tại hoặc empty DataFrame nếu lỗi
    """
    try:
        query = text("""
            WITH base_data AS (
                SELECT
                    camera_id,
                    total_objects,
                    -- Làm tròn về mốc 5 phút gần nhất
                    to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket
                FROM camera_detections
                -- Lấy dữ liệu trong 2 tiếng đổ lại để tính LAG/TREND
                WHERE created_at >= NOW() - interval '2 hour'
                  AND total_objects > 5
            ),
            aggregated_stats AS (
                SELECT
                    camera_id,
                    time_bucket,
                    AVG(total_objects) AS avg_objects,
                    MIN(total_objects) AS min_objects,
                    MAX(total_objects) AS max_objects,
                    COUNT(*) as sample_count
                FROM base_data
                GROUP BY camera_id, time_bucket
            ),
            calculated_features AS (
                SELECT
                    camera_id,
                    time_bucket,
                    EXTRACT(DOW FROM time_bucket)::int AS day_of_week,
                    EXTRACT(HOUR FROM time_bucket)::int AS hour,
                    EXTRACT(MINUTE FROM time_bucket)::int AS minute,
                    avg_objects,
                    sample_count,

                    -- Features Quá khứ (LAG)
                    LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_5m,
                    LAG(avg_objects, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_10m,
                    LAG(avg_objects, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_15m,
                    LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_30m,
                    LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_60m,

                    -- Sample counts cho mỗi LAG window
                    LAG(sample_count, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_5m_count,
                    LAG(sample_count, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_10m_count,
                    LAG(sample_count, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_15m_count,
                    LAG(sample_count, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_30m_count,
                    LAG(sample_count, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_60m_count,

                    -- Trends Quá khứ
                    (avg_objects - LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_5m,
                    (avg_objects - LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_30m,
                    (avg_objects - LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_60m
                FROM aggregated_stats
                -- CHỈ LẤY BUCKET ĐÃ HOÀN THÀNH (đủ 5 phút)
                -- VD: Predict chạy 10:01 → Lấy bucket 9:55-10:00 (hoàn thành)
                --     KHÔNG lấy bucket 10:00-10:05 (chưa đủ data do service delay)
                WHERE time_bucket <= NOW() - INTERVAL '5 minutes'
            )
            -- CHỈ LẤY DÒNG MỚI NHẤT CỦA MỖI CAMERA
            SELECT * FROM (
                SELECT *,
                ROW_NUMBER() OVER (PARTITION BY camera_id ORDER BY time_bucket DESC) as rn
                FROM calculated_features
            ) t
            WHERE rn = 1;
        """)

        chunks = pd.read_sql(
            query,
            engine,
        )

        logger.info(
            f"✅ Xử lý xong. Tổng số dòng thỏa điều kiện (>5): {len(chunks)}")
        return chunks

    except Exception as e:
        logger.error(f"Lỗi Postgres: {e}")
        return pd.DataFrame()


@monitor_performance
def forecast_and_save_to_db(y_preds, df_input):
    horizons = [5, 10, 15, 30, 60]

    # 1. Lấy giờ UTC hiện tại từ Python để đóng dấu created_at
    current_time_utc = datetime.now(timezone.utc)

    with engine.begin() as conn:
        for i, horizon in enumerate(horizons):
            for idx, row in df_input.iterrows():
                # 2. Xử lý time_bucket: loại bỏ múi giờ để tính toán thuần UTC
                base_time = row["time_bucket"].replace(tzinfo=None)

                # 3. Tính toán mốc thời gian dự báo (target_time)
                target_time = base_time + timedelta(minutes=horizon)
                target_time = target_time.replace(second=0, microsecond=0)

                pred_val = float(y_preds[df_input.index.get_loc(idx), i])

                # Extract metadata từ df_input (sample counts + input value)
                input_sample_count = int(row.get("sample_count", 0))
                input_value = float(row.get("avg_objects", 0))
                lag_count_col = f"lag_{horizon}m_count"
                lag_sample_count = int(
                    row.get(lag_count_col, 0)) if lag_count_col in row.index else None

                # 4. Sử dụng tham số :now thay vì hàm NOW() của Postgres
                upsert_query = text("""
                    INSERT INTO camera_forecasts
                        (camera_id, forecast_for_time, horizon_minutes, predicted_value, created_at,
                         input_sample_count, lag_sample_count, input_value)
                    VALUES
                        (:cid, :ftime, :hmin, :pval, :now, :input_count, :lag_count, :input_val)
                    ON CONFLICT (camera_id, forecast_for_time, horizon_minutes)
                    DO UPDATE SET
                        predicted_value = EXCLUDED.predicted_value,
                        created_at = EXCLUDED.created_at,
                        input_sample_count = EXCLUDED.input_sample_count,
                        lag_sample_count = EXCLUDED.lag_sample_count,
                        input_value = EXCLUDED.input_value;
                """)

                conn.execute(
                    upsert_query,
                    {
                        "cid": row["camera_id"],
                        "ftime": target_time,
                        "hmin": horizon,
                        "pval": pred_val,
                        "now": current_time_utc,  # Gửi giờ UTC trực tiếp từ Python
                        "input_count": input_sample_count,
                        "lag_count": lag_sample_count,
                        "input_val": input_value,
                    },
                )
    logger.info(f"✅ Đã cập nhật dự báo (UTC) cho {len(df_input)} camera.")


@monitor_performance
def get_camera_capacity_map(lookback_days: int = 7):
    """
    [DEPRECATED - Sử dụng shared.los_utils.get_camera_capacity_map() thay thế]
    Wrapper function để backward compatibility
    Tính toán capacity động cho từng camera dựa trên giá trị MAX trong dữ liệu lịch sử
    Lấy giá trị trung bình 5 phút LỚN NHẤT làm capacity
    Args:
        lookback_days: Số ngày lịch sử để tính capacity (default: 7 ngày)
    Returns:
        Dict[camera_id, capacity] hoặc empty dict nếu lỗi
    """
    # Import shared function để đồng bộ logic
    from shared.los_utils import get_camera_capacity_map as shared_get_capacity

    logger.warning(
        "⚠️ Sử dụng deprecated function. Recommend: import từ shared.los_utils")
    return shared_get_capacity(lookback_days=lookback_days)


@monitor_performance
def sync_actual_values():
    # Phải dùng utcnow để khớp với DB đã reset timezone
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
                to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket,
                AVG(total_objects) AS real_avg,
                COUNT(*) AS sample_count
            FROM camera_detections
            WHERE created_at >= :now - interval '2 hour'
            GROUP BY camera_id, time_bucket
        ) sub
        WHERE f.camera_id = sub.camera_id
          AND f.forecast_for_time = sub.time_bucket
          AND f.actual_value IS NULL;
    """)

    with engine.begin() as conn:
        result = conn.execute(sync_query, {"now": current_time_utc})
        if result.rowcount > 0:
            logger.info(
                f"📊 Đã đối soát thành công {result.rowcount} mốc dự báo.")


# data = query_from_db_total("2026-01-22", "2026-01-22")
# data = data.dropna(subset=["target_10m", "target_15m", "target_30m", "target_60m"])
# print(data.shape)
# print(data.head(100))
# data = query_from_db_realtime()
# print(data.head(100))
