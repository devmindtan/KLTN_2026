# Kế hoạch biểu đồ theo schema (trước khi code)

## Mục tiêu

Phân tích sự thay đổi theo thời gian và mức cải thiện/biến động cho 4 bảng:

- `camera_forecasts`
- `camera_detections`
- `ml_model_metadata`
- `model_metrics_history`

## Số lượng biểu đồ đề xuất: **11 biểu đồ**

### 1) Bảng `camera_forecasts` (3 biểu đồ)

1. **Forecast vs Actual theo ngày (theo từng horizon)**
2. **MAE/MAPE theo ngày (theo từng horizon)**
3. **Chất lượng dữ liệu theo ngày** (`input_sample_count`, `lag_sample_count`, `sync_sample_count`)

### 2) Bảng `camera_detections` (3 biểu đồ)

4. **Tổng lưu lượng theo ngày** (kèm MA 7 ngày)
5. **Biến động theo ngày** (`std_objects`, `max_objects`)
6. **Heatmap giờ-ngày trong tuần** (mật độ trung bình)

### 3) Bảng `ml_model_metadata` (2 biểu đồ)

7. **Timeline kích hoạt model** (phiên bản active theo thời gian)
8. **So sánh hiệu năng theo phiên bản** (`MAE`, `RMSE`, `R2`) theo `model_type`

### 4) Bảng `model_metrics_history` (3 biểu đồ)

9. **Xu hướng chất lượng tổng thể theo thời gian** (`MAE`, `MAPE`, `Acc<=5`, `Acc<=10`)
10. **Trend accuracy + confidence theo thời gian**
11. **Heatmap MAE theo horizon và ngày snapshot**

## Chiến lược extraction dữ liệu lớn

- Áp dụng chunk theo thời gian (`chunk_days`) cho `camera_forecasts`, `camera_detections`.
- `camera_detections` chỉ trích xuất dữ liệu đã aggregate theo giờ để tránh nặng RAM.
- Ghi CSV cục bộ theo từng loại dữ liệu, append dần, không load full table vào memory.

## Đầu ra

- Dữ liệu trích xuất: `reports/trend_analysis/data/*.csv`
- Biểu đồ: `reports/trend_analysis/outputs/*.png`
