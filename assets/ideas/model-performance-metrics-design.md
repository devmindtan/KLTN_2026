# Model Performance Metrics & Dashboard Design

> **Ngày tạo:** 22/02/2026  
> **Mục đích:** Thiết kế service phân tích độ chính xác model ML và giao diện dashboard để đánh giá uy tín hệ thống dự đoán giao thông

---

## 🎯 Tổng quan

### Vấn đề hiện tại
- Bảng `camera_forecasts` có **duplicate predictions** cho cùng 1 mốc thời gian (5 horizons: 5m, 10m, 15m, 30m, 60m)
- Chưa có cách đo lường **độ chính xác** và **độ tin cậy** của model
- Thiếu giao diện trực quan để **phân tích performance** và **quyết định cải thiện**

### Giải pháp đề xuất
1. **Service mới:** `model-performance` - tính toán metrics từ `camera_forecasts`
2. **FIWARE Entity:** Gửi metrics qua Socket để Frontend real-time
3. **Frontend Dashboard:** Hiển thị trực quan độ chính xác, so sánh horizons, ranking cameras

### Kiến trúc
```
┌─────────────────┐
│ camera_forecasts│ (PostgreSQL)
│  - predictions  │
│  - actual       │
│  - error        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ model-performance.py    │
│  - calculate_metrics()  │
│  - analyze_horizons()   │
│  - rank_cameras()       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ FIWARE Orion            │
│ Entity: ModelMetrics    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ WebSocket (Frontend)    │
│  - useModelMetrics()    │
│  - PerformanceDashboard │
└─────────────────────────┘
```

---

## 📊 Metrics Chi tiết

### 1. OVERALL MODEL ACCURACY (Độ chính xác tổng thể) ⭐⭐⭐⭐⭐

#### A. Error Metrics - Các chỉ số sai số

##### **MAE (Mean Absolute Error)** - CRITICAL
```sql
-- Sai số tuyệt đối trung bình
SELECT 
    ROUND(AVG(ABS(error_value)), 2) as mae
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days';
```

**Hiển thị:**
- Giá trị: `±3.2 xe`
- Màu sắc: 🟢 <5xe (Good) | 🟡 5-10xe (Fair) | 🔴 >10xe (Poor)
- Vị trí: Card lớn ở đầu dashboard
- Tooltip: "Trung bình model dự đoán chênh thực tế ±3.2 xe"

---

##### **RMSE (Root Mean Square Error)**
```sql
-- Phạt nặng outliers (sai số lớn)
SELECT 
    ROUND(SQRT(AVG(POWER(error_value, 2))), 2) as rmse
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days';
```

**Hiển thị:**
- Giá trị: `4.1 xe`
- So sánh với MAE: Nếu `RMSE >> MAE` → có predictions sai rất xa (outliers)
- Alert: `⚠️ RMSE cao hơn MAE 28% → Có ~5% predictions sai >10 xe`

---

##### **MAPE (Mean Absolute Percentage Error)** - CRITICAL
```sql
-- Sai số phần trăm (dễ hiểu nhất)
SELECT 
    ROUND(AVG(ABS(error_value) / NULLIF(actual_value, 0) * 100), 2) as mape
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND actual_value > 0
  AND forecast_for_time >= NOW() - INTERVAL '7 days';
```

**Hiển thị:**
- Giá trị: `8.5%`
- Màu sắc: 🟢 <10% (Excellent) | 🟡 10-20% (Good) | 🔴 >20% (Needs Improvement)
- Giải thích: "Model dự đoán chênh thực tế trung bình 8.5%"

---

#### B. Accuracy Rate - Tỷ lệ dự đoán đúng

```sql
-- Tỉ lệ predictions trong ngưỡng chấp nhận
SELECT 
    ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe,
    ROUND(COUNT(*) FILTER (WHERE error_value <= 10)::numeric / COUNT(*) * 100, 1) as accuracy_10xe,
    ROUND(COUNT(*) FILTER (WHERE error_value <= 15)::numeric / COUNT(*) * 100, 1) as accuracy_15xe
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days';
```

**Hiển thị (Progress Bars):**
```
✅ 78.5% dự đoán chênh ≤5 xe   [████████████████░░░░] 
✅ 92.3% dự đoán chênh ≤10 xe  [███████████████████░]
✅ 98.1% dự đoán chênh ≤15 xe  [████████████████████]
```

**Insight:** "Gần như tất cả predictions (98%) nằm trong khoảng ±15 xe"

---

### 2. HORIZON COMPARISON (So sánh theo khoảng dự đoán) ⭐⭐⭐⭐⭐

```sql
-- Phân tích performance từng horizon
SELECT 
    horizon_minutes,
    COUNT(*) as total_predictions,
    ROUND(AVG(error_value), 2) as avg_error,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY error_value), 2) as median_error,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY error_value), 2) as p95_error,
    ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days'
GROUP BY horizon_minutes
ORDER BY horizon_minutes;
```

