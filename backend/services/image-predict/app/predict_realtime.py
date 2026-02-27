from query import (
    forecast_and_save_to_db,
    query_from_db_realtime,
)
from shared.monitor_performance import monitor_performance
from shared.los_utils import (
    calculate_los_status,
    DEFAULT_CAPACITY,
    get_camera_capacity_map,
)
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

import aiohttp
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Import shared utilities
sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


load_dotenv()

FIWARE_ORION_BASE = os.getenv("FIWARE_ORION_BASE")
FIWARE_ORION_URL = f"http://{FIWARE_ORION_BASE}/v2/entities"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def calculate_trend(current_val: float, predicted_val: float, threshold_percent: float = 10.0) -> str:
    """
    Tính toán xu hướng giao thông dựa trên % thay đổi giữa hiện tại và dự đoán
    Args:
        current_val: Giá trị hiện tại
        predicted_val: Giá trị dự đoán
        threshold_percent: Ngưỡng % để xác định thay đổi đáng kể (default 10%)
    Returns:
        Trend string: "increasing", "decreasing", "stable"
    """
    # Tránh chia cho 0, nếu current_val = 0 thì dùng giá trị tuyệt đối
    if current_val == 0:
        return "increasing" if predicted_val > 0 else "stable"

    # Tính % thay đổi
    percent_change = ((predicted_val - current_val) / current_val) * 100

    # Log để debug (comment sau khi xác minh)
    logger.debug(
        f"Trend calc: current={current_val:.1f}, pred={predicted_val:.1f}, change={percent_change:.1f}%")

    if abs(percent_change) < threshold_percent:
        return "stable"
    elif percent_change > 0:
        return "increasing"
    else:
        return "decreasing"


@monitor_performance
async def update_fiware(session, camera_id, total_objects, forecasts, capacity):
    """
    Cập nhật dự đoán lên FIWARE Orion Context Broker
    Tính status_forecast dựa trên dự đoán 5 phút sau (thể hiện xu hướng tương lai)
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

    # Dùng giá trị DỰ ĐOÁN 5 phút sau để tính status_forecast (thể hiện xu hướng tương lai)
    status_forecast = calculate_los_status(next_val, capacity)
    trend = calculate_trend(current_val, next_val)

    # Tính tỉ lệ Volume/Capacity
    vc_ratio = round(next_val / capacity, 2) if capacity > 0 else 0

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
                "status": {
                    "forecast": status_forecast,  # Trạng thái dự báo 5 phút sau
                    "calculation": {
                        # Giá trị dự đoán 5p
                        "predicted_volume": round(next_val, 1),
                        # Capacity của camera (MAX 7 ngày)
                        "capacity": round(capacity, 1),
                        "vc_ratio": vc_ratio,  # Tỉ lệ Volume/Capacity
                    }
                },
                "trend": trend,
            },
        },
        "last_predicted": {"type": "DateTime", "value": datetime.now(timezone.utc).isoformat()},
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
    Sử dụng 5 models riêng biệt cho từng horizon để tối ưu độ chính xác
    Args:
        current_data_from_db: DataFrame chứa dữ liệu realtime với LAG features
    Returns:
        DataFrame chứa kết quả dự đoán hoặc empty DataFrame nếu lỗi
    """
    try:
        # Load 5 models riêng biệt
        models = {
            "5m": joblib.load("models/camera_rf_model_5m.joblib"),
            "10m": joblib.load("models/camera_rf_model_10m.joblib"),
            "15m": joblib.load("models/camera_rf_model_15m.joblib"),
            "30m": joblib.load("models/camera_rf_model_30m.joblib"),
            "60m": joblib.load("models/camera_rf_model_60m.joblib"),
        }
        le = joblib.load("models/camera_label_encoder.joblib")
        logger.info("✅ Đã load 5 models riêng biệt cho từng horizon")
    except Exception as e:
        logger.error(f"❌ Lỗi load models: {e}")
        return pd.DataFrame()

    # Features configuration cho từng horizon (khớp với train.py)
    horizon_features = {
        "5m": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
               "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
        "10m": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
        "15m": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                "lag_10m", "lag_15m", "lag_30m", "trend_5m", "trend_30m"],
        "30m": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                "lag_15m", "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
        "60m": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
    }

    # 1. Tạo bản sao và lọc những camera AI đã học
    df = current_data_from_db.copy()
    df = df[df["camera_id"].isin(le.classes_)]

    # 2. Mã hóa ID
    df["camera_id_encoded"] = le.transform(df["camera_id"])

    # 3. Predict cho từng horizon riêng biệt
    predictions = {}

    for horizon, features in horizon_features.items():
        # Drop NaN cho features của horizon này
        df_valid = df.dropna(subset=features).copy()

        if df_valid.empty:
            logger.warning(f"⚠️ Horizon {horizon}: Không có đủ dữ liệu lag")
            predictions[horizon] = np.array([])
            continue

        # Chuẩn bị X_input
        X_input = df_valid[features].copy()
        X_input["camera_id"] = df_valid["camera_id_encoded"]

        # Predict với model tương ứng
        pred = models[horizon].predict(X_input)
        predictions[horizon] = pred

        logger.debug(f"   {horizon}: Predicted {len(pred)} cameras")

    # 4. Kiểm tra xem có prediction nào không
    if all(len(p) == 0 for p in predictions.values()):
        logger.info("⚠️ Không có đủ dữ liệu lag để dự đoán.")
        return pd.DataFrame()

    # 5. Lấy df_valid từ horizon có nhiều data nhất (thường là 5m hoặc 10m)
    # để làm base cho output
    base_horizon = max(predictions.items(), key=lambda x: len(x[1]))[0]
    df_valid = df.dropna(subset=horizon_features[base_horizon]).copy()

    # 6. Tạo matrix predictions (cameras × horizons)
    y_preds = np.column_stack([
        predictions.get("5m", np.full(len(df_valid), np.nan)),
        predictions.get("10m", np.full(len(df_valid), np.nan)),
        predictions.get("15m", np.full(len(df_valid), np.nan)),
        predictions.get("30m", np.full(len(df_valid), np.nan)),
        predictions.get("60m", np.full(len(df_valid), np.nan)),
    ])

    # 7. Lưu vào Database
    forecast_and_save_to_db(y_preds, df_valid)

    # 8. Tạo result DataFrame
    result = df_valid.copy()
    result["pred_5m"] = np.round(y_preds[:, 0], 1)
    result["pred_10m"] = np.round(y_preds[:, 1], 1)
    result["pred_15m"] = np.round(y_preds[:, 2], 1)
    result["pred_30m"] = np.round(y_preds[:, 3], 1)
    result["pred_60m"] = np.round(y_preds[:, 4], 1)

    return result


@monitor_performance
async def run_cycle():
    # Load camera capacity map động từ database (7 ngày, giá trị MAX)
    # Lấy giá trị trung bình 5p LỚN NHẤT trong 7 ngày qua làm capacity
    capacity_map = get_camera_capacity_map(lookback_days=7)

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

    # Note: sync_actual_values() được chạy riêng biệt bởi sync_actual.py
    # với schedule offset 2-3 phút sau prediction để đảm bảo data đủ


# data = query_from_db_realtime()
# predicted = predict_realtime(data)
# print(predicted.head(n=20))
if __name__ == "__main__":
    try:
        asyncio.run(run_cycle())
    except Exception as e:
        logger.error(f"Lỗi thực thi chu kỳ: {e}")
