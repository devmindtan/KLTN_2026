"""
Shared utilities cho Level of Service (LOS) calculation
Module này được dùng chung bởi image-process và image-predict services
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)

# Hằng số Capacity mặc định (fallback nếu không có dữ liệu lịch sử)
# Đơn vị: vehicles/5minutes
DEFAULT_CAPACITY = 100  # Capacity mặc định cho đường giao thông đô thị

# Ngưỡng Level of Service (LOS) theo tỉ lệ Volume/Capacity
LOS_THRESHOLDS = {
    "free_flow": 0.60,    # LOS A: < 60% capacity
    "smooth": 0.75,       # LOS B-C: 60-75% capacity
    "moderate": 0.85,     # LOS D: 75-85% capacity
    "heavy": 1.0,         # LOS E: 85-100% capacity
    # "congested": >= 1.0 # LOS F: >= 100% capacity
}


def get_camera_max_realtime_capacity(lookback_days: int = 7, camera_list=None) -> Dict[str, float]:
    """
    Tính toán capacity động cho realtime status - Lấy DÒNG LỚN NHẤT trực tiếp
    Dùng MAX(total_objects) KHÔNG qua trung bình 5 phút
    DÙNG BỞI: image-process service (status.current - realtime)

    Args:
        lookback_days: Số ngày lịch sử để tính capacity (default: 7 ngày)
        camera_list: List các camera_id cần fallback (optional)
    Returns:
        Dict[camera_id, capacity] hoặc dict với DEFAULT_CAPACITY nếu lỗi
    """
    try:
        import os
        from sqlalchemy import create_engine, text
        import pandas as pd
        from dotenv import load_dotenv

        load_dotenv()
        POSTGRES_HOST = os.getenv("POSTGRES_HOST")
        POSTGRES_DBS = os.getenv("POSTGRES_DBS")
        POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
        POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
        POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

        DATABASE_URL = f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
        engine = create_engine(DATABASE_URL)

        # Query MAX trực tiếp - KHÔNG qua aggregation
        query = text("""
            SELECT
                camera_id,
                MAX(total_objects) AS capacity
            FROM camera_detections
            WHERE created_at >= NOW() - INTERVAL :days
              AND total_objects > 5
            GROUP BY camera_id
            ORDER BY camera_id;
        """)

        df = pd.read_sql(query, engine, params={
                         "days": f"{lookback_days} days"})

        if df.empty:
            logger.warning(
                "⚠️ Không có dữ liệu realtime capacity, dùng DEFAULT_CAPACITY")
            if camera_list:
                return {cam_id: DEFAULT_CAPACITY for cam_id in camera_list}
            return {}

        capacity_dict = dict(zip(df["camera_id"], df["capacity"]))
        logger.info(
            f"✅ Loaded REALTIME capacity map cho {len(capacity_dict)} cameras (MAX dòng trong {lookback_days} ngày)")
        return capacity_dict

    except Exception as e:
        logger.error(f"❌ Lỗi load realtime capacity: {e}")
        if camera_list:
            return {cam_id: DEFAULT_CAPACITY for cam_id in camera_list}
        return {}


def get_camera_capacity_map(lookback_days: int = 7, camera_list=None) -> Dict[str, float]:
    """
    Tính toán capacity động cho prediction - Lấy MAX của trung bình 5 phút
    Lấy giá trị AVG(total_objects) theo bucket 5p, rồi lấy MAX
    DÙNG BỞI: image-predict service (status.forecast - prediction)

    Args:
        lookback_days: Số ngày lịch sử để tính capacity (default: 7 ngày)
        camera_list: List các camera_id cần fallback (optional)
    Returns:
        Dict[camera_id, capacity] hoặc dict với DEFAULT_CAPACITY nếu lỗi
    """
    try:
        import os
        from sqlalchemy import create_engine, text
        import pandas as pd
        from dotenv import load_dotenv

        load_dotenv()
        POSTGRES_HOST = os.getenv("POSTGRES_HOST")
        POSTGRES_DBS = os.getenv("POSTGRES_DBS")
        POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
        POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
        POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

        DATABASE_URL = f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
        engine = create_engine(DATABASE_URL)

        query = text("""
            WITH base_data AS (
                SELECT
                    camera_id,
                    total_objects,
                    to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket
                FROM camera_detections
                WHERE created_at >= NOW() - INTERVAL :days
                  AND total_objects > 5
            ),
            aggregated_stats AS (
                SELECT
                    camera_id,
                    time_bucket,
                    AVG(total_objects) AS avg_objects
                FROM base_data
                GROUP BY camera_id, time_bucket
            )
            SELECT
                camera_id,
                MAX(avg_objects) AS capacity
            FROM aggregated_stats
            GROUP BY camera_id
            ORDER BY camera_id;
        """)

        df = pd.read_sql(query, engine, params={
                         "days": f"{lookback_days} days"})

        if df.empty:
            logger.warning(
                "⚠️ Không có dữ liệu capacity lịch sử, dùng DEFAULT_CAPACITY")
            if camera_list:
                return {cam_id: DEFAULT_CAPACITY for cam_id in camera_list}
            return {}

        capacity_dict = dict(zip(df["camera_id"], df["capacity"]))
        logger.info(
            f"✅ Loaded capacity map cho {len(capacity_dict)} cameras (MAX {lookback_days} ngày)")
        return capacity_dict

    except Exception as e:
        logger.error(f"❌ Lỗi load capacity map: {e}")
        if camera_list:
            return {cam_id: DEFAULT_CAPACITY for cam_id in camera_list}
        return {}


def calculate_los_status(volume: float, capacity: float) -> str:
    """
    Tính toán Level of Service (LOS) dựa trên tỉ lệ Volume/Capacity

    Args:
        volume: Số lượng phương tiện (vehicles/5min)
        capacity: Năng lực đường đặc thù cho camera (vehicles/5min)

    Returns:
        Status string: "free_flow", "smooth", "moderate", "heavy", "congested"

    Examples:
        >>> calculate_los_status(50, 100)  # 50% capacity
        'free_flow'
        >>> calculate_los_status(80, 100)  # 80% capacity
        'moderate'
        >>> calculate_los_status(120, 100)  # 120% capacity
        'congested'
    """
    if volume <= 0 or capacity <= 0:
        return "unknown"

    vc_ratio = volume / capacity

    if vc_ratio < LOS_THRESHOLDS["free_flow"]:
        return "free_flow"      # LOS A
    elif vc_ratio < LOS_THRESHOLDS["smooth"]:
        return "smooth"         # LOS B-C
    elif vc_ratio < LOS_THRESHOLDS["moderate"]:
        return "moderate"       # LOS D
    elif vc_ratio < LOS_THRESHOLDS["heavy"]:
        return "heavy"          # LOS E
    else:
        return "congested"      # LOS F