**Output mẫu:**
| Horizon | Total Checks | Avg Error | Median | P95 | Accuracy ≤5xe |
|---------|--------------|-----------|--------|-----|---------------|
| 5m      | 5,432        | 2.8 xe    | 2.1 xe | 7.2 | 82.3%         |
| 10m     | 5,428        | 3.5 xe    | 2.9 xe | 8.5 | 76.1%         |
| 15m     | 5,421        | 4.2 xe    | 3.5 xe | 10.1| 68.5%         |
| 30m     | 5,410        | 6.7 xe    | 5.2 xe | 15.3| 52.3%         |
| 60m     | 5,395        | 9.3 xe    | 7.8 xe | 21.7| 38.9%         |

**Hiển thị UI:**
1. **Line Chart:** Trục X = Horizon, Trục Y = Avg Error
2. **Table:** Chi tiết metrics từng horizon
3. **Recommendation Box:**
   ```
   💡 INSIGHT & RECOMMENDATIONS:
   
   ✅ Horizon 5m: Chính xác cao (±2.8 xe) - GIỮ LẠI
   ✅ Horizon 10m: Ổn định (±3.5 xe) - GIỮ LẠI
   ⚠️ Horizon 15m: Chấp nhận được (±4.2 xe) - OPTIONAL
   ❌ Horizon 30m: Error cao (±6.7 xe) - XÓA SAU 3 NGÀY
   ❌ Horizon 60m: Kém tin cậy (±9.3 xe) - XÓA SAU 1 NGÀY
   
   📌 Action: Chỉ giữ horizons ≤15m để tiết kiệm storage và 
              tăng độ uy tín (92% predictions accurate ≤15m horizon)
   ```

---

### 3. CAMERA-SPECIFIC PERFORMANCE (Phân tích theo camera) ⭐⭐⭐⭐

```sql
-- Top Best & Worst Cameras
SELECT 
    c.camera_id,
    cd.display_name,
    COUNT(*) as predictions_count,
    ROUND(AVG(c.error_value), 2) as avg_error,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.error_value), 2) as median_error,
    ROUND(AVG(c.error_value) / NULLIF(AVG(c.actual_value), 0) * 100, 1) as error_percentage,
    ROUND(COUNT(*) FILTER (WHERE c.error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe
FROM camera_forecasts c
LEFT JOIN camera_data cd ON c.camera_id = cd.cam_id
WHERE c.error_value IS NOT NULL
  AND c.forecast_for_time >= NOW() - INTERVAL '7 days'
GROUP BY c.camera_id, cd.display_name
ORDER BY avg_error ASC;
```

**Hiển thị UI:**

#### A. TOP 5 CAMERAS TỐT NHẤT
```
┌──────────────────────────────────┬──────────┬──────────┐
│ Camera                           │ MAE      │ Accuracy │
├──────────────────────────────────┼──────────┼──────────┤
│ 🥇 Trần Quang Khải - TKChân      │ ±2.1 xe  │ 92.3%    │
│ 🥈 Điện Biên Phủ - NBKhiêm        │ ±2.5 xe  │ 88.1%    │
│ 🥉 Hai Bà Trưng - TCVân           │ ±2.8 xe  │ 85.7%    │
│  4 Tôn Đức Thắng - CTMLình        │ ±3.1 xe  │ 83.2%    │
│  5 Nam Kỳ Khởi Nghĩa - LCThắng    │ ±3.4 xe  │ 81.5%    │
└──────────────────────────────────┴──────────┴──────────┘
```

#### B. TOP 5 CAMERAS CẦN CẢI THIỆN
```
┌──────────────────────────────────┬──────────┬────────────────┐
│ Camera                           │ MAE      │ Vấn đề         │
├──────────────────────────────────┼──────────┼────────────────┤
│ ⚠️ Phạm Văn Đồng - QL13          │ ±11.3 xe │ Low light      │
│ ⚠️ Kha Vạn Cân - VVNgân           │ ±9.8 xe  │ Occlusion      │
│ ⚠️ QL13 - Cầu Ông Dầu             │ ±8.5 xe  │ High variance  │
│ ⚠️ Nút Hàng Xanh 5                │ ±7.2 xe  │ Complex layout │
│ ⚠️ Tô Ngọc Vân - TX25             │ ±6.9 xe  │ Weather impact │
└──────────────────────────────────┴──────────┴────────────────┘

💡 RECOMMENDED ACTIONS:
1. Điều chỉnh góc camera / cải thiện lighting cho cameras có Low light
2. Retrain model riêng cho cameras Complex layout với features bổ sung
3. Xem xét loại bỏ cameras có error >10 xe khỏi production dashboard
```

---

### 4. TIME-BASED PATTERNS (Xu hướng theo thời gian) ⭐⭐⭐

