import asyncio
import logging
import os
from datetime import datetime

import aiohttp
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from monitor_performance import monitor_performance
from query import (
    forecast_and_save_to_db,
    query_from_db_realtime,
    sync_actual_values,
    get_camera_capacity_map,
)

load_dotenv()

FIWARE_ORION_BASE = os.getenv("FIWARE_ORION_BASE")
FIWARE_ORION_URL = f"http://{FIWARE_ORION_BASE}/v2/entities"

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def calculate_los_status(volume: float, capacity: float) -> str:
    """
    Tính toán Level of Service (LOS) dựa trên tỉ lệ Volume/Capacity
    Args:
        volume: Số lượng phương tiện (vehicles/5min)
        capacity: Năng lực đường đặc thù cho camera (vehicles/5min)
    Returns:
        Status string: "free_flow", "smooth", "moderate", "heavy", "congested"
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


def calculate_trend(current_val: float, predicted_val: float, threshold: float = 5.0) -> str:
    """
    Tính toán xu hướng giao thông dựa trên chênh lệch giữa hiện tại và dự đoán
    Args:
        current_val: Giá trị hiện tại
        predicted_val: Giá trị dự đoán
        threshold: Ngưỡng để xác định thay đổi đáng kể (vehicles)
    Returns:
        Trend string: "increasing", "decreasing", "stable"
    """
    diff = predicted_val - current_val

    if abs(diff) < threshold:
        return "stable"
    elif diff > 0:
        return "increasing"
    else:
        return "decreasing"


@monitor_performance
async def update_fiware(session, camera_id, total_objects, forecasts, capacity):
    """
    Cập nhật dự đoán lên FIWARE Orion Context Broker
    Args:
        session: aiohttp ClientSession instance
        camera_id: ID của camera
        total_objects: Số lượng phương tiện hiện tại
        forecasts: Dict chứa dự đoán cho các mốc thời gian (5m, 10m, 15m, 30m, 60m)
        capacity: Capacity đặc thù của camera (từ dữ liệu lịch sử)
    """
    entity_id = f"urn:ngsi-ld:Camera:{camera_id}"

    # Tính toán trạng thái giao thông theo Level of Service (LOS)
    current_val = total_objects
    next_val = forecasts.get("5m", 0)

    status = calculate_los_status(next_val, capacity)
    trend = calculate_trend(current_val, next_val)

    # Payload linh hoạt theo dữ liệu truyền vào
    payload = {
        "id": entity_id,
        "type": "Camera",
        "prediction": {
            "type": "StructuredValue",
            "value": {
                "forecasts": {
                    "5m": forecasts.get("5m"),
                    "10m": forecasts.get("10m"),
                    "15m": forecasts.get("15m"),
                    "30m": forecasts.get("30m"),
                    "60m": forecasts.get("60m"),
                },
                "status": status,
                "trend": trend,
            },
        },
        "last_predicted": {"type": "DateTime", "value": datetime.now().isoformat()},
    }

    headers = {
        "Content-Type": "application/json",
        "fiware-service": "traffic_monitor",
        "fiware-servicepath": "/",
    }

    try:
        # Sử dụng session truyền vào thay vì khởi tạo mới trong mỗi lần lặp
        url = f"{FIWARE_ORION_URL}?options=upsert"
        async with session.post(url, json=payload, headers=headers, timeout=5) as resp:
            if resp.status in [201, 204]:
                logger.info(f"[{camera_id}] FIWARE Update OK")
            else:
                error_text = await resp.text()
                logger.error(f"FIWARE Error: {resp.status} - {error_text}")
    except Exception as e:
        logger.error(f"Lỗi kết nối FIWARE cho camera {camera_id}: {e}")


@monitor_performance
def predict_realtime(current_data_from_db):
    """
    Dự đoán lưu lượng giao thông cho tất cả cameras dựa trên dữ liệu hiện tại
    Args:
        current_data_from_db: DataFrame chứa dữ liệu realtime với LAG features
    Returns:
        DataFrame chứa kết quả dự đoán hoặc empty DataFrame nếu lỗi
    """
    try:
        model = joblib.load("camera_rf_model.joblib")
        le = joblib.load("camera_label_encoder.joblib")
    except Exception as e:
        print(f"❌ Lỗi load model: {e}")
        return pd.DataFrame()

    features = [
        "camera_id",
        "hour",
        "minute",
        "day_of_week",
        "avg_objects",
        "lag_5m",
        "lag_10m",
        "lag_15m",
        "lag_30m",
        "lag_60m",
        "trend_5m",
        "trend_30m",
        "trend_60m",
    ]

    # 1. Tạo bản sao và lọc những camera AI đã học
    df = current_data_from_db.copy()
    df = df[df["camera_id"].isin(le.classes_)]

    # 2. Mã hóa ID và lọc bỏ dòng NULL (Vô cùng quan trọng)
    df["camera_id_encoded"] = le.transform(df["camera_id"])
    df_valid = df.dropna(subset=features).copy()

    if df_valid.empty:
        logger.info("⚠️ Không có đủ dữ liệu lag để dự đoán.")
        return pd.DataFrame()

    # 3. Chuẩn bị X_input đồng bộ với df_valid
    X_input = df_valid[features].copy()
    # Gán bản đã mã hóa cho model
    X_input["camera_id"] = df_valid["camera_id_encoded"]

    # 4. AI thực hiện "tiên tri"
    predictions = model.predict(X_input)
    # 5. Lưu vào Database (Sử dụng df_valid để có đủ camera_id gốc và time_bucket)
    forecast_and_save_to_db(
        predictions,
        df_valid,
    )

    result = df_valid.copy()
    result["pred_5m"] = np.round(predictions[:, 0], 1)
    result["pred_10m"] = np.round(predictions[:, 1], 1)
    result["pred_15m"] = np.round(predictions[:, 2], 1)
    result["pred_30m"] = np.round(predictions[:, 3], 1)
    result["pred_60m"] = np.round(predictions[:, 4], 1)

    return result


@monitor_performance
async def run_cycle():
    # Load camera capacity map động từ database (30 ngày, 95th percentile)
    capacity_map = get_camera_capacity_map(lookback_days=30, percentile=95)

    data = query_from_db_realtime()

    df_result = predict_realtime(data)
    if df_result is not None and not df_result.empty:
        async with aiohttp.ClientSession() as session:
            tasks = []
            for _, row in df_result.iterrows():
                camera_id = row["camera_id"]

                # Lấy capacity đặc thù cho camera, fallback về DEFAULT_CAPACITY
                camera_capacity = capacity_map.get(camera_id, DEFAULT_CAPACITY)

                # Chuẩn bị dictionary dự báo
                forecasts = {
                    "5m": row["pred_5m"],
                    "10m": row["pred_10m"],
                    "15m": row["pred_15m"],
                    "30m": row["pred_30m"],
                    "60m": row["pred_60m"],
                }

                tasks.append(
                    update_fiware(
                        session=session,
                        camera_id=camera_id,
                        total_objects=row["avg_objects"],
                        forecasts=forecasts,
                        capacity=camera_capacity,
                    )
                )

            # Thực thi gửi toàn bộ 20 camera cùng lúc
            if tasks:
                await asyncio.gather(*tasks)
    sync_actual_values()


# data = query_from_db_realtime()
# predicted = predict_realtime(data)
# print(predicted.head(n=20))
if __name__ == "__main__":
    try:
        asyncio.run(run_cycle())
    except Exception as e:
        logger.error(f"Lỗi thực thi chu kỳ: {e}")
