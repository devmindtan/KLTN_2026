# Thảo luận: Cửa sổ dữ liệu cho Traffic Density Chart

## ✅ Tất cả đã quyết định — sẵn sàng implement

**Phương án**: Direct Query (bỏ Materialized Views + CronJob)  
**Khung giờ**: Tất cả tabs đều filter **6:00 → 24:00** (không lấy dữ liệu 0:00–5:59)  
**Dữ liệu**: Lịch sử đã hoàn thành — không tính giờ/ngày/tuần đang diễn ra  
**Time label**: Luôn có **giờ + ngày** trên UI cho tất cả tabs  
**Giá trị bar**: `AVG(total_objects)` — trung bình xe/lần ghi trong khung đó

---

## Phạm vi query từng tab

| Tab | WHERE filter | Time label mẫu |
|-----|-------------|----------------|
| Theo giờ | Hôm nay 6:00 → đầu giờ hiện tại | `06:00 07/03/2026 – 21:00 07/03/2026` |
| Theo ngày | Đầu tuần (T2) 6:00 → hôm qua 24:00 | `06:00 03/03/2026 – 24:00 06/03/2026` |
| Theo tuần | Đầu tháng 6:00 → hôm qua 24:00 | `06:00 01/03/2026 – 24:00 06/03/2026` |
| Theo tháng | Đầu năm 6:00 → cuối tháng trước 24:00 | `06:00 01/01/2026 – 24:00 28/02/2026` |

```sql
-- Áp dụng cho TẤT CẢ tabs: luôn filter từ 6:00 (UTC+7 → 23:00 UTC ngày hôm trước)
-- Ví dụ "theo tháng" với timezone UTC+7:
WHERE created_at >= DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC') + INTERVAL '23 hours'  -- 6:00 VN ngày 1/1
  AND created_at <  DATE_TRUNC('month', NOW())
  AND (EXTRACT(HOUR FROM created_at) >= 23   -- 6:00 VN = 23:00 UTC ngày hôm trước
       OR EXTRACT(HOUR FROM created_at) < 17) -- 24:00 VN = 17:00 UTC
```

> **Lưu ý timezone**: DB lưu UTC. 6:00 VN (UTC+7) = 23:00 UTC ngày trước. Backend nhận `tz` param từ frontend để tính đúng offset khi filter và generate label.

---

## Index bắt buộc (vì data ~2.5M rows/tháng)

Query tháng có thể scan **>2.5M rows** nếu không có index — **không thể dùng without index**.

```sql
-- Index composite bắt buộc thêm vào migration
CREATE INDEX IF NOT EXISTS idx_cam_det_cam_time
ON camera_detections (camera_id, created_at DESC);

-- Index cho query "all cameras" (không filter camera_id)
CREATE INDEX IF NOT EXISTS idx_cam_det_time
ON camera_detections (created_at DESC);
```

Với 2 index này:
- Query 1 camera (cả năm): scan ~50k rows (365 ngày × ~140 records/ngày/camera)
- Query all cameras (cả năm): scan ~1M rows nhưng index-only scan, rất nhanh
- Ước tính query time: **< 500ms** cho tháng, **< 100ms** cho ngày/tuần

---

## Thứ tự implement

1. **Migration**: Thêm 2 indexes + xóa/không tạo MV cũ
2. **Update controller**: Đổi query logic từ MV sang direct + timezone filter 6:00-24:00
3. **Update frontend**: Tính time range label (luôn có giờ+ngày) và truyền `tz`
4. **Xóa CronJob**: `traffic-pattern-cronjob.yaml` không cần deploy