#### A. Error by Hour of Day
```sql
SELECT 
    EXTRACT(HOUR FROM forecast_for_time) as hour,
    ROUND(AVG(error_value), 2) as avg_error,
    COUNT(*) as count
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

**Hiển thị:** Line Chart với highlights
```
Error theo giờ trong ngày:
   10xe ┤                     ●●                    
    8xe ┤               ●●          ●●              
    6xe ┤          ●●                    ●●         
    4xe ┤       ●                             ●     
    2xe ┤    ●                                   ●  
    0xe └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
         0  2  4  6  8 10 12 14 16 18 20 22  (giờ)
         
💡 INSIGHT: 
   - Giờ cao điểm (7-9h, 17-19h): Error cao hơn 30-40%
   - Nguyên nhân: Lưu lượng thay đổi nhanh, khó dự đoán
   - Giải pháp: Thêm temporal features (is_rush_hour)
```

#### B. Error by Day of Week
```sql
SELECT 
    EXTRACT(DOW FROM forecast_for_time) as day_of_week,
    ROUND(AVG(error_value), 2) as avg_error
FROM camera_forecasts
WHERE error_value IS NOT NULL
  AND forecast_for_time >= NOW() - INTERVAL '7 days'
GROUP BY day_of_week
ORDER BY day_of_week;
```

**Insight mẫu:** "Thứ 2 và Thứ 6 có error cao hơn 15% → Pattern đầu/cuối tuần khác biệt"

---

### 5. TREND ACCURACY (Dự đoán xu hướng) ⭐⭐⭐⭐

```sql
-- Tính accuracy của trend prediction (increasing/decreasing/stable)
WITH trend_analysis AS (
    SELECT 
        camera_id,
        forecast_for_time,
        horizon_minutes,
        predicted_value,
        actual_value,
        error_value,
        LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time) as prev_actual,
        -- Predicted trend
        CASE 
            WHEN predicted_value > LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
            THEN 'increasing'
            WHEN predicted_value < LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
            THEN 'decreasing'
            ELSE 'stable'
        END as predicted_trend,
        -- Actual trend
        CASE 
            WHEN actual_value > LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
            THEN 'increasing'
            WHEN actual_value < LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
            THEN 'decreasing'
            ELSE 'stable'
        END as actual_trend
    FROM camera_forecasts
    WHERE horizon_minutes = 5
      AND error_value IS NOT NULL
      AND forecast_for_time >= NOW() - INTERVAL '7 days'
)
SELECT 
    ROUND(COUNT(*) FILTER (WHERE predicted_trend = actual_trend)::numeric / COUNT(*) * 100, 1) as trend_accuracy,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE predicted_trend = actual_trend) as correct_predictions
FROM trend_analysis
WHERE prev_actual IS NOT NULL;
```

**Hiển thị:**
```
🎯 TREND PREDICTION ACCURACY

Dự đoán đúng xu hướng giao thông: 73.5% (8,234/11,200 lần)

Chi tiết:
  ✅ Dự đoán TĂNG → Thực tế TĂNG: 2,834 lần (78.2%)
  ✅ Dự đoán GIẢM → Thực tế GIẢM: 2,675 lần (74.1%)
  ✅ Dự đoán ỔN ĐỊNH → Thực tế ỔN ĐỊNH: 2,725 lần (68.9%)
  
  ❌ Dự đoán SAI xu hướng: 2,966 lần (26.5%)
     Trong đó:
     - TĂNG nhầm thành GIẢM: 892 lần
     - GIẢM nhầm thành TĂNG: 1,034 lần
     - Nhầm ỔN ĐỊNH: 1,040 lần

💡 INSIGHT: 73.5% là mức GOOD cho traffic prediction
   → Tin cậy cho traffic management decisions
```

---

### 6. STATUS PREDICTION ACCURACY (Quan trọng nhất!) ⭐⭐⭐⭐⭐

```sql
-- Confusion Matrix: Predicted LOS vs Actual LOS
WITH status_calculation AS (
    SELECT 
        camera_id,
        forecast_for_time,
        horizon_minutes,
        predicted_value,
        actual_value,
        error_value,
        -- Lấy capacity (giả sử có function hoặc subquery)
        -- Tính predicted status
        CASE 
            WHEN predicted_value / capacity < 0.60 THEN 'free_flow'
            WHEN predicted_value / capacity < 0.75 THEN 'smooth'
            WHEN predicted_value / capacity < 0.85 THEN 'moderate'
            WHEN predicted_value / capacity < 1.00 THEN 'heavy'
            ELSE 'congested'
        END as predicted_status,
        -- Tính actual status
        CASE 
            WHEN actual_value / capacity < 0.60 THEN 'free_flow'
            WHEN actual_value / capacity < 0.75 THEN 'smooth'
            WHEN actual_value / capacity < 0.85 THEN 'moderate'
            WHEN actual_value / capacity < 1.00 THEN 'heavy'
            ELSE 'congested'
        END as actual_status
    FROM camera_forecasts
    -- Join với capacity map hoặc calculate inline
    WHERE horizon_minutes = 5
      AND error_value IS NOT NULL
      AND forecast_for_time >= NOW() - INTERVAL '7 days'
)
SELECT 
    actual_status,
    predicted_status,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (PARTITION BY actual_status) * 100, 1) as percentage
