import sys
import os
import logging
from datetime import datetime, timezone

# PHẢI append path TRƯỚC KHI import shared và local modules
sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor
import joblib
from psycopg2.pool import ThreadedConnectionPool

# Import sau khi sys.path đã được set
from db_queries import query_from_db_total
from shared.model_metadata_db import ModelMetadataDB
from shared.minio_client import MinIOModelClient
from shared.monitor_performance import monitor_performance


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@monitor_performance
def train_camera_model(df):
    """
    Huấn luyện 5 mô hình Random Forest riêng biệt cho từng horizon (5m, 10m, 15m, 30m, 60m)
    Mỗi model có features tối ưu cho horizon của nó để dễ debug và cải thiện
    Args:
        df: pandas DataFrame chứa dữ liệu lịch sử với LAG/LEAD features
    Returns:
        Dict chứa 5 trained models hoặc None nếu dữ liệu không đủ
    """
    if df.empty or len(df) < 100:
        logger.warning("Dữ liệu quá ít để huấn luyện!")
        return None

    # Tạo bản sao để tránh lỗi
    df_train = df.copy()

    # Xử lý Label Encoding cho camera_id (Chuyển chuỗi sang số)
    le = LabelEncoder()
    df_train["camera_id"] = le.fit_transform(df_train["camera_id"])
    joblib.dump(le, "models/camera_label_encoder.joblib")
    logger.info("✅ Đã mã hóa camera_id sang dạng số.")

    # Define features cho từng horizon (tối ưu riêng)
    horizon_configs = {
        "5m": {
            "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                         "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
            "target": "target_5m",
            "model_file": "models/camera_rf_model_5m.joblib"
        },
        "10m": {
            "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                         "lag_5m", "lag_10m", "lag_15m", "trend_5m"],
            "target": "target_10m",
            "model_file": "models/camera_rf_model_10m.joblib"
        },
        "15m": {
            "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                         "lag_10m", "lag_15m", "lag_30m", "trend_5m", "trend_30m"],
            "target": "target_15m",
            "model_file": "models/camera_rf_model_15m.joblib"
        },
        "30m": {
            "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                         "lag_15m", "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
            "target": "target_30m",
            "model_file": "models/camera_rf_model_30m.joblib"
        },
        "60m": {
            "features": ["camera_id", "hour", "minute", "day_of_week", "avg_objects",
                         "lag_30m", "lag_60m", "trend_30m", "trend_60m"],
            "target": "target_60m",
            "model_file": "models/camera_rf_model_60m.joblib"
        }
    }

    models = {}

    # Train từng model riêng biệt
    for horizon, config in horizon_configs.items():
        logger.info(f"\n{'='*60}")
        logger.info(f"🔧 Training model cho horizon {horizon}")
        logger.info(f"{'='*60}")

        features = config["features"]
        target = config["target"]

        # Làm sạch dữ liệu (drop NaN)
        df_clean = df_train.dropna(subset=features + [target])

        if len(df_clean) < 100:
            logger.warning(
                f"⚠️ Horizon {horizon}: Không đủ dữ liệu ({len(df_clean)} rows)")
            continue

        X = df_clean[features]
        y = df_clean[target]

        # Split train/test
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Train RandomForest
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=20,
            random_state=42,
            n_jobs=-1
        )

        logger.info(f"   Đang train với {len(X_train)} samples...")
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = root_mean_squared_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)

        logger.info(f"   📊 Kết quả đánh giá:")
        logger.info(f"      - MAE:  {mae:.2f} xe")
        logger.info(f"      - RMSE: {rmse:.2f} xe")
        logger.info(f"      - R²:   {r2:.3f}")

        # Save model
        model_path = config["model_file"]
        joblib.dump(model, model_path)
        logger.info(f"   ✅ Đã lưu model: {model_path}")

        models[horizon] = {
            "model": model,
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "features": features
        }

    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("📋 TỔNG KẾT TRAINING")
    logger.info(f"{'='*60}")
    for horizon, info in models.items():
        logger.info(
            f"  {horizon:>3} | MAE: {info['mae']:5.2f} | RMSE: {info['rmse']:5.2f} | R²: {info['r2']:.3f}")

    return models


