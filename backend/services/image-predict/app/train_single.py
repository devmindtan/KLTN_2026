#!/usr/bin/env python3
"""
train_single.py - Huấn luyện MỘT phiên bản model RF mới theo yêu cầu từ UI.

Khác với train.py (train tất cả 5 horizons đồng thời, mặc định is_active=True),
script này:
- Chỉ train 1 horizon cụ thể (chỉ định qua --model_type)
- Lưu metadata với is_active=FALSE (user tự kích hoạt sau khi xem xét metrics)
- Cập nhật tiến trình vào FIWARE entity TrainingJob để frontend theo dõi realtime

CLI: python train_single.py --model_type random_forest_5m
                            --start_date 2026-01-01
                            --end_date 2026-02-28
                            --job_id train_rf_5m_20260228_120000
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

import joblib
import requests
from psycopg2.pool import ThreadedConnectionPool
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# Append shared path trước khi import local modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from db_queries import query_from_db_total          # noqa: E402
from shared.minio_client import MinIOModelClient    # noqa: E402
from shared.model_metadata_db import ModelMetadataDB  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
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
ENTITY_ID = "urn:ngsi-ld:TrainingJob:latest"

# ============================================================
# MODEL TYPE → HORIZON MAPPING
# ============================================================
HORIZON_MAP = {
    "random_forest_5m":  "5m",
    "random_forest_10m": "10m",
    "random_forest_15m": "15m",
    "random_forest_30m": "30m",
    "random_forest_60m": "60m",
}

# Feature configs khớp chính xác với train.py
HORIZON_CONFIGS = {
    "5m": {
        "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                     "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
        "target": "target_5m",
    },
    "10m": {
        "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                     "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
        "target": "target_10m",
    },
    "15m": {
        "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                     "lag_10m", "lag_15m", "lag_30m", "trend_5m", "trend_30m"],
        "target": "target_15m",
    },
    "30m": {
        "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                     "lag_15m", "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
        "target": "target_30m",
    },
    "60m": {
        "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                     "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
        "target": "target_60m",
    },
}


# ============================================================
# FIWARE HELPER
# ============================================================
def update_fiware(
    job_id: str,
    model_type: str,
    status: str,
    progress_pct: int,
    current_stage: str,
    start_date: str,
    end_date: str,
    total_samples: int = 0,
    started_at: str = None,
    finished_at: str = None,
    error_message: str = None,
    result_metrics: dict = None,
):
    """
    Upsert entity TrainingJob vào FIWARE Orion.
    Được gọi tại mỗi mốc tiến trình để frontend có thể track realtime qua WebSocket.
    """
    payload = {
        "id": ENTITY_ID,
        "type": "TrainingJob",
        "job_id":        {"type": "Text",            "value": job_id},
        "model_type":    {"type": "Text",            "value": model_type},
        "status":        {"type": "Text",            "value": status},
        "progress_pct":  {"type": "Number",          "value": progress_pct},
        "current_stage": {"type": "Text",            "value": current_stage},
        "start_date":    {"type": "Text",            "value": start_date},
        "end_date":      {"type": "Text",            "value": end_date},
        "total_samples": {"type": "Number",          "value": total_samples},
        "started_at":    {"type": "Text",            "value": started_at or datetime.utcnow().isoformat()},
        "finished_at":   {"type": "Text",            "value": finished_at or ""},
        "error_message": {"type": "Text",            "value": error_message or ""},
        "result_metrics": {"type": "StructuredValue", "value": result_metrics or {}},
    }
    try:
        url = f"{FIWARE_ORION_URL}?options=upsert"
        resp = requests.post(url, json=payload, headers=FIWARE_HEADERS, timeout=5)
        logger.info(f"FIWARE [{status} {progress_pct}%] → {resp.status_code}")
    except Exception as e:
        logger.warning(f"FIWARE update non-critical failure: {e}")


# ============================================================
# MAIN
# ============================================================
def main():
    """
    Entry point: nhận args từ CLI (hoặc k8s Job command), train 1 horizon, cập nhật FIWARE.
    """
    parser = argparse.ArgumentParser(description="Huấn luyện một phiên bản RF model mới")
    parser.add_argument("--model_type",  required=True,  help="Loại model (vd: random_forest_5m)")
    parser.add_argument("--start_date",  required=True,  help="Ngày bắt đầu dữ liệu (YYYY-MM-DD)")
    parser.add_argument("--end_date",    required=True,  help="Ngày kết thúc dữ liệu (YYYY-MM-DD)")
    parser.add_argument("--job_id",      required=True,  help="ID unique của job (vd: train_rf_5m_20260228)")
    args = parser.parse_args()

    model_type = args.model_type
    start_date = args.start_date
    end_date   = args.end_date
    job_id     = args.job_id

    if model_type not in HORIZON_MAP:
        logger.error(f"❌ model_type không hợp lệ: {model_type}. Chọn từ: {list(HORIZON_MAP.keys())}")
        sys.exit(1)

    horizon = HORIZON_MAP[model_type]
    config  = HORIZON_CONFIGS[horizon]
    started_at = datetime.utcnow().isoformat()
    training_start_time = datetime.now()

    logger.info(f"{'='*60}")
    logger.info(f"🚀 Training {model_type} | {start_date} → {end_date}")
    logger.info(f"   job_id: {job_id}")
    logger.info(f"{'='*60}")

    # ----------------------------------------------------------
    # Stage 1: Truy vấn dữ liệu (10%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 10, "Đang truy vấn dữ liệu",
        start_date, end_date, started_at=started_at
    )

    df = query_from_db_total(start_date, end_date)
    if df.empty or len(df) < 100:
        msg = f"Không đủ dữ liệu: {len(df)} samples (cần ít nhất 100)"
        logger.error(f"❌ {msg}")
        update_fiware(
            job_id, model_type, "failed", 0, "Lỗi dữ liệu",
            start_date, end_date,
            error_message=msg, finished_at=datetime.utcnow().isoformat()
        )
        sys.exit(1)

    total_samples = len(df)
    logger.info(f"📊 Total samples: {total_samples}")

    # ----------------------------------------------------------
    # Stage 2: Tiền xử lý (30%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 30, "Đang tiền xử lý dữ liệu",
        start_date, end_date, total_samples=total_samples, started_at=started_at
    )

    df_train = df.copy()
    le = LabelEncoder()
    df_train["camera_id"] = le.fit_transform(df_train["camera_id"])
    logger.info("✅ LabelEncoder fit trên camera_id")

    features = config["features"]
    target   = config["target"]
    df_clean = df_train.dropna(subset=features + [target])

    if len(df_clean) < 100:
        msg = f"Sau làm sạch còn {len(df_clean)} rows (cần 100)"
        update_fiware(
            job_id, model_type, "failed", 0, "Lỗi dữ liệu",
            start_date, end_date,
            total_samples=total_samples, error_message=msg,
            finished_at=datetime.utcnow().isoformat()
        )
        sys.exit(1)

    X = df_clean[features]
    y = df_clean[target]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # ----------------------------------------------------------
    # Stage 3: Huấn luyện (55%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 55, f"Đang huấn luyện RF {horizon}",
        start_date, end_date, total_samples=total_samples, started_at=started_at
    )

    logger.info(f"🔧 Training RF với {len(X_train)} samples, horizon {horizon}...")
    model = RandomForestRegressor(
        n_estimators=100, max_depth=20, random_state=42, n_jobs=-1
    )
    model.fit(X_train, y_train)
    logger.info("✅ Huấn luyện xong")

    # ----------------------------------------------------------
    # Stage 4: Đánh giá (70%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 70, "Đang đánh giá kết quả",
        start_date, end_date, total_samples=total_samples, started_at=started_at
    )

    y_pred = model.predict(X_test)
    mae  = float(mean_absolute_error(y_test, y_pred))
    rmse = float(root_mean_squared_error(y_test, y_pred))
    r2   = float(r2_score(y_test, y_pred))
    logger.info(f"📊 Kết quả: MAE={mae:.2f} | RMSE={rmse:.2f} | R²={r2:.3f}")

    # Lưu model và encoder tạm thời (local path để upload MinIO)
    model_path = f"models/camera_rf_model_{horizon}.joblib"
    encoder_path = "models/camera_label_encoder.joblib"
    joblib.dump(model, model_path)
    joblib.dump(le, encoder_path)
    logger.info(f"💾 Đã lưu local: {model_path}")

    # ----------------------------------------------------------
    # Stage 5: Upload MinIO (85%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 85, "Đang upload lên MinIO",
        start_date, end_date, total_samples=total_samples, started_at=started_at
    )

    version  = datetime.now().strftime("%Y%m%d_%H%M%S")
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    minio_key = f"random-forest/v1/random-forest_{date_str}_{horizon}.joblib"

    # Hardcode bucket name "ml-models" cho model storage
    minio_client = MinIOModelClient(bucket_name="ml-models")
    upload_ok = minio_client.upload_model(
        local_path=model_path,
        minio_key=minio_key,
        metadata={
            "version": version,
            "horizon": horizon,
            "mae":  f"{mae:.2f}",
            "rmse": f"{rmse:.2f}",
            "r2":   f"{r2:.3f}",
        },
    )

    if not upload_ok:
        msg = "Upload MinIO thất bại"
        logger.error(f"❌ {msg}")
        update_fiware(
            job_id, model_type, "failed", 85, msg,
            start_date, end_date, total_samples=total_samples,
            error_message=msg, finished_at=datetime.utcnow().isoformat()
        )
        sys.exit(1)

    logger.info(f"✅ Model uploaded: {minio_key}")

    # Upload encoder (best-effort, không block nếu fail)
    minio_client.upload_model(
        local_path=encoder_path,
        minio_key=f"random-forest/v1/random-forest_{date_str}_encoder.joblib",
        metadata={"version": version},
    )

    # ----------------------------------------------------------
    # Stage 6: Lưu metadata DB (95%)
    # ----------------------------------------------------------
    update_fiware(
        job_id, model_type, "running", 95, "Đang lưu metadata vào database",
        start_date, end_date, total_samples=total_samples, started_at=started_at
    )

    training_duration_hours = (datetime.now() - training_start_time).total_seconds() / 3600

    db_pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=3,
        host=os.getenv("POSTGRES_HOST"),
        database=os.getenv("POSTGRES_DBS"),
        user=os.getenv("POSTGRES_USERNAME"),
        password=os.getenv("POSTGRES_PASSWORD"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
    )
    metadata_db = ModelMetadataDB(db_pool)
    saved_id = metadata_db.save_model_metadata(
        model_type=model_type,
        model_version=version,
        minio_key=minio_key,
        base_model="RandomForestRegressor",
        training_samples=total_samples,
        training_duration_hours=training_duration_hours,
        metrics={
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "features": features,
        },
        is_active=False,  # ⚠️ KHÔNG tự động active — user kích hoạt thủ công qua UI
    )
    db_pool.closeall()
    logger.info(f"✅ Metadata saved: id={saved_id}, version={version}, is_active=FALSE")

    # ----------------------------------------------------------
    # Stage 7: Hoàn thành (100%)
    # ----------------------------------------------------------
    result_metrics = {"mae": mae, "rmse": rmse, "r2": r2}
    finished_at = datetime.utcnow().isoformat()

    update_fiware(
        job_id, model_type, "succeeded", 100, "Hoàn thành",
        start_date, end_date,
        total_samples=total_samples,
        started_at=started_at,
        finished_at=finished_at,
        result_metrics=result_metrics,
    )

    logger.info(f"{'='*60}")
    logger.info(f"✅ Training hoàn thành!")
    logger.info(f"   model_type: {model_type}")
    logger.info(f"   version:    {version}")
    logger.info(f"   is_active:  FALSE")
    logger.info(f"   MAE={mae:.2f} | RMSE={rmse:.2f} | R²={r2:.3f}")
    logger.info(f"   → Vào UI → Mô hình ML → Xem chi tiết → Kích hoạt để dùng")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
