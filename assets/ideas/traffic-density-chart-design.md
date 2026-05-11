# Traffic Density Chart – Phase 2: Real Data (Phương án C: MV + Node.js Refresh)

**Trạng thái**: Thiết kế hoàn chỉnh – Sẵn sàng implement  
**Phương án**: Materialized Views scoped theo chu kỳ + Node.js `setInterval` refresh (không dùng k8s CronJob)  
**Cập nhật**: 07/03/2026 — Thay thế Phương án B (Direct Query) do full-scan không dùng được index

---

## Tại sao phải đổi phương án

Phương án B (Direct Query) fail vì:
```sql
-- EXTRACT là function-based filter → PostgreSQL KHÔNG dùng được index dù đã có
AND EXTRACT(HOUR FROM (created_at + $1::interval)) BETWEEN 6 AND 23
```
PostgreSQL **bắt buộc evaluate từng row** trong date range sau khi loc bằng index `created_at`. Tab `month` (all cameras) = scan ~2.5M rows + gọi function mỗi row → connection drop.

**Phương án C**: MV thực hiện computation nặng 1 lần lúc REFRESH (background), API chỉ `SELECT * FROM mv WHERE camera_id = ?` → instant.

---

## 1. MV Schema + SQL (tạo file migration mới)

**File**: `backend/server/src/migrations/002_traffic_pattern_views.sql`  
**Timezone**: hardcode `+ INTERVAL '7 hours'` (UTC+7 = Vietnam) trong MV definition

> MV lưu data đã aggregate sẵn theo **chu kỳ hiện tại** (không rolling window).  
> REFRESH sẽ tự cập nhật scope khi chạy lại (vì dùng `NOW()` relative trong WHERE).

```sql
-- ─────────────────────────────────────────────────────────────
-- Helpers UTC math (UTC+7 hardcoded):
--   today VN 6:00 in UTC  = DATE_TRUNC('day',  NOW() + '7h') - '1h'
--   today VN midnight UTC = DATE_TRUNC('day',  NOW() + '7h') - '7h'
--   week  VN Mon 6:00 UTC = DATE_TRUNC('week', NOW() + '7h') - '1h'
--   month VN 1st  6:00 UTC = DATE_TRUNC('month',NOW() + '7h') - '1h'
--   year  VN Jan1 6:00 UTC = DATE_TRUNC('year', NOW() + '7h') - '1h'
-- ─────────────────────────────────────────────────────────────

-- MV 1: Theo GIỜ — scope: hôm nay 6:00 VN → đầu giờ hiện tại VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_hour AS
SELECT
  EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours'))::INT  AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('day',  NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('hour', NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hour ON mv_traffic_by_hour (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_hour;

-- MV 2: Theo NGÀY trong tuần — scope: tuần này T2 6:00 VN → hôm qua 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_dow AS
SELECT
  EXTRACT(ISODOW FROM (created_at + INTERVAL '7 hours'))::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('week', NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('day',  NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dow ON mv_traffic_by_dow (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_dow;

-- MV 3: Theo TUẦN trong tháng — scope: đầu tháng 6:00 VN → hôm qua 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_week_of_month AS
SELECT
  CEIL(EXTRACT(DAY FROM (created_at + INTERVAL '7 hours')) / 7.0)::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('month', NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('day',   NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_week ON mv_traffic_by_week_of_month (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_week_of_month;

-- MV 4: Theo THÁNG trong năm — scope: đầu năm 6:00 VN → cuối tháng trước 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_month AS
SELECT
  EXTRACT(MONTH FROM (created_at + INTERVAL '7 hours'))::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('year',  NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('month', NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_month ON mv_traffic_by_month (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_month;
```

> **REFRESH order**: CREATE MV (empty) → CREATE UNIQUE INDEX (trên empty, OK) → REFRESH (initial, NOT CONCURRENTLY) → sau đó mọi refresh tiếp theo dùng CONCURRENTLY.

---

## 2. Quy tắc dữ liệu (không đổi)

