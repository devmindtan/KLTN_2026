# Forecast Rolling Chart - Mock Data

Mock data cho ForecastRollingChart component sử dụng **JSON file** thay vì generate tự động.

## File Structure

```
forecast/
├── forecast-rolling-chart.tsx      # Main component
├── forecast-mock-data.json         # Mock data (mô phỏng API response)
├── forecast-stat-cards.tsx         # Stats cards component
└── README.md                        # Hướng dẫn này
```

## Mock Data JSON Structure

```json
{
  "metadata": {
    "nowIndex": 108,        // Index slot hiện tại (108 = 15:00)
    "nowTime": "15:00",
    "timeRange": "06:00-23:55",
    "totalSlots": 216
  },
  "cameras": {
    "all": {
      "id": "all",
      "name": "Toàn mạng",
      "capacity": 75,
      "slots": [...]        // 216 slots từ 06:00-23:55
    },
    "662b86c4": { ... },    // Cầu Sài Gòn (chưa có data, fallback về "all")
    "7f3a19b2": { ... }     // Hàng Xanh (chưa có data, fallback về "all")
  }
}
```

### Slot Structure

Mỗi slot có format:

```json
{
  "t": "15:00",              // Time label (HH:MM)
  "actual": 65,              // Traffic thực tế (null nếu tương lai)
  "actualRef": 65,           // Baseline reference (có giá trị từ NOW trở đi)
  "currentRatio": 87,        // V/C ratio % (0-150)
  "f5m": 65,                 // Forecast +5 phút
  "f10m": 66,                // Forecast +10 phút
  "f15m": 67,                // Forecast +15 phút
  "f30m": 70,                // Forecast +30 phút
  "f60m": 72                 // Forecast +60 phút
}
```

## Cách Thay Đổi NOW_INDEX (Thời Gian Hiện Tại Mock)

### Trong JSON:

Sửa `metadata.nowIndex` trong `forecast-mock-data.json`:

```json
{
  "metadata": {
    "nowIndex": 108,  // ← Thay đổi giá trị này
    "nowTime": "15:00"
  }
}
```

### Công Thức Tính NOW_INDEX:

```
NOW_INDEX = (giờ - 6) × 12 + (phút ÷ 5)
```

**Ví dụ:**
- `06:00` → `(6-6)×12 + 0 = 0`
- `10:30` → `(10-6)×12 + 6 = 54`
- `15:00` → `(15-6)×12 + 0 = 108`
- `18:45` → `(18-6)×12 + 9 = 153`
- `23:50` → `(23-6)×12 + 10 = 214`

**Range hợp lệ:** 0-215 (tương ứng 06:00-23:55)

## Thêm Data Cho Camera Mới

1. Mở `forecast-mock-data.json`
2. Tìm section camera muốn thêm data (ví dụ: `"662b86c4"`)
3. Copy array `slots` từ camera `"all"`
4. Modify giá trị `actual`, `currentRatio`, forecast values để tạo traffic pattern riêng

**Ví dụ - Cầu Sài Gòn (cao điểm chiều 17:00-19:00):**

```json
"662b86c4": {
  "id": "662b86c4",
  "name": "Cầu Sài Gòn",
  "capacity": 75,
  "slots": [
    { "t": "06:00", "actual": 30, ... },
    { "t": "06:05", "actual": 32, ... },
    ...
    { "t": "17:00", "actual": 85, "currentRatio": 113, ... },  // Peak
    { "t": "17:05", "actual": 88, "currentRatio": 117, ... },
    ...
  ]
}
```

## Tips Tạo Realistic Mock Data

1. **Rush Hours**: Tăng `actual` và `currentRatio` vào giờ cao điểm (7-9h, 17-19h)
2. **Night Time**: Giảm traffic về đêm (21:00-06:00)
3. **Forecast Accuracy**: 
   - `f5m` gần `actual` nhất (error ~1-3%)
   - `f60m` xa `actual` nhất (error ~5-10%)
4. **currentRatio Thresholds**:
   - ≤30%: Thấp (màu xanh)
   - 31-70%: Trung bình (màu vàng)
   - 71-100%: Cao (màu cam)
   - >100%: Quá tải (màu đỏ)

## Khi Nào Forecast = null?

- Sau NOW_INDEX: forecast values chỉ tồn tại trong khoảng target horizon
  - Ví dụ: NOW=15:00, f60m chỉ có giá trị tại slots 15:05-16:00
  - Sau 16:00 → f60m = null (ngoài phạm vi +60 phút)

**Logic trong component:**
```typescript
// Tự động filter horizons vượt bounds
.filter(({ slots }) => NOW_INDEX + slots <= TOTAL_SLOTS)
```

## Testing Different Scenarios

### Test Case 1: Cuối ngày (NOW=23:50)
```json
"nowIndex": 214,  // Chỉ f5m forecast khả dụng (target=23:55)
```

### Test Case 2: Giữa ngày (NOW=12:00)
```json
"nowIndex": 72,   // Tất cả horizons khả dụng
```

### Test Case 3: Đầu ngày (NOW=06:15)
```json
"nowIndex": 3,    // Window bắt đầu từ 06:00 (không có data trước đó)
```

## Fallback Behavior

Nếu camera được chọn chưa có data trong JSON:
- Component tự động fallback về camera `"all"`
- Console không báo lỗi (graceful degradation)
- User vẫn thấy chart render bình thường

---

**Last Updated:** 15/03/2026  
**Related Files:** `forecast-rolling-chart.tsx`, `forecast-mock-data.json`
