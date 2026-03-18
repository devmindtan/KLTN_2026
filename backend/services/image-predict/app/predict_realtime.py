from db_queries import (
    forecast_and_save_to_db,
    query_from_db_realtime,
    refresh_forecast_mv,
)
from shared.monitor_performance import monitor_performance
from shared.los_utils import (
    calculate_los_status,
    calculate_trend_by_gti,
    DEFAULT_CAPACITY,
    get_camera_capacity_map,
    get_capacity_from_mv,
)
import asyncio
import json
import logging
import os
import sys
import threading
import time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

import aiohttp
import gc
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

# ============================================================
# MODULE-LEVEL MODEL CACHE — tránh reload từ disk mỗi chu kỳ
# ============================================================
_models_cache: dict = {}       # key: horizon ("5m".."60m") → sklearn model
_encoder_cache = None           # LabelEncoder
_cache_lock = threading.RLock()  # thread-safe giữa scheduler và reload endpoint

# Map model_type (DB) → horizon key
_MODEL_TYPE_TO_HORIZON = {
    "random_forest_5m":  "5m",
    "random_forest_10m": "10m",
    "random_forest_15m": "15m",
    "random_forest_30m": "30m",
    "random_forest_60m": "60m",
}

# Map horizon → local filename
_HORIZON_TO_FILE = {
    "5m":  "models/camera_rf_model_5m.joblib",
    "10m": "models/camera_rf_model_10m.joblib",
    "15m": "models/camera_rf_model_15m.joblib",
    "30m": "models/camera_rf_model_30m.joblib",
    "60m": "models/camera_rf_model_60m.joblib",
    "encoder": "models/camera_label_encoder.joblib",
}


def load_models_into_cache() -> bool:
    """
    Nạp toàn bộ 5 RF models + encoder vào module-level cache.
    Gọi 1 lần khi container start — sau đó dùng cache thay vì đọc disk mỗi 5 phút.
    Returns:
        bool: True nếu load thành công tất cả models
    """
    global _models_cache, _encoder_cache
    try:
        new_models = {
            horizon: joblib.load(path)
            for horizon, path in _HORIZON_TO_FILE.items()
            if horizon != "encoder"
        }
        new_encoder = joblib.load(_HORIZON_TO_FILE["encoder"])

        with _cache_lock:
            old_models = _models_cache
            _models_cache = new_models
            _encoder_cache = new_encoder

        # Giải phóng objects cũ ngay lập tức
        del old_models
        gc.collect()

        logger.info("✅ Model cache loaded: 5 RF models + encoder")
        return True
    except Exception as e:
        logger.error(f"❌ Lỗi load models vào cache: {e}")
        return False


def refresh_cache_for_model_type(model_type: str) -> bool:
    """
    Reload 1 model cụ thể vào cache sau khi /reload endpoint cập nhật file trên disk.
    Args:
        model_type: DB model_type, vd 'random_forest_5m'
    Returns:
        bool: True nếu cập nhật cache thành công
    """
    global _models_cache
    horizon = _MODEL_TYPE_TO_HORIZON.get(model_type)
    if horizon is None:
        logger.error(f"[CacheRefresh] Không tìm thấy horizon cho model_type='{model_type}'")
        return False

    file_path = _HORIZON_TO_FILE[horizon]
    try:
        new_model = joblib.load(file_path)
        with _cache_lock:
            old_model = _models_cache.get(horizon)
            _models_cache[horizon] = new_model

        del old_model
        gc.collect()

        file_size_kb = os.path.getsize(file_path) / 1024
        logger.info(f"✅ [CacheRefresh] Cache updated: {horizon} ({file_size_kb:.1f} KB)")
        return True
    except Exception as e:
        logger.error(f"❌ [CacheRefresh] Lỗi refresh cache cho {horizon}: {e}")
        return False