FROM status_calculation
GROUP BY actual_status, predicted_status
ORDER BY actual_status, predicted_status;
```

**Hiển thị: Confusion Matrix (Heatmap)**
```
┌──────────────────────────────────────────────────────────────┐
│         PREDICTED STATUS →                                   │
│ ACTUAL  │ Free Flow│ Smooth  │ Moderate│ Heavy   │ Congested│
│   ↓     │          │         │         │         │          │
├─────────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│Free Flow│  95.3%   │  4.2%   │  0.5%   │  0.0%   │   0.0%   │
│         │  🟢      │         │         │         │          │
├─────────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│Smooth   │  8.1%    │  78.5%  │  12.1%  │  1.3%   │   0.0%   │
│         │          │  🟢      │  ⚠️     │         │          │
├─────────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│Moderate │  0.3%    │  15.2%  │  72.8%  │  10.5%  │   1.2%   │
│         │          │  ⚠️     │  🟢      │         │          │
├─────────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│Heavy    │  0.0%    │  1.1%   │  18.3%  │  68.2%  │  12.4%   │
│         │          │         │  ⚠️     │  🟢      │          │
├─────────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│Congested│  0.0%    │  0.0%   │  2.1%   │  15.3%  │  82.6%   │
│         │          │         │         │         │  🟢      │
└─────────┴──────────┴─────────┴─────────┴─────────┴──────────┘

TỔNG KẾT:
✅ Overall Status Accuracy: 81.2%
   → 81.2% predictions DỰ ĐOÁN ĐÚNG mức độ giao thông

⚠️ VẤN ĐỀ PHÁT HIỆN:
   - 12.1% Smooth nhầm thành Moderate (threshold gần nhau)
   - 15.2% Moderate nhầm thành Smooth (tương tự)
   
💡 GIẢI PHÁP:
   1. Điều chỉnh thresholds: 0.60 → 0.62, 0.75 → 0.77
   2. Thêm hysteresis (vùng đệm) để tránh flip-flop
   3. Smooth predictions (moving average) trước khi classify
```

**Metrics summary:**
```python
{
    "overall_status_accuracy": 81.2,
    "critical_errors": {
        "free_to_congested": 0.0,  # ✅ Không có sai lầm nghiêm trọng
        "congested_to_free": 0.0
    },
    "adjacent_confusion": {
        "smooth_moderate": 12.1,  # ⚠️ Nhầm giữa 2 level kề nhau
        "moderate_smooth": 15.2
    }
}
```

---

### 7. DATA COVERAGE & FRESHNESS (Health Check) ⭐⭐⭐

```sql
-- Verification Rate
SELECT 
    COUNT(*) as total_predictions,
    COUNT(*) FILTER (WHERE error_value IS NOT NULL) as verified,
    COUNT(*) FILTER (WHERE error_value IS NULL) as pending,
    ROUND(COUNT(*) FILTER (WHERE error_value IS NOT NULL)::numeric / COUNT(*) * 100, 1) as verification_rate
FROM camera_forecasts
WHERE forecast_for_time >= NOW() - INTERVAL '7 days';

-- Freshness
SELECT 
    MAX(created_at) as last_updated,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_ago
FROM camera_forecasts
WHERE error_value IS NOT NULL;
```

**Hiển thị:**
```
📈 DATA QUALITY METRICS

Verification Rate: 92.3% (26,234/28,400 predictions)
  ✅ 26,234 predictions đã verify
  ⏳ 2,166 predictions đang chờ sync actual values
  
Last Update: 2 phút trước
  Status: 🟢 HEALTHY (Real-time monitoring active)

⚠️ WARNINGS:
  - 5 cameras có <80% verification rate → Check sync_actual_values()
  - Horizon 60m có 15% pending (do mất >1h mới có actual) → Normal
