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

# -------------------------------------------------------
# GTI – General Trend Index
# -------------------------------------------------------

# Trọng số cho từng mốc dự đoán (tổng = 1.0)
# Ưu tiên mốc gần (5m) vì có tác động thực tế cao hơn
GTI_WEIGHTS: Dict[str, float] = {
    "5m":  0.35,
    "10m": 0.25,
    "15m": 0.20,
    "30m": 0.15,
    "60m": 0.05,
}

# Ngưỡng phân loại trạng thái theo GTI (%)
GTI_STATE_THRESHOLDS = {
    "free_flow":         30,   # GTI 0–30 %  : Thông thoáng
    "normal":            60,   # GTI 31–60 % : Bình thường
    "congestion_start":  85,   # GTI 61–85 % : Bắt đầu tắc nghẽ
    # GTI > 85 %: congestion_risk
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


def calculate_gti(forecasts: Dict[str, float], capacity: float) -> Dict:
    """
    Tính General Trend Index (GTI) – chỉ số xu hướng tổng hợp đa mốc thời gian.

    GTI = (Σ P_i × w_i / Max) × 100

    Args:
        forecasts: Dict dự đoán theo horizon {"5m": x, "10m": x, "15m": x, "30m": x, "60m": x}
        capacity: Năng lực tối đa của camera (vehicles/5min, lấy MAX 7 ngày)

    Returns:
        Dict {
            "gti": GTI theo % (0–100+),
            "weighted_sum": tổng có trọng số,
            "current_ratio": tỉ lệ current/capacity (được tính riêng khi gọi)
        }
    """
    if capacity <= 0:
        return {"gti": 0.0, "weighted_sum": 0.0}

    weighted_sum = sum(
        forecasts.get(horizon, 0) * weight
        for horizon, weight in GTI_WEIGHTS.items()
    )
    gti = (weighted_sum / capacity) * 100

    return {
        "gti": round(gti, 2),
        "weighted_sum": round(weighted_sum, 2),
    }


def classify_gti_state(gti: float) -> str:
    """
    Phân loại trạng thái giao thông dựa trên giá trị GTI (%).

    Args:
        gti: Giá trị GTI tính bằng % (từ calculate_gti)

    Returns:
        State string: "free_flow" | "normal" | "congestion_start" | "congestion_risk"
    """
    if gti <= GTI_STATE_THRESHOLDS["free_flow"]:
        return "free_flow"          # 0–30%
    elif gti <= GTI_STATE_THRESHOLDS["normal"]:
        return "normal"             # 31–60%
    elif gti <= GTI_STATE_THRESHOLDS["congestion_start"]:
        return "congestion_start"   # 61–85%
    else:
        return "congestion_risk"    # > 85%


def calculate_trend_by_gti(
    current: float,
    capacity: float,
    forecasts: Dict[str, float],
    threshold: float = 5.0,
) -> Dict:
    """
    Tính xu hướng giao thông dựa trên GTI so với Current Ratio.

    Rules:
        GTI > current_ratio + threshold  → "increasing"
        GTI < current_ratio - threshold  → "decreasing"
        else                             → "stable"

    Args:
        current: Giá trị lưu lượng hiện tại (vehicles/5min)
        capacity: Năng lực tối đa của camera
        forecasts: Dict dự đoán {"5m": x, "10m": x, "15m": x, "30m": x, "60m": x}
        threshold: Ngưỡng % xác định xu hướng đáng kể (default 5%)

    Returns:
        Dict {
            "direction": "increasing" | "decreasing" | "stable",
            "gti": GTI (%),
            "current_ratio": tỉ lệ current/capacity (%),
            "diff": GTI - current_ratio (%),
            "gti_state": kết quả classify_gti_state
        }
    """
    if capacity <= 0:
        return {
            "direction": "stable",
            "gti": 0.0,
            "current_ratio": 0.0,
            "diff": 0.0,
            "gti_state": "free_flow",
        }

    gti_result = calculate_gti(forecasts, capacity)
    gti = gti_result["gti"]
    current_ratio = round((current / capacity) * 100, 2)
    diff = round(gti - current_ratio, 2)

    if diff > threshold:
        direction = "increasing"
    elif diff < -threshold:
        direction = "decreasing"
    else:
        direction = "stable"

    logger.debug(
        f"GTI trend: current_ratio={current_ratio:.1f}%, gti={gti:.1f}%, "
        f"diff={diff:+.1f}% → {direction}"
    )

    return {
        "direction": direction,
        "gti": gti,
        "current_ratio": current_ratio,
        "diff": diff,
        "gti_state": classify_gti_state(gti),
    }
