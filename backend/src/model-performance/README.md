# Model Performance Service

Service phân tích độ chính xác của ML model dự đoán giao thông và gửi metrics lên FIWARE Orion để Frontend hiển thị dashboard.

## 📋 Tính năng

### Metrics được tính toán:

1. **Overall Metrics** (⭐⭐⭐⭐⭐ CRITICAL)
   - MAE (Mean Absolute Error): Sai số tuyệt đối trung bình
   - RMSE (Root Mean Square Error): Phạt nặng outliers
   - MAPE (Mean Absolute Percentage Error): Sai số %
   - Accuracy rates: ≤5xe, ≤10xe, ≤15xe

2. **Horizon Analysis** (⭐⭐⭐⭐⭐ CRITICAL)
   - So sánh performance của 5 horizons (5m, 10m, 15m, 30m, 60m)
   - Recommendation: KEEP / OPTIONAL / DROP

3. **Camera Ranking** (⭐⭐⭐⭐)
   - Top 5 cameras tốt nhất
   - Top 5 cameras cần cải thiện

4. **Data Coverage** (⭐⭐⭐)
   - Verification rate
   - Data freshness

5. **Trend Accuracy** (⭐⭐⭐⭐)
   - Accuracy của trend predictions (increasing/decreasing/stable)

## 🚀 Cách sử dụng

### 1. Setup môi trường

```bash
# Copy .env.example → .env và điều chỉnh
cp .env.example .env

# Install dependencies
pip install -r requirements.txt
```

### 2. Chạy service

#### A. Continuous mode (mặc định - chạy mỗi 60 phút)
```bash
python main.py
```

#### B. Single execution (chạy 1 lần và thoát)
```bash
python main.py --once
```

#### C. Test mode (tính metrics nhưng không gửi FIWARE)
```bash
python main.py --test
```

#### D. Help
```bash
python main.py --help
```

## 📂 Cấu trúc files

```
model-performance/
├── main.py                    # Entry point
├── analyze_metrics.py         # Class ModelPerformanceAnalyzer
├── update_fiware.py           # Gửi metrics lên FIWARE
├── monitor_performance.py     # Decorator đo thời gian functions
├── requirements.txt           # Python dependencies
├── .env.example               # Template environment variables
└── README.md                  # Documentation (file này)
```

## 🔧 Functions chính

### `ModelPerformanceAnalyzer` class

| Method | Mô tả | Output |
|--------|-------|--------|
| `calculate_overall_metrics()` | Tính MAE, RMSE, MAPE, Accuracy | Dict |
| `analyze_by_horizon()` | Phân tích từng horizon | List[Dict] |
| `rank_cameras()` | Ranking cameras (best/worst) | Dict |
| `calculate_data_coverage()` | Verification rate, freshness | Dict |
| `calculate_trend_accuracy()` | Accuracy của trend predictions | Dict |
| `get_full_report()` | Tổng hợp tất cả metrics | Dict |

## 📊 Output mẫu

```python
{
  "period_days": 7,
  "generated_at": "2026-02-22T10:30:00",
  "overall": {
    "mae": 3.2,
    "rmse": 4.1,
    "mape": 8.5,
    "accuracy_5xe": 78.5,
    "accuracy_10xe": 92.3,
    "verification_rate": 94.2
  },
  "by_horizon": [
    {
      "horizon_minutes": 5,
      "avg_error": 2.8,
      "accuracy_5xe": 82.3,
      "recommendation": "KEEP"
    },
    ...
  ],
  "camera_ranking": {
    "best": [...],
    "worst": [...]
  }
}
```

## 🐳 Docker (TODO)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

## ⚙️ Environment Variables

| Variable | Mô tả | Example |
|----------|-------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_DBS` | Database name | `kltn_db` |
| `POSTGRES_USERNAME` | DB user | `admin` |
| `POSTGRES_PASSWORD` | DB password | `minhtan2003` |
| `POSTGRES_PORT` | DB port | `5432` |
| `FIWARE_ORION_BASE` | Orion base URL | `localhost:1026` |

## 📈 Performance

Với decorator `@monitor_performance`, mỗi function sẽ log thời gian thực thi:

```
2026-02-22 10:30:15 - INFO - Hàm 'calculate_overall_metrics' chạy mất 0.8234 giây
2026-02-22 10:30:16 - INFO - Hàm 'analyze_by_horizon' chạy mất 1.2156 giây
```

## 🔗 Integration với FIWARE

Service gửi metrics lên entity:
- **Entity ID**: `urn:ngsi-ld:ModelMetrics:performance`
- **Type**: `ModelMetrics`
- **Attributes**: `overall`, `by_horizon`, `camera_ranking`, `data_coverage`, `trend_accuracy`

Frontend sẽ subscribe qua WebSocket và nhận updates real-time.

## 📝 TODO

- [ ] Implement Status Confusion Matrix (calculate_status_accuracy)
- [ ] Add time-based patterns analysis (error by hour/day)
- [ ] Create Dockerfile
- [ ] Add unit tests
- [ ] Setup K8s CronJob

## 📚 References

- Design doc: `assets/ideas/model-performance-metrics-design.md`
- Database schema: `schemas/DATABASE_SCHEMA.md`
- FIWARE template: `schemas/FIWARE_ORION_DATA_TEMPLATE.md`
