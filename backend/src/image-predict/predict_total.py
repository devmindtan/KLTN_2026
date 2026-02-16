from monitor_performance import monitor_performance
import logging
import os
import sys

import joblib
import numpy as np
import pandas as pd
from query import query_from_db_total
from sklearn.metrics import mean_absolute_error

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@monitor_performance
def predict_total(new_data):
    """
    Dự đoán và đánh giá mô hình trên dữ liệu lịch sử (batch evaluation)
    Args:
        new_data: pandas DataFrame chứa dữ liệu test với LAG/LEAD features
    Returns:
        DataFrame so sánh giữa dự đoán và thực tế
    """
    # 1. Load Model và Encoder
    try:
        model = joblib.load("camera_rf_model.joblib")
        le = joblib.load("camera_label_encoder.joblib")
    except:
        logger.info("❌ Không tìm thấy file model hoặc encoder!")
        return

    # 2. Chuẩn bị dữ liệu
    df_test = new_data.copy()
    df_test = df_test[df_test["camera_id"].isin(le.classes_)]
    df_test["camera_id"] = le.transform(df_test["camera_id"])

    # Features dùng để "nhìn" (Input)
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

    # Các mốc bạn muốn đối chiếu (Target)
    # Lưu ý: SQL của bạn phải có các cột LEAD tương ứng: target_10m, target_15m, target_30m
    target_cols = ["target_5m", "target_10m",
                   "target_15m", "target_30m", "target_60m"]

    # Làm sạch: Chỉ giữ những dòng có đủ Feature và đủ ĐÁP ÁN của cả 3 mốc để so sánh
    df_test = df_test.dropna(subset=features + target_cols)

    X_new = df_test[features]

    # 3. Dự đoán
    # Lưu ý: Nếu bạn dùng 1 model train trên 30p, nó sẽ cho kết quả tốt nhất ở mốc 30p.
    y_preds = model.predict(X_new)

    # 4. Tạo bảng so sánh đa cộts
    comparison = pd.DataFrame(
        {
            "Camera": le.inverse_transform(df_test["camera_id"]),
            "Time_Now": df_test["time_bucket"],
            "Now": np.round(df_test["avg_objects"], 3),
            # Các mốc thực tế lấy từ DB để đối chiếu
            "Cur_5p": np.round(df_test["target_5m"], 3),
            "Cur_10p": np.round(df_test["target_10m"], 3),
            "Cur_15p": np.round(df_test["target_15m"], 3),
            "Cur_30p": np.round(df_test["target_30m"], 3),
            "Cur_60p": np.round(df_test["target_60m"], 3),
            # Chỉ rõ đây là dự báo của mốc 10,15,30,60p
            "AI_5p": np.round(y_preds[:, 0], 3),
            "AI_10p": np.round(y_preds[:, 1], 3),
            "AI_15p": np.round(y_preds[:, 2], 3),
            "AI_30p": np.round(y_preds[:, 3], 3),
            "AI_60p": np.round(y_preds[:, 4], 3),
            # Tính sai số riêng cho mốc 30p
            # "Lệch_Dự_Báo_30p": np.abs(df_test["target_30m"] - y_preds),
        }
    )
    logger.info("\n📊 SO SÁNH DỰ BÁO ĐA MỐC THỜI GIAN (20 dòng đầu):")
    # In ra để so sánh xem AI đang đoán khớp với mốc nào nhất
    print(comparison.head(20).to_string())

    # 5. Tính sai số cho từng mốc để xem Model "hợp" với mốc nào
    print("\n--- PHÂN TÍCH SAI SỐ (MAE) ---")
    for i, col in enumerate(target_cols):
        mae = mean_absolute_error(df_test[col], y_preds[:, i])
        logger.info(f"✅ Sai số thực tế cho mốc {col}: {mae:.2f} người")

    return comparison


# Thực thi
next_day_data = query_from_db_total("2026-01-22", "2026-01-22")
predict_total(next_day_data)