def upload_models_to_minio(models_info, training_start_time, total_samples):
    """
    Upload trained models lên MinIO và lưu metadata vào PostgreSQL
    Args:
        models_info: Dict chứa models và metrics từ train_camera_model()
        training_start_time: Thời điểm bắt đầu train (datetime object)
        total_samples: Tổng số samples dùng để train
    """
    if not models_info:
        logger.warning("⚠️ Không có models để upload")
        return

    logger.info(f"\n{'='*60}")
    logger.info("📤 UPLOADING MODELS TO MINIO")
    logger.info(f"{'='*60}")

    # Calculate training duration
    training_duration_hours = (
        datetime.now() - training_start_time).total_seconds() / 3600

    # Version sử dụng timestamp
    version = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Initialize MinIO client
    minio_client = MinIOModelClient()

    # Initialize DB connection
    db_pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        host=os.getenv("POSTGRES_HOST"),
        database=os.getenv("POSTGRES_DBS"),
        user=os.getenv("POSTGRES_USERNAME"),
        password=os.getenv("POSTGRES_PASSWORD"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
    )
    metadata_db = ModelMetadataDB(db_pool)

    # Generate date string for filename
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    # Upload từng model
    for horizon in ["5m", "10m", "15m", "30m", "60m"]:
        if horizon not in models_info:
            continue

        info = models_info[horizon]
        local_path = f"models/camera_rf_model_{horizon}.joblib"
        minio_key = f"random-forest/v1/random-forest_{date_str}_{horizon}.joblib"

        # Upload model
        logger.info(f"\n   Uploading {horizon} model...")
        success = minio_client.upload_model(
            local_path=local_path,
            minio_key=minio_key,
            metadata={
                "version": version,
                "horizon": horizon,
                "mae": f"{info['mae']:.2f}",
                "rmse": f"{info['rmse']:.2f}",
                "r2": f"{info['r2']:.3f}"
            }
        )

        if not success:
            logger.error(f"   ❌ Upload failed for {horizon}")
            continue

        # Save metadata to DB
        metadata_db.save_model_metadata(
            model_type=f"random_forest_{horizon}",
            model_version=version,
            minio_key=minio_key,
            base_model="RandomForestRegressor",
            training_samples=total_samples,
            training_duration_hours=training_duration_hours,
            metrics={
                "mae": info["mae"],
                "rmse": info["rmse"],
                "r2": info["r2"],
                "features": info["features"]
            },
            is_active=True  # Mặc định set active cho version mới
        )

        logger.info(f"   ✅ {horizon} uploaded & metadata saved")

    # Upload label encoder
    logger.info("\n   Uploading label encoder...")
    minio_client.upload_model(
        local_path="models/camera_label_encoder.joblib",
        minio_key=f"random-forest/v1/random-forest_{date_str}_encoder.joblib",
        metadata={"version": version}
    )

    db_pool.closeall()

    logger.info(f"\n{'='*60}")
    logger.info(f"✅ All models uploaded to MinIO (version: {version})")
    logger.info(f"{'='*60}")


# --- THỰC THI ---
training_start_time = datetime.now()
logger.info(
    f"🚀 Training started at {training_start_time.strftime('%Y-%m-%d %H:%M:%S')}")

# 1. Lấy dữ liệu đã có feature lag/trend
data = query_from_db_total("2026-02-13", "2026-02-26")
total_samples = len(data)
logger.info(f"📊 Total samples: {total_samples}")

# 2. Huấn luyện
models = train_camera_model(data)

# 3. Upload models lên MinIO (nếu training thành công)
if models:
    upload_models_to_minio(models, training_start_time, total_samples)
else:
    logger.warning("⚠️ Training failed, skipping upload to MinIO")
