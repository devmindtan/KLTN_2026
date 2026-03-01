"""
reload_model.py — Tải lại RF models từ MinIO theo model is_active=TRUE trong DB.
Được trigger qua POST /reload từ backend server sau khi activate model mới.
Cập nhật tiến trình qua FIWARE entity 'ModelReload' để frontend track realtime.
"""
import logging
import os
import sys
from datetime import datetime

import requests
from sqlalchemy import text

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))

from db_queries import engine  # noqa: E402
from shared.minio_client import MinIOModelClient  # noqa: E402
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================
# FIWARE CONFIG
# ============================================================
FIWARE_ORION_BASE = os.getenv("FIWARE_ORION_BASE")
FIWARE_ORION_URL = f"http://{FIWARE_ORION_BASE}/v2/entities"
FIWARE_HEADERS = {
    "Content-Type": "application/json",
    "fiware-service": "traffic_monitor",
    "fiware-servicepath": "/",
}
RELOAD_ENTITY_ID = "urn:ngsi-ld:ModelReload:latest"

# Model type → local filename mapping
MODEL_TYPE_FILE_MAP = {
    "random_forest_5m":  "camera_rf_model_5m.joblib",
    "random_forest_10m": "camera_rf_model_10m.joblib",
    "random_forest_15m": "camera_rf_model_15m.joblib",
    "random_forest_30m": "camera_rf_model_30m.joblib",
    "random_forest_60m": "camera_rf_model_60m.joblib",
}


def update_fiware_reload(
    reload_id: str,
    model_type: str,
    status: str,
    progress_pct: int,
    current_stage: str,
    model_version: str = "",
    started_at: str = None,
    finished_at: str = None,
    error_message: str = None,
):
    """
    Upsert entity ModelReload vào FIWARE Orion.
    Frontend lắng nghe MODEL_RELOAD_UPDATED qua WebSocket.
    """
    payload = {
        "id": RELOAD_ENTITY_ID,
        "type": "ModelReload",
        "reload_id":     {"type": "Text",   "value": reload_id},
        "model_type":    {"type": "Text",   "value": model_type},
        "status":        {"type": "Text",   "value": status},
        "progress_pct":  {"type": "Number", "value": progress_pct},
        "current_stage": {"type": "Text",   "value": current_stage},
        "model_version": {"type": "Text",   "value": model_version},
        "started_at":    {"type": "Text",   "value": started_at or datetime.utcnow().isoformat()},
        "finished_at":   {"type": "Text",   "value": finished_at or ""},
        "error_message": {"type": "Text",   "value": error_message or ""},
    }
    try:
        url = f"{FIWARE_ORION_URL}?options=upsert"
        resp = requests.post(url, json=payload, headers=FIWARE_HEADERS, timeout=5)
        logger.info(f"[ModelReload] FIWARE [{status} {progress_pct}%] → {resp.status_code}")
    except Exception as e:
        logger.warning(f"[ModelReload] FIWARE update failed (non-critical): {e}")


