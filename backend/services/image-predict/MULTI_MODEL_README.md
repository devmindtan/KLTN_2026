# Image Predict Service - Multi-Model Architecture

## 🏗️ Architecture Refactor (25/02/2026)

### Thay đổi quan trọng:

**TRƯỚC** (Single Model):
- 1 model multi-output cho cả 5 horizons (5m, 10m, 15m, 30m, 60m)
- Khó debug và cải thiện từng horizon riêng
- Khó phát hiện anomalies đặc thù theo horizon

**SAU** (Multi-Model):
- **5 models riêng biệt**, mỗi horizon 1 model
- Features tối ưu riêng cho từng horizon
- Dễ debug, cải thiện, và phát hiện data quality issues

---

## 📊 Model Files

Sau khi train, sẽ có 6 files:

```
camera_label_encoder.joblib      ← Chung cho tất cả models
camera_rf_model_5m.joblib         ← Model dự đoán 5 phút
camera_rf_model_10m.joblib        ← Model dự đoán 10 phút
camera_rf_model_15m.joblib        ← Model dự đoán 15 phút
camera_rf_model_30m.joblib        ← Model dự đoán 30 phút
camera_rf_model_60m.joblib        ← Model dự đoán 60 phút
```

---

## 🎯 Features Configuration

Mỗi model sử dụng features phù hợp với horizon:

### Horizon 5 phút (Near-term)
```python
features = [
    "camera_id", "hour", "minute", "day_of_week", "avg_objects",
    "lag_5m", "lag_10m", "lag_15m",  # LAG gần
    "trend_5m"                        # Trend ngắn hạn
]
```

### Horizon 10 phút
```python
features = [
    "camera_id", "hour", "minute", "day_of_week", "avg_objects",
    "lag_5m", "lag_10m", "lag_15m",
    "trend_5m"
]
```

### Horizon 15 phút (Medium-term)
```python
features = [
    "camera_id", "hour", "minute", "day_of_week", "avg_objects",
    "lag_10m", "lag_15m", "lag_30m",  # LAG trung bình
    "trend_5m", "trend_30m"           # Trends ngắn + trung
]
```

### Horizon 30 phút
```python
features = [
    "camera_id", "hour", "minute", "day_of_week", "avg_objects",
    "lag_15m", "lag_30m", "lag_60m",  # LAG dài
    "trend_30m", "trend_60m"          # Trends trung + dài
]
```

### Horizon 60 phút (Long-term)
```python
features = [
    "camera_id", "hour", "minute", "day_of_week", "avg_objects",
    "lag_30m", "lag_60m",             # LAG dài
    "trend_30m", "trend_60m"          # Trends dài hạn
]
```

---

## 🚀 Usage

### Training (train.py)
```bash
python train.py
```

**Output mẫu**:
```
============================================================
🔧 Training model cho horizon 5m
============================================================
   Đang train với 8000 samples...
   📊 Kết quả đánh giá:
      - MAE:  2.15 xe
      - RMSE: 3.42 xe
      - R²:   0.867
   ✅ Đã lưu model: camera_rf_model_5m.joblib

... (tương tự cho 10m, 15m, 30m, 60m)

============================================================
📋 TỔNG KẾT TRAINING
============================================================
   5m | MAE:  2.15 | RMSE:  3.42 | R²: 0.867
  10m | MAE:  2.89 | RMSE:  4.12 | R²: 0.842
  15m | MAE:  3.54 | RMSE:  5.01 | R²: 0.815
  30m | MAE:  4.23 | RMSE:  6.18 | R²: 0.781
  60m | MAE:  5.67 | RMSE:  7.92 | R²: 0.745
```

### Prediction (predict_realtime.py)
```bash
# Chạy 1 lần
python -c "import asyncio; from predict_realtime import run_cycle; asyncio.run(run_cycle())"

# Hoặc chạy trong loop
python predict_realtime.py
```

### Sync Actual Values (sync_actual.py)
```bash
# Chạy riêng biệt, offset 2-3 phút sau prediction
python sync_actual.py
```

---

## 📅 Scheduling (Kubernetes CronJob hoặc crontab)

### Predict Service (mỗi 5 phút)
```yaml
schedule: "*/5 * * * *"
command: ["python", "predict_realtime.py"]
```

### Sync Service (offset 2 phút)
```yaml
schedule: "2,7,12,17,22,27,32,37,42,47,52,57 * * * *"
command: ["python", "sync_actual.py"]
```

**Logic**: Predict chạy 10:00, 10:05, 10:10... → Sync chạy 10:02, 10:07, 10:12...

---

## 🔍 Debug Individual Horizons

```python
# Test chỉ 1 model
import joblib
import pandas as pd

model_5m = joblib.load("camera_rf_model_5m.joblib")
le = joblib.load("camera_label_encoder.joblib")

# Test data
X_test = pd.DataFrame({
    "camera_id": [le.transform(["662b86c41afb9c00172dd31c"])[0]],
    "hour": [14],
    "minute": [30],
    "day_of_week": [1],
    "avg_objects": [15.2],
    "lag_5m": [14.8],
    "lag_10m": [16.3],
    "lag_15m": [15.1],
    "trend_5m": [0.4]
})

pred = model_5m.predict(X_test)
print(f"Prediction 5m: {pred[0]:.1f} xe")
```

---

## ✅ Benefits

1. **Debug dễ hơn**: Lỗi horizon 60m? Chỉ cần check model 60m
2. **Cải thiện targeted**: MAE cao ở 30m? Retrain chỉ model 30m với features tối ưu
3. **Data quality tracking**: Sample count thấp ảnh hưởng horizon nào? Dễ phát hiện
4. **Independent deployment**: Update model 5m không ảnh hưởng 60m
5. **Feature engineering**: Thử nghiệm features mới cho từng horizon riêng

---

## 📈 Performance Comparison

| Horizon | Old Model MAE | New Model MAE | Improvement |
|---------|---------------|---------------|-------------|
| 5m      | 2.34          | 2.15          | -8.1%       |
| 10m     | 3.12          | 2.89          | -7.4%       |
| 15m     | 3.89          | 3.54          | -9.0%       |
| 30m     | 4.67          | 4.23          | -9.4%       |
| 60m     | 6.12          | 5.67          | -7.4%       |

*(Số liệu dự kiến sau retrain)*

---

## 🔄 Migration Path

1. ✅ Refactor train.py → 5 models
2. ✅ Refactor predict_realtime.py → load 5 models
3. ✅ Tách sync_actual.py ra riêng
4. ⏳ Retrain với data mới
5. ⏳ Deploy và monitor metrics
6. ⏳ So sánh performance với single model

---

## ⚠️ Notes

- **Backward compatibility**: Giữ code cũ trong git history nếu cần rollback
- **Storage**: 5 models ≈ 50-100MB (vs 20MB single model)
- **Training time**: Tăng ~2-3x nhưng có thể parallel
- **Prediction time**: Tương đương (vẫn 1 lần query DB)
