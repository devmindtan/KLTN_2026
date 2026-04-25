# Trend Analysis Scripts (Forecast / Detection / Model)

## 1) Kế hoạch biểu đồ

Tổng cộng **11 biểu đồ** (chi tiết xem `PLAN.md`):

- `camera_forecasts`: 3 biểu đồ
- `camera_detections`: 3 biểu đồ
- `ml_model_metadata`: 2 biểu đồ
- `model_metrics_history`: 3 biểu đồ

## 2) Cấu trúc thư mục

- `extract_data.py`: Trích xuất dữ liệu theo chunk
- `plot_camera_forecasts.py`: 3 biểu đồ forecast
- `plot_camera_detections.py`: 3 biểu đồ detections
- `plot_ml_model_metadata.py`: 2 biểu đồ model metadata
- `plot_model_metrics_history.py`: 3 biểu đồ model metrics history
- `run_all.py`: Chạy end-to-end
- `data/`: CSV output sau extract
- `outputs/`: PNG charts output

## 3) Cài dependencies

```bash
pip install -r reports/trend_analysis/requirements.txt
```

## 4) Biến môi trường DB (bắt buộc)

Sử dụng cùng chuẩn env với backend/report-generator:

- `POSTGRES_HOST`
- `POSTGRES_DBS`
- `POSTGRES_USERNAME`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT` (optional, default `5432`)

## 5) Chạy theo từng bước

### Bước 1: Trích xuất dữ liệu về máy (chunked)

```bash
python reports/trend_analysis/extract_data.py \
  --date-from 2026-01-01 \
  --date-to 2026-04-22 \
  --chunk-days 1 \
  --sql-fetch-chunk-size 20000
```

### Bước 2: Vẽ biểu đồ cho từng bảng

```bash
python reports/trend_analysis/plot_camera_forecasts.py
python reports/trend_analysis/plot_camera_detections.py
python reports/trend_analysis/plot_ml_model_metadata.py
python reports/trend_analysis/plot_model_metrics_history.py
```

## 6) Chạy một lệnh end-to-end

```bash
python reports/trend_analysis/run_all.py \
  --date-from 2026-01-01 \
  --date-to 2026-04-22 \
  --chunk-days 1 \
  --sql-fetch-chunk-size 20000
```

## 7) Output

- Dữ liệu: `reports/trend_analysis/data/*.csv`
- Manifest: `reports/trend_analysis/data/extraction_manifest.json`
- Biểu đồ: `reports/trend_analysis/outputs/*.png`