def ensure_models_ready():
    """
    Kiểm tra và download models từ MinIO nếu chưa có local.
    - RF models (5m-60m): tải đúng phiên bản is_active=TRUE từ DB
    - Encoder: tải latest từ MinIO (không có is_active trong DB)
    Chạy 1 lần khi container start để đảm bảo models sẵn sàng trước khi scheduler bắt đầu.
    Returns:
        bool: True nếu models đã sẵn sàng, False nếu có lỗi
    """
    model_dir = "models"
    os.makedirs(model_dir, exist_ok=True)

    # Map filename → short type
    model_map = {
        "camera_rf_model_5m.joblib":  "5m",
        "camera_rf_model_10m.joblib": "10m",
        "camera_rf_model_15m.joblib": "15m",
        "camera_rf_model_30m.joblib": "30m",
        "camera_rf_model_60m.joblib": "60m",
        "camera_label_encoder.joblib": "encoder",
    }

    # Map short type → DB model_type (chỉ RF models có is_active trong DB)
    SHORT_TO_MODEL_TYPE = {
        "5m":  "random_forest_5m",
        "10m": "random_forest_10m",
        "15m": "random_forest_15m",
        "30m": "random_forest_30m",
        "60m": "random_forest_60m",
    }

    # Map short type → local filename
    SHORT_TO_FILENAME = {
        "5m":  "camera_rf_model_5m.joblib",
        "10m": "camera_rf_model_10m.joblib",
        "15m": "camera_rf_model_15m.joblib",
        "30m": "camera_rf_model_30m.joblib",
        "60m": "camera_rf_model_60m.joblib",
    }

    # Kiểm tra từng model file
    existing_models = []
    missing_models = []

    for filename, model_type in model_map.items():
        file_path = os.path.join(model_dir, filename)
        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path) / 1024  # KB
            existing_models.append(f"{model_type} ({file_size:.1f}KB)")
        else:
            missing_models.append(model_type)

    # Log trạng thái hiện tại
    logger.info("📦 Models status:")
    if existing_models:
        logger.info(f"   ✅ Existing: {', '.join(existing_models)}")
    if missing_models:
        logger.info(f"   ⚠️  Missing: {', '.join(missing_models)}")

    if not missing_models:
        logger.info("✅ All models ready (6/6)")
        return True

    # Chia thành RF models (tải theo is_active=TRUE từ DB) và encoder (tải latest)
    missing_rf = [t for t in missing_models if t != "encoder"]
    need_encoder = "encoder" in missing_models

    # --- Download RF models theo is_active=TRUE ---
    if missing_rf:
        logger.info(f"📥 Downloading {len(missing_rf)} RF models by is_active=TRUE from DB...")
        from reload_model import get_active_model_info
        from shared.minio_client import MinIOModelClient

        client = MinIOModelClient(bucket_name="ml-models")

        for short_type in missing_rf:
            db_model_type = SHORT_TO_MODEL_TYPE[short_type]
            model_info = get_active_model_info(db_model_type)

            if model_info is None:
                # Fallback: tải latest nếu chưa có bản nào is_active (lần deploy đầu tiên)
                logger.warning(
                    f"⚠️  Không tìm thấy is_active=TRUE cho {db_model_type}, "
                    "fallback về latest từ MinIO..."
                )
                from download_model import download_random_forest_models
                if not download_random_forest_models(output_dir=model_dir, required_types=[short_type]):
                    logger.error(f"❌ Không thể tải model {short_type}")
                    return False
            else:
                minio_key = model_info["minio_key"]
                model_version = model_info["model_version"]
                local_path = os.path.join(model_dir, SHORT_TO_FILENAME[short_type])
                logger.info(f"   📥 {short_type}: {minio_key} (version={model_version})")

                if not client.download_model(minio_key, local_path):
                    logger.error(f"❌ Không thể tải {short_type} từ {minio_key}")
                    return False

                file_size = os.path.getsize(local_path) / 1024
                logger.info(f"      ✅ {file_size:.1f} KB")

    # --- Download encoder theo latest (encoder không có is_active trong DB) ---
    if need_encoder:
        logger.info("📥 Downloading encoder (latest from MinIO)...")
        from download_model import download_random_forest_models
        if not download_random_forest_models(output_dir=model_dir, required_types=["encoder"]):
            logger.error("❌ Không thể tải encoder")
            return False

    logger.info("✅ Đã tải thành công tất cả models từ MinIO")
    return True


