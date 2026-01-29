import logging
import os
import sys

import joblib
from query import query_from_db_total
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from monitor_performance import monitor_performance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@monitor_performance
def train_camera_model(df):
    if df.empty or len(df) < 100:
        logger.warning("Dữ liệu quá ít để huấn luyện!")
        return None

    # Tạo bản sao để tránh lỗi
    df_train = df.copy()

    # Xử lý Label Encoding cho camera_id (Chuyển chuỗi sang số)
    le = LabelEncoder()
    df_train["camera_id"] = le.fit_transform(df_train["camera_id"])
    joblib.dump(le, "camera_label_encoder.joblib")  # Lưu lại
    logger.info("✅ Đã mã hóa camera_id sang dạng số.")

    # 1. Chọn Features (X) và Target (y)
    # Target là giá trị hiện tại (avg_objects)
    # Features là các cột quá khứ và thời gian
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
    target = ["target_5m", "target_10m", "target_15m", "target_30m", "target_60m"]

    # 2. Làm sạch dữ liệu (Xử lý giá trị NaN do LAG gây ra)
    # RandomForest không chấp nhận NaN. Ta điền bằng 0 hoặc dùng dropna
    df_train = df_train.dropna(subset=features + target)

    X = df_train[features]
    y = df_train[target]

    # 3. Chia tập dữ liệu: 80% để học, 20% để kiểm tra
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # 4. Khởi tạo và huấn luyện Random Forest
    # n_estimators=100: số lượng cây quyết định
    # Thêm n_jobs=-1 để chạy nhanh hơn trên nhiều nhân CPU
    model = RandomForestRegressor(
        n_estimators=100, max_depth=20, random_state=42, n_jobs=-1
    )

    logger.info("Đang huấn luyện Random Forest...")
    model.fit(X_train, y_train)

    # 5. Đánh giá mô hình
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    logger.info(f"Kết quả đánh giá:")
    logger.info(f"   - MAE (Sai số trung bình): {mae:.2f} người")
    logger.info(f"   - R2 Score (Độ chính xác): {r2:.2f}")

    # 6. Lưu mô hình để sử dụng sau này (cho predict service)
    model_path = "camera_rf_model.joblib"
    joblib.dump(model, model_path)
    logger.info(f"Đã lưu mô hình tại: {model_path}")

    return model


# --- THỰC THI ---
# 1. Lấy dữ liệu đã có feature lag/trend
data = query_from_db_total("2026-01-18", "2026-01-21")
# print(data.head(100))
# 2. Huấn luyện
model = train_camera_model(data)
