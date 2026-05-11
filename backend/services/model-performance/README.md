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

## 🧠 Giải thích các câu query trong `analyze_metrics.py`

Phần này giải thích theo 2 lớp:
- **Tổng quan**: query dùng để trả lời câu hỏi gì?
- **Chi tiết**: từng thành phần SQL đang tính toán như thế nào?

---

### 1) Query `calculate_overall_metrics()`

**Tổng quan**
- Đo chất lượng dự báo toàn hệ thống trong một khoảng thời gian (`period_days`).
- Trả về bộ chỉ số nền tảng: số mẫu, MAE, RMSE, MAPE, accuracy theo ngưỡng sai số.

**Chi tiết các phép tính chính**
- `COUNT(*) as total_predictions`: tổng số bản ghi dự báo trong khoảng thời gian lọc.
- `COUNT(*) FILTER (WHERE error_value IS NOT NULL) as verified_predictions`: số mẫu đã có actual để tính sai số.
- `ROUND(AVG(error_value)::numeric, 2) as mae`: sai số tuyệt đối trung bình theo đơn vị xe.
- `ROUND(SQRT(AVG(POWER(error_value, 2)))::numeric, 2) as rmse`: nhấn mạnh outlier vì bình phương sai số.
- `ROUND(AVG((error_value / NULLIF(actual_value, 0) * 100)) FILTER (WHERE actual_value >= 5)::numeric, 2) as mape`:
  - `NULLIF(actual_value, 0)` tránh chia cho 0.
  - `actual_value >= 5` giúp MAPE ổn định hơn, tránh nổ % khi lưu lượng quá thấp.
- `accuracy_5xe / 10xe / 15xe`: tỉ lệ mẫu có sai số nhỏ hơn hoặc bằng ngưỡng tương ứng.

**Ý nghĩa vận hành**
- Đây là “sức khỏe tổng thể” của model để so sánh theo ngày/tuần.

---

### 2) Query `analyze_by_horizon()`

**Tổng quan**
- So sánh chất lượng dự báo theo từng chân trời dự báo: 5m, 10m, 15m, 30m, 60m.

**Chi tiết các cột quan trọng**
- `GROUP BY horizon_minutes`: gom nhóm theo từng horizon.
- `avg_error`: sai số trung bình.
- `median_error`: trung vị sai số, ít nhạy với outlier.
- `p95_error`: ngưỡng sai số mà 95% mẫu không vượt quá.
- `min_error`, `max_error`: biên độ sai số thực tế.
- `accuracy_5xe`, `accuracy_10xe`: tỉ lệ đúng theo ngưỡng sai số.

**Recommendation sau query (logic Python)**
- `avg_error < 4` → `KEEP`
- `4 <= avg_error < 6` → `OPTIONAL`
- `avg_error >= 6` → `DROP`

**Ý nghĩa vận hành**
- Quyết định nên giữ horizon nào cho dashboard chính để đảm bảo độ tin cậy.

---

### 3) Query `rank_cameras()`

**Tổng quan**
- Xếp hạng camera theo chất lượng dự báo để tìm nhóm tốt nhất và cần cải thiện.

**Chi tiết các thành phần**
- `GROUP BY c.camera_id`: tính metric theo từng camera.
- `HAVING COUNT(*) >= 50`: chỉ giữ camera có đủ mẫu để ranking có ý nghĩa.
- `avg_error`, `median_error`: mức sai số trung bình/trung vị theo camera.
- `error_percentage`: sai số tương đối theo `%` trên actual trung bình.
- `accuracy_5xe`: tỉ lệ đúng ngưỡng ±5 xe.
- `ORDER BY avg_error ASC`: camera tốt hơn nằm trên.
- Phần Python tách mảng thành `best` (top đầu) và `worst` (top cuối đảo ngược).

**Ý nghĩa vận hành**
- Ưu tiên xử lý các camera có `avg_error` cao kéo dài (góc quay, ánh sáng, occlusion, layout phức tạp).

---

### 4) Query `calculate_data_coverage()`

**Tổng quan**
- Kiểm tra chất lượng dữ liệu đầu vào cho việc đánh giá model.

**Chi tiết các cột**
- `verified`: số bản ghi đã có `error_value`.
- `pending`: số bản ghi chưa sync được actual.
- `verification_rate`: tỉ lệ verified/tổng.
- `MAX(created_at) FILTER (WHERE error_value IS NOT NULL) as last_updated`: mốc cập nhật verified gần nhất.
- Trong Python: tính thêm `minutes_since_update` để biết dữ liệu có còn mới không.

**Ý nghĩa vận hành**
- Nếu verification thấp hoặc dữ liệu stale, các metric accuracy có thể không còn phản ánh đúng thực tế hiện tại.

---

### 5) Query `calculate_trend_accuracy()`

**Tổng quan**
- Đo khả năng model dự đoán đúng **xu hướng** (tăng/giảm/ổn định), không chỉ trị số tuyệt đối.

**Chi tiết CTE `trend_analysis`**
- `LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time) as prev_actual`:
  - Lấy actual liền trước theo từng camera.
- `predicted_trend`:
  - So sánh `predicted_value` với `prev_actual` để gán `increasing/decreasing/stable`.
- `actual_trend`:
  - So sánh `actual_value` với `prev_actual` để lấy xu hướng thực tế.
- Chỉ tính `horizon_minutes = 5` để đánh giá xu hướng ngắn hạn gần realtime.

**Chi tiết query ngoài**
- `trend_accuracy`: tỉ lệ `predicted_trend = actual_trend`.
- `correct_increasing`, `correct_decreasing`, `correct_stable`: số lần đúng theo từng loại xu hướng.
- `WHERE prev_actual IS NOT NULL`: bỏ mẫu đầu tiên mỗi camera (không có dữ liệu liền trước để so).

**Ý nghĩa vận hành**
- Hữu ích cho quyết định điều tiết sớm (xu hướng sắp tăng hay giảm), ngay cả khi sai số số lượng còn dao động.

---

### 6) Câu query lọc thời gian dùng chung

Hầu hết query dùng điều kiện:

```sql
forecast_for_time >= NOW() - INTERVAL ':days days'
```

Ý nghĩa:
- Chỉ phân tích trong cửa sổ gần đây (mặc định 7 ngày).
- Dùng tham số `period_days` để thay đổi độ dài cửa sổ khi cần.

Thực tế sử dụng:
- Cửa sổ ngắn (3-7 ngày): phản ánh hiện trạng nhanh hơn.
- Cửa sổ dài (14-30 ngày): ổn định hơn, ít nhiễu theo ngày.

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