```

---

## 🎨 UI Design - Dashboard Layouts

### Layout 1: Overview Page

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 MODEL PERFORMANCE DASHBOARD                    Last 7 days │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ MAE        │ │ MAPE       │ │ Accuracy   │ │ Status Acc │  │
│  │            │ │            │ │            │ │            │  │
│  │  ±3.2 xe   │ │   8.5%     │ │   78.5%    │ │   81.2%    │  │
│  │  🟢 Good   │ │  🟢 Good   │ │   ≤5xe     │ │  🟢 Good   │  │
│  │            │ │            │ │            │ │            │  │
│  │ vs 3.8 ↓   │ │ vs 9.1% ↓  │ │ vs 75.2%↑  │ │ vs 78.9%↑  │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📈 ERROR BY HORIZON                                       │ │
│  │                                                            │ │
│  │   10xe ┤                                    ●              │ │
│  │    8xe ┤                            ●                      │ │
│  │    6xe ┤                    ●                              │ │
│  │    4xe ┤            ●                                      │ │
│  │    2xe ┤    ●                                              │ │
│  │     0xe└─────┬─────┬─────┬─────┬─────┐                    │ │
│  │            5m   10m  15m  30m  60m                         │ │
│  │                                                            │ │
│  │  💡 Horizon 60m có error gấp 3.3x so với 5m               │ │
│  │     → Recommend: Chỉ giữ horizons ≤15m                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🎯 STATUS CONFUSION MATRIX (Heatmap)                      │ │
│  │                                                            │ │
│  │        Predicted →                                         │ │
│  │ Actual  Free  Smooth  Moderate  Heavy  Congest            │ │
│  │   ↓                                                        │ │
│  │ Free    95%    4%      1%       0%      0%                 │ │
│  │ Smooth   8%   78%     12%       1%      0%                 │ │
│  │ Moderate 0%   15%     73%      11%      1%                 │ │
│  │ Heavy    0%    1%     18%      68%     13%                 │ │
│  │ Congest  0%    0%      2%      15%     83%                 │ │
│  │                                                            │ │
│  │  Overall Accuracy: 81.2%                                   │ │
│  │  ⚠️ Main Confusion: Smooth ↔ Moderate (13.5%)             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Layout 2: Horizon Analysis Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ⏱️  HORIZON COMPARISON & RECOMMENDATIONS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Horizon │ Checks │ MAE   │ Median│ P95  │ Acc≤5xe│ Action │ │
│  ├─────────┼────────┼───────┼───────┼──────┼────────┼────────┤ │
│  │  5m     │ 5,432  │2.8 xe │2.1 xe │ 7.2xe│ 82.3%  │ ✅ KEEP│ │
│  │  10m    │ 5,428  │3.5 xe │2.9 xe │ 8.5xe│ 76.1%  │ ✅ KEEP│ │
│  │  15m    │ 5,421  │4.2 xe │3.5 xe │10.1xe│ 68.5%  │ 🟡 OPT │ │
│  │  30m    │ 5,410  │6.7 xe │5.2 xe │15.3xe│ 52.3%  │ ❌ DROP│ │
│  │  60m    │ 5,395  │9.3 xe │7.8 xe │21.7xe│ 38.9%  │ ❌ DROP│ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 💡 RECOMMENDATIONS                                         │ │
│  │                                                            │ │
│  │ Based on 7-day analysis (27,086 predictions):             │ │
│  │                                                            │ │
│  │ ✅ KEEP horizons 5m & 10m:                                │ │
│  │    - MAE < 4 xe (excellent accuracy)                      │ │
│  │    - 75%+ predictions within ±5 xe                        │ │
│  │    - Reliable for real-time decisions                     │ │
│  │                                                            │ │
│  │ 🟡 OPTIONAL horizon 15m:                                  │ │
│  │    - Acceptable MAE (~4 xe)                               │ │
│  │    - Useful for medium-term planning                      │ │
│  │    - Keep if storage not a concern                        │ │
│  │                                                            │ │
│  │ ❌ DROP horizons 30m & 60m:                               │ │
│  │    - MAE > 6 xe (poor accuracy)                           │ │
│  │    - Only 40-52% within ±5 xe tolerance                   │ │
│  │    - Not reliable for operational use                     │ │
│  │    - Cleanup strategy: Delete after 3 days                │ │
│  │                                                            │ │
│  │ 📊 IMPACT:                                                 │ │
│  │    - Storage reduction: ~60% (drop 2/5 horizons)          │ │
│  │    - Dashboard accuracy boost: 78.5% → 84.2%              │ │
│  │    - User trust improvement: Focus on reliable data       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Layout 3: Camera Ranking Page

```
┌─────────────────────────────────────────────────────────────────┐
│  📹 CAMERA PERFORMANCE RANKING                  Last 7 days    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔍 [All Cameras ▼] [Horizon: 5m ▼] [Sort: MAE ▼]              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ✅ TOP 5 BEST PERFORMING CAMERAS                          │ │
│  ├────┬───────────────────────────────┬──────┬───────┬──────┤ │
│  │Rank│ Camera                        │ MAE  │ Acc≤5 │Checks│ │
│  ├────┼───────────────────────────────┼──────┼───────┼──────┤ │
│  │ 🥇 │ Trần Quang Khải - TKChân      │2.1xe │ 92.3% │ 1,087│ │
│  │ 🥈 │ Điện Biên Phủ - NBKhiêm        │2.5xe │ 88.1% │ 1,084│ │
│  │ 🥉 │ Hai Bà Trưng - TCVân           │2.8xe │ 85.7% │ 1,082│ │
│  │  4 │ Tôn Đức Thắng - CTMLình        │3.1xe │ 83.2% │ 1,079│ │
│  │  5 │ Nam Kỳ Khởi Nghĩa - LCThắng    │3.4xe │ 81.5% │ 1,076│ │
│  └────┴───────────────────────────────┴──────┴───────┴──────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ❌ TOP 5 CAMERAS NEEDING IMPROVEMENT                      │ │
│  ├────┬───────────────────────────────┬──────┬───────┬──────┤ │
│  │Rank│ Camera                        │ MAE  │ Acc≤5 │Issue │ │
│  ├────┼───────────────────────────────┼──────┼───────┼──────┤ │
│  │ 20 │ Phạm Văn Đồng - QL13          │11.3xe│ 28.5% │Light │ │
│  │ 19 │ Kha Vạn Cân - VVNgân           │ 9.8xe│ 35.2% │Occlu │ │
│  │ 18 │ QL13 - Cầu Ông Dầu             │ 8.5xe│ 41.7% │Varia │ │
│  │ 17 │ Nút Hàng Xanh 5                │ 7.2xe│ 48.3% │Layou │ │
│  │ 16 │ Tô Ngọc Vân - TX25             │ 6.9xe│ 51.1% │Weath │ │
│  └────┴───────────────────────────────┴──────┴───────┴──────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔧 RECOMMENDED ACTIONS FOR POOR PERFORMERS                │ │
│  │                                                            │ │
│  │ Camera: Phạm Văn Đồng - QL13 (MAE: 11.3 xe)              │ │
│  │ Issue: Low light conditions (evening/night)               │ │
│  │ Actions:                                                   │ │
│  │   1. ✅ Adjust camera exposure settings                   │ │
│  │   2. ✅ Add IR illumination if possible                   │ │
│  │   3. ⚠️ Consider excluding night predictions             │ │
│  │   4. 🔬 Retrain with night-specific features             │ │
│  │                                                            │ │
│  │ Camera: Kha Vạn Cân - VVNgân (MAE: 9.8 xe)               │ │
│  │ Issue: Occlusion by trees/signs                           │ │
│  │ Actions:                                                   │ │
│  │   1. 🔧 Physical adjustment: Reposition camera            │ │
│  │   2. 🌳 Trim vegetation blocking view                     │ │
│  │   3. 🔬 Retrain with partial occlusion handling          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Implementation Plan

