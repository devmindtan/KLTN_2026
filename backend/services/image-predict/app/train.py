from shared.monitor_performance import monitor_performance
from query import query_from_db_total
import logging
import os
import sys

import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


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


# --- THỰC THI ---
# 1. Lấy dữ liệu đã có feature lag/trend
data = query_from_db_total("2026-02-13", "2026-02-24")
# print(data.head(100))
# 2. Huấn luyện
model = train_camera_model(data)
