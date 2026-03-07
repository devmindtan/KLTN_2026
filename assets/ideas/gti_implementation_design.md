# Thiết Kế Triển Khai General Trend Index (GTI) vào image-predict service

## Tổng Quan

Tài liệu này mô tả cách GTI được tích hợp vào pipeline dự đoán lưu lượng thực tế (`predict_realtime.py`), thay thế cách tính xu hướng cũ chỉ dùng mốc 5 phút.

---

## Vấn Đề Với Cách Cũ

```
# Cách cũ: chỉ so sánh current vs pred_5m
percent_change = ((pred_5m - current) / current) * 100
```

| Hạn chế | Giải thích |
|---------|-----------|
| Nhạy nhiễu | Dự đoán 5m biến động nhiều → xu hướng thay đổi liên tục |
| Bỏ sót thông tin | Không tận dụng 4 mốc dự đoán còn lại (10m, 15m, 30m, 60m) |
| Ngưỡng cứng (±10%) | Không chuẩn hóa theo capacity thực tế của từng camera |

---

## Giải Pháp: General Trend Index (GTI)

### Công Thức GTI

$$GTI = \frac{\sum_{i} P_i \times w_i}{Max} \times 100 \quad (\%)$$

- **P_i** – Giá trị dự đoán tại mốc *i*
- **w_i** – Trọng số của mốc *i*  
- **Max** – Capacity tối đa của camera (MAX 7 ngày qua)
- Điều kiện: $\sum w_i = 1.0$

### Bảng Trọng Số

| Mốc  | Trọng số | Lý do |
|------|----------|-------|
| 5m   | 0.35     | Tác động trực tiếp cao nhất |
| 10m  | 0.25     | Ngắn hạn, còn tin cậy |
| 15m  | 0.20     | Xu hướng gần |
| 30m  | 0.15     | Xu hướng trung bình |
| 60m  | 0.05     | Giảm nhiễu dài hạn |

### Công Thức Current Ratio

$$Current\_Ratio = \frac{Current}{Max} \times 100 \quad (\%)$$

### Quy Tắc Xác Định Xu Hướng

| Điều kiện | Kết quả |
|-----------|---------|
| GTI > Current\_Ratio + 5% | `increasing` |
| GTI < Current\_Ratio − 5% | `decreasing` |
| Chênh lệch trong ±5% | `stable` |

### Phân Loại Trạng Thái GTI

| GTI (%) | Trạng thái | Ý nghĩa |
|---------|-----------|---------|
| 0 – 30  | `thong_thoang` | Thông thoáng (Free Flow) |
| 31 – 60 | `binh_thuong`  | Bình thường (Stable) |
| 61 – 85 | `bat_dau_ket_xe` | Bắt đầu tắc nghẽn |
| > 85    | `nguy_co_ket_xe` | Nguy cơ tắc nghẽn cao |

---

## Kiến Trúc Code

```
backend/services/image-predict/app/
│
├── shared/
│   └── los_utils.py
│       ├── GTI_WEIGHTS                  # Trọng số 5 mốc (dict)
│       ├── GTI_STATE_THRESHOLDS         # Ngưỡng phân loại (dict)
│       ├── calculate_gti()              # Tính GTI (%) từ forecasts + capacity
│       ├── classify_gti_state()         # Phân loại: thong_thoang → nguy_co_ket_xe
│       └── calculate_trend_by_gti()     # Xu hướng: increasing | decreasing | stable
│
└── predict_realtime.py
    └── update_fiware()
        ├── calculate_los_status()       # Vẫn dùng → status_forecast (LOS 5m)
        └── calculate_trend_by_gti()     # MỚI → trend object với đầy đủ GTI metrics
```

---

## Cấu Trúc FIWARE Payload Mới