| Tab | Phạm vi MV | Khung giờ | Dữ liệu |
|-----|-----------|-----------|---------|
| `hour` | Hôm nay 6:00 → đầu giờ hiện tại | 6:00–23:00 | Từng giờ hôm nay đã hoàn thành |
| `dow` | Đầu tuần (T2) 6:00 → hôm qua 24:00 | 6:00–23:00 | Các ngày của tuần này đã qua |
| `week` | Đầu tháng 6:00 → hôm qua 24:00 | 6:00–23:00 | Các tuần của tháng này đã qua |
| `month` | Đầu năm 6:00 → cuối tháng trước 24:00 | 6:00–23:00 | Các tháng của năm này đã qua |

- **Timezone hardcode UTC+7** trong MV (dự án Việt Nam)
- `time_range` label vẫn được tính động bằng `getTimeRange()` dùng `tz` param từ frontend

---

## 3. Backend Node.js

### 3.1 Controller – `traffic-pattern.controller.ts` (REWRITE lần 2)

**Trở lại VIEW_MAP + query đơn giản từ MV** (tương tự Phase A nhưng scoped):

```typescript
const VIEW_MAP: Record<string, string> = {
  hour:          "mv_traffic_by_hour",
  dow:           "mv_traffic_by_dow",
  week_of_month: "mv_traffic_by_week_of_month",
  month:         "mv_traffic_by_month",
}
```

**Query từ MV** (instant — không heavy compute):
```sql
-- camera_id = "all": aggregate qua tất cả cameras
SELECT dimension_value,
       ROUND(AVG(avg_vehicles)::NUMERIC, 1) AS avg_vehicles,
       MAX(max_vehicles)                    AS max_vehicles,
       SUM(sample_count)::INT               AS sample_count
FROM <view_name>
GROUP BY dimension_value ORDER BY dimension_value

-- camera_id cụ thể: filter
SELECT dimension_value, avg_vehicles, max_vehicles, sample_count
FROM <view_name>
WHERE camera_id = $1
ORDER BY dimension_value
```

**Label mapping** (không đổi):
```typescript
const DOW_LABELS   = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"]
const WEEK_LABELS  = ["", "Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4", "Tuần 5"]
const MONTH_LABELS = ["", "T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"]
// hour: dimension_value đã là giờ VN → "06:00", "07:00", ..., "23:00"
```

**`getTimeRange()`** — vẫn giữ để tính `time_range` label cho response:
```typescript
// Tính label hiển thị UI theo tz param từ frontend
// time_range label KHÔNG liên quan đến query vào MV
function getTimeRange(type: PatternType, tzMinutes: number): { from: string; to: string }
```

### 3.2 Startup + Refresh – trong `traffic-pattern.controller.ts`

```typescript
const MV_NAMES = [
  "mv_traffic_by_hour",
  "mv_traffic_by_dow",
  "mv_traffic_by_week_of_month",
  "mv_traffic_by_month",
] as const;

/**
 * Kiểm tra MV tồn tại, tạo mới nếu chưa có (bao gồm initial REFRESH)
 * Gọi trong server startup — blocking lần đầu, log progress
 */
export async function ensureTrafficPatternMV(dbPool: Pool): Promise<void> {
  const { rows } = await dbPool.query(
    `SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_traffic_by_hour'`
  );
  if (rows.length === 0) {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "002_traffic_pattern_views.sql"), "utf8"
    );
    await dbPool.query(sql);
    console.log("[traffic-pattern] Materialized views created + initial refresh done ✅");
  } else {
    console.log("[traffic-pattern] Materialized views already exist ✅");
  }
}

/**
 * Bắt đầu Node.js timer refresh MV mỗi 30 phút (thay thế k8s CronJob)
 * Dùng CONCURRENTLY để không block read queries trong lúc refresh
 */