### Phase 1: Backend Service (Python)

#### File: `backend/src/model-performance/analyze_metrics.py`

```python
"""
Service tính toán performance metrics cho ML model
Chạy định kỳ (mỗi 1 giờ) hoặc on-demand qua API
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List
import pandas as pd
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelPerformanceAnalyzer:
    def __init__(self, db_connection_string: str):
        self.engine = create_engine(db_connection_string)
    
    def calculate_overall_metrics(self, period_days: int = 7) -> Dict:
        """Tính MAE, RMSE, MAPE, Accuracy rates"""
        query = text("""
            SELECT 
                COUNT(*) as total_predictions,
                ROUND(AVG(ABS(error_value)), 2) as mae,
                ROUND(SQRT(AVG(POWER(error_value, 2))), 2) as rmse,
                ROUND(AVG(ABS(error_value) / NULLIF(actual_value, 0) * 100), 2) as mape,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 10)::numeric / COUNT(*) * 100, 1) as accuracy_10xe,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 15)::numeric / COUNT(*) * 100, 1) as accuracy_15xe
            FROM camera_forecasts
            WHERE error_value IS NOT NULL
              AND forecast_for_time >= NOW() - INTERVAL ':days days'
        """)
        
        with self.engine.connect() as conn:
            result = conn.execute(query, {"days": period_days}).fetchone()
            return dict(result._mapping)
    
    def analyze_by_horizon(self, period_days: int = 7) -> List[Dict]:
        """Phân tích từng horizon"""
        query = text("""
            SELECT 
                horizon_minutes,
                COUNT(*) as total_predictions,
                ROUND(AVG(error_value), 2) as avg_error,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY error_value), 2) as median_error,
                ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY error_value), 2) as p95_error,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe
            FROM camera_forecasts
            WHERE error_value IS NOT NULL
              AND forecast_for_time >= NOW() - INTERVAL ':days days'
            GROUP BY horizon_minutes
            ORDER BY horizon_minutes
        """)
        
        with self.engine.connect() as conn:
            results = conn.execute(query, {"days": period_days}).fetchall()
            return [dict(row._mapping) for row in results]
    
    def rank_cameras(self, period_days: int = 7, limit: int = 5) -> Dict:
        """Top best & worst cameras"""
        query = text("""
            SELECT 
                c.camera_id,
                cd.display_name,
                COUNT(*) as predictions_count,
                ROUND(AVG(c.error_value), 2) as avg_error,
                ROUND(COUNT(*) FILTER (WHERE c.error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe
            FROM camera_forecasts c
            LEFT JOIN camera_data cd ON c.camera_id = cd.cam_id
            WHERE c.error_value IS NOT NULL
              AND c.forecast_for_time >= NOW() - INTERVAL ':days days'
            GROUP BY c.camera_id, cd.display_name
            ORDER BY avg_error ASC
        """)
        
        with self.engine.connect() as conn:
            all_results = conn.execute(query, {"days": period_days}).fetchall()
            best = [dict(row._mapping) for row in all_results[:limit]]
            worst = [dict(row._mapping) for row in all_results[-limit:][::-1]]
            
            return {"best": best, "worst": worst}
    
    def calculate_status_accuracy(self, period_days: int = 7) -> Dict:
        """Status confusion matrix"""
        # TODO: Implement with capacity calculation
        pass
    
    def get_full_report(self, period_days: int = 7) -> Dict:
        """Tổng hợp toàn bộ metrics"""
        logger.info(f"Generating performance report for last {period_days} days...")
        
        report = {
            "period_days": period_days,
            "generated_at": datetime.now().isoformat(),
            "overall": self.calculate_overall_metrics(period_days),
            "by_horizon": self.analyze_by_horizon(period_days),
            "camera_ranking": self.rank_cameras(period_days),
            # "status_accuracy": self.calculate_status_accuracy(period_days),
        }
        
        logger.info("Report generated successfully")
        return report


# Usage
if __name__ == "__main__":
    analyzer = ModelPerformanceAnalyzer("postgresql://...")
    report = analyzer.get_full_report(period_days=7)
    print(report)
```