```json
{
  "prediction": {
    "value": {
      "input_value": 12.0,
      "forecasts": {
        "5m": 14.0,
        "10m": 18.0,
        "15m": 25.0,
        "30m": 20.0,
        "60m": 15.0
      },
      "status": {
        "forecast": "smooth",
        "calculation": {
          "predicted_volume": 14.0,
          "capacity": 50.0,
          "vc_ratio": 0.28
        }
      },
      "trend": {
        "direction": "increasing",
        "gti_state": "normal",
        "gti": 38.5,
        "current_ratio": 24.0,
          "diff": 14.5
      }
    }
  }
}
```

### So Sánh Payload Cũ vs Mới

| Field | Cũ | Mới |
|-------|-----|-----|
| `trend` | `"increasing"` (string) | Object đầy đủ GTI |
| Nguồn xu hướng | Chỉ pred_5m | Tổng hợp 5 mốc (GTI) |
| Ngưỡng so sánh | ±10% relative change | ±5% absolute ratio |
| Ngôn ngữ | Tiếng Anh | Tiếng Việt |
| Thông tin bổ sung | Không có | GTI%, Current Ratio%, Chênh lệch |

---

## Ví Dụ Tính Toán

**Input:**
- Current = 12 xe, Capacity = 50 xe

| Mốc | Dự đoán | Trọng số | Tích |
|-----|---------|----------|------|
| 5m  | 14      | 0.35     | 4.90 |
| 10m | 18      | 0.25     | 4.50 |
| 15m | 25      | 0.20     | 5.00 |
| 30m | 20      | 0.15     | 3.00 |
| 60m | 15      | 0.05     | 0.75 |
| **Tổng** | | **1.00** | **18.15** |

**GTI** = (18.15 / 50) × 100 = **36.3 %**

**Current Ratio** = (12 / 50) × 100 = **24.0 %**

**Chênh lệch** = 36.3 − 24.0 = **+12.3 %** > 5% → `direction = "increasing"`

**Trạng thái GTI** = 36.3% ∈ [31–60] → `"binh_thuong"`

---

## Luồng Xử Lý (Pipeline)

```
query_from_db_realtime()
        ↓
predict_realtime()          # 5 models → pred_5m, 10m, 15m, 30m, 60m
        ↓
run_cycle()
        ↓ for each camera
update_fiware(forecasts, capacity)
    ├── calculate_los_status(pred_5m, capacity)   → status_forecast (LOS)
    └── calculate_trend_by_gti(current, capacity, forecasts)
            ├── calculate_gti(forecasts, capacity) → GTI (%)
            ├── current_ratio = current/capacity×100
            ├── chenh_lech = GTI - current_ratio
            ├── xu_huong: tang | giam | on_dinh    (ngưỡng ±5%)
            └── trang_thai_gti: classify_gti_state(GTI)
        ↓
POST → FIWARE Orion (payload với trend object mới)
```

---

## Các Hàm Liên Quan

| Hàm | File | Mô tả |
|-----|------|-------|
| `calculate_gti()` | `shared/los_utils.py` | Tính GTI (%) từ forecasts + capacity |
| `classify_gti_state()` | `shared/los_utils.py` | Phân loại 4 mức trạng thái |
| `calculate_trend_by_gti()` | `shared/los_utils.py` | Kết hợp GTI + current_ratio → xu hướng |
| `update_fiware()` | `predict_realtime.py` | Gọi GTI, đóng gói payload, POST lên FIWARE |

---

## Ghi Chú Tương Thích Frontend

Payload `trend` đã thay đổi từ `string` → `object`. Frontend cần cập nhật cách đọc:

```ts
// CŨ
const trend = prediction.trend; // "increasing"

// MỚI
const { direction, gti_state, gti, current_ratio } = prediction.trend;
```

Ưu tiên hiển thị `direction` (xu hướng chính) và `gti_state` (màu badge) trên dashboard.

## Chỉnh sửa:
- Chỉnh sửa payload fiware và tên hàm tên biến không được ghi tiếng việt phải ghi thành tiếng anh chỉ khi hiển thị lên giao diện mới map thành tiếng việt