export function startTrafficPatternRefresh(dbPool: Pool): void {
  const INTERVAL_MS = 30 * 60 * 1000; // 30 phút
  setInterval(async () => {
    const start = Date.now();
    try {
      for (const mv of MV_NAMES) {
        await dbPool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`);
      }
      console.log(`[traffic-pattern] Views refreshed in ${Date.now() - start}ms`);
    } catch (err) {
      console.error("[traffic-pattern] Refresh failed:", err);
    }
  }, INTERVAL_MS);
  console.log("[traffic-pattern] Auto-refresh every 30 min started ⏱️");
}
```

### 3.3 Cập nhật `index.ts`

```typescript
// Sau pool connect:
await ensureTrafficPatternMV(pool);
startTrafficPatternRefresh(pool);
```

### 3.4 API Response (giữ `time_range`)

```
GET /api/traffic/patterns?type=hour&camera_id=all&tz=-420
GET /api/traffic/patterns?type=dow&camera_id=<shortId>&tz=-420
GET /api/traffic/patterns?type=week_of_month&tz=-420
GET /api/traffic/patterns?type=month&tz=-420
```

```json
{
  "success": true,
  "type": "month",
  "camera_id": "all",
  "time_range": { "from": "06:00 01/01/2026", "to": "24:00 28/02/2026" },
  "data": [
    { "label": "T1", "avg_vehicles": 45.2, "max_vehicles": 134, "sample_count": 18400 }
  ],
  "meta": { "total_cameras": 20 }
}
```

---

## 4. Frontend (không thay đổi so với Phương án B)

- `traffic-pattern.service.ts`: interface giữ `time_range?: { from: string; to: string }`
- `traffic-density-chart.tsx`: giữ `timeRanges` state + hiển thị label

---

## 5. k8s

- **Không cần CronJob** — refresh được xử lý bởi `setInterval` trong Node.js process
- `traffic-pattern-cronjob.yaml` đã xóa (07/03/2026) — không cần tạo lại
- Indexes `idx_cam_det_cam_time` và `idx_cam_det_time` đã tạo thủ công — giữ nguyên

---

## 6. Checklist implement

```
Bước 1 – Tạo lại migration file:
  ✅ idx_cam_det_cam_time, idx_cam_det_time đã có
  □ Tạo backend/server/src/migrations/002_traffic_pattern_views.sql (nội dung Mục 1)

Bước 2 – Rewrite controller (traffic-pattern.controller.ts):
  □ Thêm lại VIEW_MAP
  □ Query từ MV (đơn giản — không heavy compute)
  □ Giữ getTimeRange() + fmtLocal() → chỉ dùng cho time_range label
  □ Thêm ensureTrafficPatternMV() — check pg_matviews, tạo nếu chưa có
  □ Thêm startTrafficPatternRefresh() — setInterval 30 phút REFRESH CONCURRENTLY
  □ Export cả 2 functions

Bước 3 – Update index.ts:
  □ Import ensureTrafficPatternMV + startTrafficPatternRefresh
  □ Gọi sau pool connect: ensure trước, start sau

Bước 4 – Frontend (không thay đổi logic):
  □ Verify traffic-pattern.service.ts còn đúng interface
  □ Verify traffic-density-chart.tsx còn hiển thị time_range label

Bước 5 – Deploy:
  □ Rebuild + push backend image
  □ Khi pod start: ensureTrafficPatternMV() tự tạo + refresh lần đầu (~vài phút)
  □ Verify: kubectl logs <server-pod> → thấy "Views refreshed in Xms"
  □ Test API: curl ".../api/traffic/patterns?type=month&tz=-420"
```

---

## 7. Ghi chú quan trọng

- **Timezone hardcode UTC+7 trong MV**: chấp nhận được vì dự án Vietnam. `time_range` label vẫn dynamic theo `tz` param
- **Lần đầu deploy**: initial REFRESH block ~vài giây→phút tùy data volume, server vẫn khởi động (async sau pool connect)
- **REFRESH CONCURRENTLY** yêu cầu UNIQUE INDEX đã tồn tại — đảm bảo bằng thứ tự trong SQL: CREATE MV → CREATE UNIQUE INDEX → REFRESH (first)
- **Stale data**: tối đa 30 phút — chấp nhận được vì chart là historical (không realtime)
- **Pod restart**: MV persist trong DB → không mất data, không cần recompute toàn bộ
- **Indexes `idx_cam_det_*`**: vẫn giữ — MV REFRESH cũng benefit từ index này khi re-scan `camera_detections`

