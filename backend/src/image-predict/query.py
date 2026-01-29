import logging
import os
import sys
from datetime import datetime, timedelta

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from monitor_performance import monitor_performance

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
    DATABASE_URL, poolclass=QueuePool, pool_size=10, max_overflow=20, pool_timeout=30
)


# Hàm này sẽ sử dụng cho query tổng và train và đánh giá
@monitor_performance
def query_from_db_total(start_date, end_date):
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

        logger.info(f"✅ Xử lý xong. Tổng số dòng thỏa điều kiện (>5): {len(chunks)}")
        return chunks

    except Exception as e:
        logger.error(f"Lỗi Postgres: {e}")
        return pd.DataFrame()


# Hàm này sẽ sử dụng cho query realtime thực tế
@monitor_performance
def query_from_db_realtime():
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

                    -- Features Quá khứ (LAG)
                    LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_5m,
                    LAG(avg_objects, 2) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_10m,
                    LAG(avg_objects, 3) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_15m,
                    LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_30m,
                    LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket) AS lag_60m,

                    -- Trends Quá khứ
                    (avg_objects - LAG(avg_objects, 1) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_5m,
                    (avg_objects - LAG(avg_objects, 6) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_30m,
                    (avg_objects - LAG(avg_objects, 12) OVER (PARTITION BY camera_id ORDER BY time_bucket)) AS trend_60m
                FROM aggregated_stats
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

        logger.info(f"✅ Xử lý xong. Tổng số dòng thỏa điều kiện (>5): {len(chunks)}")
        return chunks

    except Exception as e:
        logger.error(f"Lỗi Postgres: {e}")
        return pd.DataFrame()


@monitor_performance
def forecast_and_save_to_db(y_preds, df_input):
    horizons = [5, 10, 15, 30, 60]

    # 1. Lấy giờ UTC hiện tại từ Python để đóng dấu created_at
    current_time_utc = datetime.now()

    with engine.begin() as conn:
        for i, horizon in enumerate(horizons):
            for idx, row in df_input.iterrows():
                # 2. Xử lý time_bucket: loại bỏ múi giờ để tính toán thuần UTC
                base_time = row["time_bucket"].replace(tzinfo=None)

                # 3. Tính toán mốc thời gian dự báo (target_time)
                target_time = base_time + timedelta(minutes=horizon)
                target_time = target_time.replace(second=0, microsecond=0)

                pred_val = float(y_preds[df_input.index.get_loc(idx), i])

                # 4. Sử dụng tham số :now thay vì hàm NOW() của Postgres
                upsert_query = text("""
                    INSERT INTO camera_forecasts
                        (camera_id, forecast_for_time, horizon_minutes, predicted_value, created_at)
                    VALUES
                        (:cid, :ftime, :hmin, :pval, :now)
                    ON CONFLICT (camera_id, forecast_for_time, horizon_minutes)
                    DO UPDATE SET
                        predicted_value = EXCLUDED.predicted_value,
                        created_at = EXCLUDED.created_at;
                """)

                conn.execute(
                    upsert_query,
                    {
                        "cid": row["camera_id"],
                        "ftime": target_time,
                        "hmin": horizon,
                        "pval": pred_val,
                        "now": current_time_utc,  # Gửi giờ UTC trực tiếp từ Python
                    },
                )
    logger.info(f"✅ Đã cập nhật dự báo (UTC) cho {len(df_input)} camera.")


@monitor_performance
def sync_actual_values():
    # Phải dùng utcnow để khớp với DB đã reset timezone
    current_time_utc = datetime.now()

    sync_query = text("""
        UPDATE camera_forecasts f
        SET
            actual_value = sub.real_avg,
            error_value = ABS(f.predicted_value - sub.real_avg)
        FROM (
            SELECT
                camera_id,
                to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket,
                AVG(total_objects) AS real_avg
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
            logger.info(f"📊 Đã đối soát thành công {result.rowcount} mốc dự báo.")


# data = query_from_db_total("2026-01-22", "2026-01-22")
# data = data.dropna(subset=["target_10m", "target_15m", "target_30m", "target_60m"])
# print(data.shape)
# print(data.head(100))
# data = query_from_db_realtime()
# print(data.head(100))