---

#### File: `backend/src/model-performance/update_fiware.py`

```python
"""
Gửi metrics lên FIWARE Orion để Frontend nhận qua Socket
"""

import aiohttp
import asyncio
from analyze_metrics import ModelPerformanceAnalyzer

FIWARE_ORION_URL = "http://orion:1026/v2/entities"


async def update_metrics_to_fiware(metrics: dict):
    """
    Gửi metrics lên FIWARE
    Entity ID: urn:ngsi-ld:ModelMetrics:performance
    """
    entity_id = "urn:ngsi-ld:ModelMetrics:performance"
    
    payload = {
        "id": entity_id,
        "type": "ModelMetrics",
        "overall": {
            "type": "StructuredValue",
            "value": metrics["overall"]
        },
        "by_horizon": {
            "type": "StructuredValue",
            "value": metrics["by_horizon"]
        },
        "camera_ranking": {
            "type": "StructuredValue",
            "value": metrics["camera_ranking"]
        },
        "last_updated": {
            "type": "DateTime",
            "value": metrics["generated_at"]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "fiware-service": "traffic_monitor",
        "fiware-servicepath": "/"
    }
    
    async with aiohttp.ClientSession() as session:
        url = f"{FIWARE_ORION_URL}?options=upsert"
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status in [201, 204]:
                print("✅ Metrics updated to FIWARE")
            else:
                error = await resp.text()
                print(f"❌ FIWARE Error: {resp.status} - {error}")


async def run_metrics_update_cycle():
    """Chạy định kỳ mỗi 1 giờ"""
    analyzer = ModelPerformanceAnalyzer("postgresql://...")
    
    while True:
        try:
            report = analyzer.get_full_report(period_days=7)
            await update_metrics_to_fiware(report)
            print("✅ Metrics cycle completed")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Sleep 1 hour
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(run_metrics_update_cycle())
```

---

### Phase 2: Frontend Implementation

#### File: `web/web-user/src/contexts/MetricsContext.tsx`

```typescript
/**
 * Context để nhận metrics từ FIWARE qua Socket
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext';

interface ModelMetrics {
  overall: {
    mae: number;
    mape: number;
    accuracy_5xe: number;
    accuracy_10xe: number;
  };
  by_horizon: Array<{
    horizon_minutes: number;
    avg_error: number;
    accuracy_5xe: number;
  }>;
  camera_ranking: {
    best: Array<{ camera_id: string; display_name: string; avg_error: number }>;
    worst: Array<{ camera_id: string; display_name: string; avg_error: number }>;
  };
  last_updated: string;
}

const MetricsContext = createContext<ModelMetrics | null>(null);

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Subscribe to ModelMetrics entity
    socket.on('METRICS_UPDATED', (data: any) => {
      const processed: ModelMetrics = {
        overall: data.overall.value,
        by_horizon: data.by_horizon.value,
        camera_ranking: data.camera_ranking.value,
        last_updated: data.last_updated.value,
      };
      setMetrics(processed);
    });

    return () => {
      socket.off('METRICS_UPDATED');
    };
  }, [socket]);

  return (
    <MetricsContext.Provider value={metrics}>
      {children}
    </MetricsContext.Provider>
  );
}

export const useModelMetrics = () => useContext(MetricsContext);
```

---

#### File: `web/web-user/src/pages/model-performance.tsx`