def get_active_model_info(model_type: str) -> dict | None:
    """
    Query DB lấy thông tin model is_active=TRUE của model_type chỉ định.
    Returns:
        dict với keys: id, model_version, minio_key, metrics
        None nếu không tìm thấy
    """
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT id, model_version, minio_key, metrics
                    FROM ml_model_metadata
                    WHERE model_type = :model_type AND is_active = TRUE
                    LIMIT 1
                """),
                {"model_type": model_type}
            ).fetchone()

        if row is None:
            return None
        return {
            "id": row[0],
            "model_version": row[1],
            "minio_key": row[2],
            "metrics": row[3],
        }
    except Exception as e:
        logger.error(f"[ModelReload] DB query failed: {e}")
        return None


def reload_active_model(model_type: str) -> bool:
    """
    Tải lại RF model của model_type theo is_active=TRUE từ MinIO về local disk.
    Cập nhật FIWARE entity ModelReload theo từng bước để frontend track realtime.

    Args:
        model_type: Loại model cần reload (vd: 'random_forest_5m')
    Returns:
        True nếu reload thành công
    """
    reload_id = f"reload_{model_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    started_at = datetime.utcnow().isoformat()

    logger.info(f"[ModelReload] === Bắt đầu reload {model_type} (id={reload_id}) ===")

    # Stage 1: Khởi động (10%)
    update_fiware_reload(
        reload_id=reload_id,
        model_type=model_type,
        status="running",
        progress_pct=10,
        current_stage="Đang truy vấn model đang kích hoạt...",
        started_at=started_at,
    )

    # Stage 2: Query DB lấy minio_key của model active (40%)
    model_info = get_active_model_info(model_type)
    if model_info is None:
        error_msg = f"Không tìm thấy model is_active=TRUE cho loại {model_type}"
        logger.error(f"[ModelReload] {error_msg}")
        update_fiware_reload(
            reload_id=reload_id,
            model_type=model_type,
            status="failed",
            progress_pct=0,
            current_stage="Thất bại",
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            error_message=error_msg,
        )
        return False

    minio_key = model_info["minio_key"]
    model_version = model_info["model_version"]
    logger.info(f"[ModelReload] Active model: version={model_version}, key={minio_key}")

    update_fiware_reload(
        reload_id=reload_id,
        model_type=model_type,
        status="running",
        progress_pct=40,
        current_stage=f"Đang tải model {model_version} từ MinIO...",
        model_version=model_version,
        started_at=started_at,
    )

    # Stage 3: Download từ MinIO (70%)
    if model_type not in MODEL_TYPE_FILE_MAP:
        error_msg = f"model_type không hợp lệ: {model_type}"
        update_fiware_reload(
            reload_id=reload_id,
            model_type=model_type,
            status="failed",
            progress_pct=0,
            current_stage="Thất bại",
            model_version=model_version,
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            error_message=error_msg,
        )
        return False

    local_filename = MODEL_TYPE_FILE_MAP[model_type]
    local_path = os.path.join("models", local_filename)

    try:
        minio_client = MinIOModelClient(bucket_name="ml-models")
        success = minio_client.download_model(minio_key, local_path)
        if not success:
            raise RuntimeError("MinIO download trả về False")
    except Exception as e:
        error_msg = f"Tải model từ MinIO thất bại: {e}"
        logger.error(f"[ModelReload] {error_msg}")
        update_fiware_reload(
            reload_id=reload_id,
            model_type=model_type,
            status="failed",
            progress_pct=0,
            current_stage="Thất bại",
            model_version=model_version,
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            error_message=error_msg,
        )
        return False

    update_fiware_reload(
        reload_id=reload_id,
        model_type=model_type,
        status="running",
        progress_pct=70,
        current_stage="Đang xác minh file model...",
        model_version=model_version,
        started_at=started_at,
    )

    # Stage 4: Xác minh file tồn tại và không rỗng (90%)
    if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
        error_msg = f"File model sau download không hợp lệ: {local_path}"
        logger.error(f"[ModelReload] {error_msg}")
        update_fiware_reload(
            reload_id=reload_id,
            model_type=model_type,
            status="failed",
            progress_pct=0,
            current_stage="Thất bại",
            model_version=model_version,
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            error_message=error_msg,
        )
        return False

    file_size_kb = os.path.getsize(local_path) / 1024
    logger.info(f"[ModelReload] ✅ File verified: {local_path} ({file_size_kb:.1f} KB)")

    update_fiware_reload(
        reload_id=reload_id,
        model_type=model_type,
        status="running",
        progress_pct=90,
        current_stage="Hoàn tất — model sẽ được dùng ở chu kỳ dự báo tiếp theo",
        model_version=model_version,
        started_at=started_at,
    )

    import time
    time.sleep(1.5)  # Đảm bảo FIWARE throttling (1s) không suppress 100%

    # Stage 5: Hoàn thành (100%)
    finished_at = datetime.utcnow().isoformat()
    update_fiware_reload(
        reload_id=reload_id,
        model_type=model_type,
        status="succeeded",
        progress_pct=100,
        current_stage="Đã tải model mới. Dự báo tiếp theo sẽ dùng model này.",
        model_version=model_version,
        started_at=started_at,
        finished_at=finished_at,
    )

    logger.info(f"[ModelReload] === Hoàn thành reload {model_type} version={model_version} ===")
    return True