# calculate_trend() cũ đã được thay thế bởi calculate_trend_by_gti() từ shared/los_utils.py
# Hàm mới dùng GTI (General Trend Index) tổng hợp 5 mốc dự đoán thay vì chỉ so sánh 5m


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

    # ── LOS: dùng dự đoán 5m để tính trạng thái ngay kế tiếp ──────────────────
    next_val = forecasts.get("5m", 0)
    status_forecast = calculate_los_status(next_val, capacity)
    vc_ratio = round(next_val / capacity, 4) if capacity > 0 else 0

    # ── GTI: tổng hợp xu hướng từ TẤT CẢ 5 mốc dự đoán ──────────────────────
    # Trả về dict: direction, gti, current_ratio, diff, gti_state
    gti_info = calculate_trend_by_gti(
        current=total_objects,
        capacity=capacity,
        forecasts=forecasts,
        threshold=5.0,
    )

    # Payload linh hoạt theo dữ liệu truyền vào
    payload = {
        "id": entity_id,
        "type": "Camera",
        "prediction": {
            "type": "StructuredValue",
            "value": {
                "input_value": round(float(total_objects), 1),  # Giá trị trung bình 5p dùng làm input cho model
                "forecasts": {
                    "5m": forecasts.get("5m"),
                    "10m": forecasts.get("10m"),
                    "15m": forecasts.get("15m"),
                    "30m": forecasts.get("30m"),
                    "60m": forecasts.get("60m"),
                },
                "status": {
                    "forecast": status_forecast,  # Trạng thái LOS dự báo 5 phút sau
                    "calculation": {
                        "predicted_volume": round(next_val, 1),  # Giá trị dự đoán 5p
                        "capacity": capacity,                     # Capacity camera (MAX 7 ngày) – KHÔNG làm tròn
                        "vc_ratio": vc_ratio,                     # Tỉ lệ Volume/Capacity
                    },
                },
                # GTI-based trend: với đầy đủ metrics tổng hợp từ 5 mốc (5m→60m)
                "trend": {
                    "direction": gti_info["direction"],       # increasing | decreasing | stable
                    "gti_state": gti_info["gti_state"],       # free_flow | normal | congestion_start | congestion_risk
                    "gti": gti_info["gti"],                   # GTI (%) = Σ(P_i×w_i)/Max×100
                    "current_ratio": gti_info["current_ratio"], # current/capacity×100 (%)
                    "diff": gti_info["diff"],                 # GTI - current_ratio (%)
                },
            },
        },
        "last_predicted": {"type": "DateTime", "value": datetime.utcnow().isoformat()},
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


async def push_forecast_ready(session, camera_count: int):
    """
    Upsert entity ForecastReady lên FIWARE Orion để trigger subscription → app-route webhook
    → socket.io emit FORECAST_UPDATED → frontend chart re-fetch dữ liệu mới.
    Gọi một lần sau khi tất cả camera predictions đã được push xong.
    """
    payload = {
        "id": "urn:ngsi-ld:ForecastReady:signal",
        "type": "ForecastReady",
        "triggered_at": {
            "type": "DateTime",
            "value": datetime.utcnow().isoformat(),
        },
        "cycle_cameras": {
            "type": "Integer",
            "value": camera_count,
        },
    }
    headers = {
        "Content-Type": "application/json",
        "fiware-service": "traffic_monitor",
        "fiware-servicepath": "/",
    }
    try:
        url = f"{FIWARE_ORION_URL}?options=upsert"
        async with session.post(url, json=payload, headers=headers, timeout=5) as resp:
            if resp.status in [201, 204]:
                logger.info(f"[ForecastReady] FIWARE Upsert OK – {camera_count} cameras")
            else:
                error_text = await resp.text()
                logger.error(f"[ForecastReady] FIWARE Error: {resp.status} - {error_text}")
    except Exception as e:
        logger.error(f"[ForecastReady] Lỗi kết nối FIWARE: {e}")


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
    # Sử dụng module-level cache — tránh reload từ disk mỗi chu kỳ
    with _cache_lock:
        models = dict(_models_cache)     # shallow copy để tránh race condition
        le = _encoder_cache

    if not models or le is None:
        logger.error("❌ Model cache chưa sẵn sàng. Thử load lại...")
        if not load_models_into_cache():
            return pd.DataFrame()
        with _cache_lock:
            models = dict(_models_cache)
            le = _encoder_cache

    logger.info("✅ Sử dụng 5 models từ cache (không reload disk)")

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

    # 6. Align predictions về df_valid theo camera_id để tránh mismatch khi horizons
    # có số lượng valid rows khác nhau (do các horizon cần lag features khác nhau)
    for horizon, features in horizon_features.items():
        df_horizon = df.dropna(subset=features).copy()
        if len(predictions[horizon]) > 0:
            pred_map = dict(zip(df_horizon["camera_id"], predictions[horizon]))
            df_valid[f"_pred_{horizon}"] = df_valid["camera_id"].map(pred_map)
        else:
            df_valid[f"_pred_{horizon}"] = np.nan

    y_preds = np.column_stack([
        df_valid["_pred_5m"].fillna(0).values,
        df_valid["_pred_10m"].fillna(0).values,
        df_valid["_pred_15m"].fillna(0).values,
        df_valid["_pred_30m"].fillna(0).values,
        df_valid["_pred_60m"].fillna(0).values,
    ])

    # Cleanup temp columns
    df_valid.drop(columns=[f"_pred_{h}" for h in horizon_features], inplace=True)

    # 7. Lưu vào Database
    forecast_and_save_to_db(y_preds, df_valid)

    # 7b. Refresh MV ngay sau khi lưu → reduce delay từ 6 phút (CronJob) xuống ~0
    refresh_forecast_mv()

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
    # Đọc capacity từ Materialized View mv_forecast_capacity
    # MV được refresh định kỳ bởi CronJob — không cần tính lại mỗi 5 phút
    capacity_map = get_capacity_from_mv()

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
                # Notify frontend: chu kỳ forecast xong → chart re-fetch
                await push_forecast_ready(session, camera_count=len(tasks))

    # Note: sync_actual_values() được chạy riêng biệt bởi sync_actual.py
    # với schedule offset 2-3 phút sau prediction để đảm bảo data đủ


def calculate_next_run_time():
    """
    Tính thời gian đến phút tiếp theo chia hết cho 5
    Returns:
        datetime: Thời điểm chạy tiếp theo (UTC, second=0, microsecond=0)
    """
    now = datetime.now(timezone.utc)
    current_minute = now.minute
    
    # Tìm phút tiếp theo chia hết cho 5
    next_minute = ((current_minute // 5) + 1) * 5
    
    if next_minute >= 60:
        # Sang giờ tiếp theo
        next_minute = 0
        next_run = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    else:
        next_run = now.replace(minute=next_minute, second=0, microsecond=0)
    
    return next_run


# ============================================================
# RELOAD HTTP SERVER
# ============================================================
class ReloadHandler(BaseHTTPRequestHandler):
    """
    HTTP handler cho endpoint POST /reload.
    Nhận trigger từ backend server sau khi activate model mới,
    chạy reload trong background thread để không block HTTP response.
    """

    def do_OPTIONS(self):
        # Trả 405 thay vì 501 để rõ ràng hơn; OPTIONS không thuộc về service này
        self.send_response(405)
        self.send_header("Allow", "POST")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self._send(405, {"error": "Method not allowed. Only POST /reload is supported."})

    def do_POST(self):
        if self.path != "/reload":
            self._send(404, {"error": "Not found"})
            return

        content_len = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_len) if content_len > 0 else b"{}"
        try:
            body = json.loads(raw)
        except Exception:
            self._send(400, {"error": "Invalid JSON"})
            return

        model_type = body.get("model_type", "")
        if not model_type:
            self._send(400, {"error": "model_type required"})
            return

        # Chạy reload trong background thread để không block response
        def _run():
            from reload_model import reload_active_model
            success = reload_active_model(model_type)
            if success:
                # Cập nhật in-memory cache ngay sau khi file disk đã được update
                refresh_cache_for_model_type(model_type)

        threading.Thread(target=_run, daemon=True).start()
        self._send(202, {"status": "accepted", "model_type": model_type})

    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):  # noqa: A002
        logger.info(f"[ReloadServer] {format % args}")


def start_reload_server(port: int = 8080):
    """
    Khởi động HTTP server lắng nghe POST /reload trên port 8080.
    Chạy trong daemon thread riêng — không ảnh hưởng scheduler chính.
    SO_REUSEADDR bật để tránh "Address already in use" khi restart nhanh.
    """
    try:
        HTTPServer.allow_reuse_address = True
        server = HTTPServer(("0.0.0.0", port), ReloadHandler)
        logger.info(f"🔌 Reload server listening on port {port}")
        server.serve_forever()
    except OSError as e:
        logger.warning(f"⚠️ Reload server không thể bind port {port}: {e}. Scheduler vẫn chạy bình thường.")



def run_scheduler():
    """
    Chạy prediction loop mỗi 5 phút tại các phút chia hết cho 5 (0, 5, 10, 15...)
    - Không bị ảnh hưởng bởi thời gian thực thi task trước
    - Sleep đúng thời gian đến phút schedule tiếp theo
    """
    logger.info("🚀 Image-predict scheduler started (runs at :00, :05, :10, :15...)")
    
    while True:
        try:
            # Tính thời gian chạy lần tiếp theo
            next_run = calculate_next_run_time()
            now = datetime.now(timezone.utc)
            sleep_seconds = (next_run - now).total_seconds()
            
            logger.info(f"⏰ Next prediction at {next_run.strftime('%H:%M:%S')} UTC (sleep {sleep_seconds:.1f}s)")
            time.sleep(sleep_seconds)
            
            # Chạy prediction cycle
            logger.info(f"▶️ Starting prediction cycle at {datetime.now(timezone.utc).strftime('%H:%M:%S')} UTC")
            asyncio.run(run_cycle())
            logger.info("✅ Prediction cycle completed")
            
        except KeyboardInterrupt:
            logger.info("⚠️  Scheduler interrupted by user")
            break
        except Exception as e:
            logger.error(f"❌ Error in scheduler loop: {e}")
            # Sleep 1 phút nếu có lỗi trước khi retry
            logger.info("Sleeping 60s before retry...")
            time.sleep(60)


# data = query_from_db_realtime()
# predicted = predict_realtime(data)
# print(predicted.head(n=20))
if __name__ == "__main__":
    try:
        # 1. Kiểm tra và download models TRƯỚC khi start scheduler
        logger.info("🔍 Checking models availability...")
        if not ensure_models_ready():
            logger.error("❌ Failed to prepare models. Exiting...")
            sys.exit(1)

        # 2. Khởi động HTTP reload server trong daemon thread
        reload_port = int(os.getenv("RELOAD_SERVER_PORT", 8080))
        threading.Thread(target=start_reload_server, args=(reload_port,), daemon=True).start()

        # 3. Nạp models vào cache trước khi chạy scheduler
        logger.info("🧠 Loading models into memory cache...")
        if not load_models_into_cache():
            logger.error("❌ Không thể nạp models vào cache. Exiting...")
            sys.exit(1)

        # 4. Chạy scheduler loop
        run_scheduler()
    except Exception as e:
        logger.error(f"Lỗi thực thi scheduler: {e}.")
        sys.exit(1)