```typescript
/**
 * Dashboard page hiển thị performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useModelMetrics } from '@/contexts/MetricsContext';

export default function ModelPerformancePage() {
  const metrics = useModelMetrics();

  if (!metrics) {
    return <div>Đang tải metrics...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Hiệu suất Model Dự đoán</h1>

      {/* Overall Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="MAE"
          value={`±${metrics.overall.mae} xe`}
          status={metrics.overall.mae < 5 ? 'good' : 'fair'}
        />
        <MetricCard
          title="MAPE"
          value={`${metrics.overall.mape}%`}
          status={metrics.overall.mape < 10 ? 'good' : 'fair'}
        />
        <MetricCard
          title="Accuracy ≤5xe"
          value={`${metrics.overall.accuracy_5xe}%`}
          status={metrics.overall.accuracy_5xe > 75 ? 'good' : 'fair'}
        />
        <MetricCard
          title="Accuracy ≤10xe"
          value={`${metrics.overall.accuracy_10xe}%`}
          status={metrics.overall.accuracy_10xe > 90 ? 'good' : 'fair'}
        />
      </div>

      {/* Horizon Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>So sánh theo Horizon</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizonComparisonChart data={metrics.by_horizon} />
        </CardContent>
      </Card>

      {/* Camera Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>✅ Top Cameras Tốt Nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <CameraRankingTable cameras={metrics.camera_ranking.best} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>❌ Cameras Cần Cải Thiện</CardTitle>
          </CardHeader>
          <CardContent>
            <CameraRankingTable cameras={metrics.camera_ranking.worst} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### Phase 3: K8s CronJob

#### File: `k8s-configs/model-performance-cronjob.yaml`

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: model-performance
  namespace: backend
spec:
  # Chạy mỗi 1 giờ
  schedule: "0 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: model-performance
              image: devmindtan/dev-repo:model-performance-v1.0.0
              env:
                - name: POSTGRES_HOST
                  value: "postgres-postgresql.database.svc.cluster.local"
                - name: POSTGRES_DBS
                  value: "kltn_db"
                - name: POSTGRES_USERNAME
                  value: "admin"
                - name: POSTGRES_PASSWORD
                  value: "minhtan2003"
                - name: FIWARE_ORION_BASE
                  value: "orion-service.database.svc.cluster.local:1026"
          restartPolicy: OnFailure
```

---

## 📋 Checklist Implementation

### Backend
- [ ] Tạo folder `backend/src/model-performance/`
- [ ] Implement `analyze_metrics.py` với 6 methods chính
- [ ] Implement `update_fiware.py` để gửi metrics
- [ ] Tạo `requirements.txt` (sqlalchemy, pandas, aiohttp)
- [ ] Tạo `Dockerfile` cho service
- [ ] Test queries trên DB thật để verify kết quả

### FIWARE
- [ ] Định nghĩa Entity schema `ModelMetrics`
- [ ] Test upsert metrics vào Orion
- [ ] Verify Socket emit events cho Frontend

### Frontend
- [ ] Tạo `MetricsContext.tsx` để subscribe Socket
- [ ] Implement `model-performance.tsx` page
- [ ] Tạo components: `MetricCard`, `HorizonComparisonChart`, `CameraRankingTable`
- [ ] Thêm route `/performance` vào router
- [ ] Thêm menu item "Hiệu suất Model" vào sidebar

### K8s
- [ ] Tạo `model-performance-cronjob.yaml`
- [ ] Build & push Docker image
- [ ] Deploy cronjob vào cluster
- [ ] Test manual trigger: `kubectl create job --from=cronjob/model-performance test-run -n backend`

### Documentation
- [ ] Update `FUNCTION_LIST.md` với functions mới
- [ ] Update `AGENT_LOG.md` sau khi hoàn thành
- [ ] Tạo `backend/src/model-performance/commands/README.md` giải thích service

---

## 🎯 Expected Outcomes

### Quantitative
- **Storage optimization:** Giảm 40-60% dung lượng bảng `camera_forecasts` (sau khi drop horizons kém)
- **Dashboard accuracy:** Tăng từ ~78% → ~84% (chỉ hiển thị reliable predictions)
- **User trust:** Metrics transparency → tăng confidence trong decisions

### Qualitative
- **Data-driven decisions:** Biết chính xác horizons/cameras nào cần cải thiện
- **Model monitoring:** Real-time tracking performance degradation
- **Continuous improvement:** Feedback loop để retrain model

---

## 🚨 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Query quá chậm (>30s) | Timeout, UI lag | Add indexes, optimize queries, cache results |
| Capacity calculation sai | Status accuracy metrics sai | Verify với `los_utils.py` actual logic |
| Socket overload | Frontend slow | Chỉ emit khi metrics thay đổi >5% |
| Cronjob failed | Metrics outdated | Alert on Slack/Email + manual trigger option |

---

## 📚 References

- **DATABASE_SCHEMA.md** - Cấu trúc bảng `camera_forecasts`, `camera_data`
- **FUNCTION_LIST.md** - Các functions hiện có (`calculate_los_status`, `get_camera_capacity_map`)
- **AGENT_LOG.md** - Lịch sử thay đổi logic (LOS, Capacity, Trend)
- **FIWARE_ORION_DATA_TEMPLATE.md** - Schema entities hiện tại

---

**Next Steps:**
1. Review design document này
2. Xác nhận metrics nào MUST HAVE vs NICE TO HAVE
3. Bắt đầu implement Phase 1 (Backend) trước
4. Iterative development: Test → Refine → Deploy
