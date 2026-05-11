# Kế hoạch cải thiện Flow Dữ liệu Dự báo

> **Ngày**: 16/03/2026  
> **Trạng thái**: Kế hoạch – chờ duyệt trước khi thực hiện  
> **Scope**: 2 thay đổi độc lập, thực hiện theo thứ tự

---

## Vấn đề hiện tại

### Vấn đề 1 – Delay hiển thị chart

| Bước hiện tại | Thời gian |
|---|---|
| image-predict chạy & lưu DB | 0s |
| `refresh_forecast_mv()` chạy | ~2-4s |
| FIWARE Camera entity gửi đi | ~5-7s |
| CAMERA_UPDATED socket đến FE | ~5-8s |
| **FE không tự re-fetch `/api/forecast/rolling`** | **→ chart KHÔNG cập nhật** |
| User phải reload trang | **delay lên đến 5 phút** |

**Root cause**: `ForecastRollingChart` chỉ fetch API khi mount (`useEffect([], [])`). Sau khi image-predict chạy xong, chart không biết có data mới → **hiển thị data cũ**.

### Vấn đề 2 – Frontend xử lý quá nhiều logic phức tạp

Frontend (`forecast-rolling-chart.tsx`, `chart-area-interactive.tsx`) đang tự tính:

| Logic | Dòng code FE | Nên ở đâu |
|---|---|---|
| Tính `isFuture` cho từng slot | ~15 dòng | Backend |
| Tính `accuracyStatus` từ actual vs f5m | ~10 dòng | Backend |
| Tính LOS từ `currentRatio` | ~20 dòng | Backend |
| Build `horizonRows` table (slot offset -1 logic) | ~30 dòng | Backend |
| Tính window display logic | ~10 dòng | Backend |

→ Frontend bị ràng buộc vào business logic, khó maintain, dễ bug khi ngưỡng thay đổi.

---

## Thay đổi 1 – Cơ chế thông báo "Dự báo sẵn sàng"

### Flow mới

```
image-predict
  → lưu DB (camera_forecasts)
  → refresh_forecast_mv()                ← đã có
  → FIWARE Camera entity update          ← đã có  → CAMERA_UPDATED socket
  → FIWARE ForecastReady entity update   ← MỚI    → FORECAST_UPDATED socket

Frontend SocketContext
  → nghe FORECAST_UPDATED               ← MỚI
  → gọi GET /api/forecast/rolling       ← MỚI (re-fetch thay vì chỉ mount)
```

### Tại sao dùng entity riêng thay vì dùng CAMERA_UPDATED?

- `CAMERA_UPDATED` fire mỗi **5-30 giây** do image-process liên tục push snapshot
- `FORECAST_UPDATED` chỉ fire **mỗi 5 phút** khi dự báo hoàn thành → không flood re-fetch
- Tách biệt rõ: **realtime observation** (CAMERA) vs **batch forecast** (FORECAST)

### Cấu trúc ForecastReady entity

```json
{
  "id": "urn:ngsi-ld:ForecastReady:signal",
  "type": "ForecastReady",
  "triggered_at": {
    "type": "DateTime",
    "value": "2026-03-16T08:05:00.000Z"
  },
  "cycle_cameras": {
    "type": "Integer",
    "value": 20
  },
  "cycle_time_ms": {
    "type": "Integer",
    "value": 3240
  }
}
```

> Entity này chỉ là **tín hiệu thông báo**, không chứa dữ liệu dự báo.  
> Dữ liệu thực lấy qua `/api/forecast/rolling` sau khi FE nhận tín hiệu.

### Lệnh curl tạo FIWARE Subscription (chạy 1 lần trên cluster)

> Thay `<FIWARE_HOST>` = địa chỉ Orion Context Broker (vd: `10.0.0.5:1026`)  
> Thay `<APP_ROUTE_HOST>` = ClusterIP của app-route pod (vd: `10.96.x.x:5000`)

```bash
# Bước 1: Khởi tạo entity ForecastReady
curl -X POST 'http://<FIWARE_HOST>/v2/entities?options=upsert' \
  -H 'Content-Type: application/json' \
  -H 'fiware-service: traffic' \
  -H 'fiware-servicepath: /' \
  -d '{
    "id": "urn:ngsi-ld:ForecastReady:signal",
    "type": "ForecastReady",
    "triggered_at": { "type": "DateTime", "value": "2026-01-01T00:00:00.000Z" },
    "cycle_cameras": { "type": "Integer", "value": 0 },
    "cycle_time_ms": { "type": "Integer", "value": 0 }
  }'
```

```bash
# Bước 2: Tạo Subscription
curl -X POST 'http://<FIWARE_HOST>/v2/subscriptions' \
  -H 'Content-Type: application/json' \
  -H 'fiware-service: traffic' \
  -H 'fiware-servicepath: /' \
  -d '{
    "description": "Notify app-route khi image-predict hoàn thành chu kỳ dự báo",
    "subject": {
      "entities": [{ "id": "urn:ngsi-ld:ForecastReady:signal", "type": "ForecastReady" }],
      "condition": { "attrs": ["triggered_at"] }
    },
    "notification": {
      "http": { "url": "http://<APP_ROUTE_HOST>:5000/webhook" },
      "attrs": ["triggered_at", "cycle_cameras", "cycle_time_ms"]
    },
    "throttling": 30
  }'
```

```bash
# Kiểm tra subscription
curl 'http://<FIWARE_HOST>/v2/subscriptions' \
  -H 'fiware-service: traffic' \
  -H 'fiware-servicepath: /'
```

> `"throttling": 30` → Tối thiểu 30 giây giữa 2 notifications, tránh flood.

### Các file cần thay đổi

| File | Thay đổi |
|---|---|
| `backend/services/image-predict/app/predict_realtime.py` | Thêm `push_forecast_ready(session, camera_count, elapsed_ms)`, gọi sau `asyncio.gather(*tasks)` |
| `backend/services/app-route/app/main.py` | Thêm `elif entity_type == 'ForecastReady': socketio.emit('FORECAST_UPDATED', ...)` |
| `web/src/contexts/SocketContext.tsx` | Thêm `forecastVersion` state, listener `FORECAST_UPDATED` → bump version, expose trong context |
| `web/src/components/dashboard/forecast/forecast-rolling-chart.tsx` | Đổi `useEffect([], [])` → `useEffect([forecastVersion], ...)` |
| `web/src/components/dashboard/overview/chart-area-interactive.tsx` | Tương tự trên |

---

## Thay đổi 2 – API Rolling pre-format data

### Triết lý phân chia trách nhiệm

| Trách nhiệm | Backend | Frontend |
|---|---|---|
| Tính `isFuture` | ✅ | ❌ |
| Tính `los`, `losLabel` | ✅ | ❌ |
| Tính `accuracyStatus` | ✅ | ❌ |
| Build `horizonRows` (bảng 5 mốc) | ✅ | ❌ |
| Set `actualRef` cho future slots | ✅ | ❌ |
| Áp dụng màu sắc theo LOS | ❌ | ✅ |
| Animation, layout, responsive | ❌ | ✅ |

### Output mới `GET /api/forecast/rolling`

```json
{
  "success": true,
  "metadata": {
    "nowIndex": 108,
    "nowTime": "15:00",
    "totalSlots": 216,
    "timeRange": { "start": "07:00", "end": "23:55" },
    "generatedAt": "2026-03-16T08:05:00.123Z"
  },
  "cameras": {
    "all": {
      "capacity": 95,
      "slots": [
        {
          "t": "07:00",
          "isFuture": false,
          "actual": 45.2,
          "actualRef": null,
          "vcRatio": 48,
          "f5m": 44.1,
          "f10m": 45.3,
          "f15m": 46.0,
          "f30m": 50.1,
          "f60m": 56.4,
          "los": "smooth",
          "losLabel": "Trôi chảy",
          "accuracyStatus": "accurate",
          "accuracyLabel": "✅ Chính xác",
          "errorPct": 2.4
        },
        {
          "t": "15:05",
          "isFuture": true,
          "actual": null,
          "actualRef": 42.3,
          "vcRatio": null,
          "f5m": 43.1,
          "f10m": 44.5,
          "f15m": 45.2,
          "f30m": 48.1,
          "f60m": 55.3,
          "los": "smooth",
          "losLabel": "Trôi chảy",
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ thực tế",
          "errorPct": null
        }
      ],
      "horizonRows": [
        {
          "horizonKey": "f5m",
          "horizonLabel": "5 phút",
          "targetTime": "15:05",
          "predicted": 43.1,
          "actual": null,
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ",
          "errorPct": null,
          "vcRatio": null
        },
        {
          "horizonKey": "f10m",
          "horizonLabel": "10 phút",
          "targetTime": "15:10",
          "predicted": 44.5,
          "actual": null,
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ",
          "errorPct": null,
          "vcRatio": null
        },
        {
          "horizonKey": "f15m",
          "horizonLabel": "15 phút",
          "targetTime": "15:15",
          "predicted": 45.2,
          "actual": null,
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ",
          "errorPct": null,
          "vcRatio": null
        },
        {
          "horizonKey": "f30m",
          "horizonLabel": "30 phút",
          "targetTime": "15:30",
          "predicted": 48.1,
          "actual": null,
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ",
          "errorPct": null,
          "vcRatio": null
        },
        {
          "horizonKey": "f60m",
          "horizonLabel": "60 phút",
          "targetTime": "16:00",
          "predicted": 55.3,
          "actual": null,
          "accuracyStatus": "pending",
          "accuracyLabel": "⏳ Chờ",
          "errorPct": null,
          "vcRatio": null
        }
      ]
    },
    "662b86c4": {
      "capacity": 100,
      "slots": ["... tương tự 216 slots ..."],
      "horizonRows": ["... 5 rows ..."]
    }
  }
}
```

### Logic backend tính các fields mới

**`isFuture`** — đơn giản nhất:
```typescript
isFuture: slot.t >= nowTime
```

**`los` + `losLabel`** — LOS từ V/C ratio:
```typescript
const LOS_THRESHOLDS = [
  { max: 40,       id: "free_flow",  label: "Thông thoáng" },
  { max: 60,       id: "smooth",    label: "Trôi chảy"    },
  { max: 80,       id: "moderate",  label: "Vừa phải"     },
  { max: 100,      id: "heavy",     label: "Đông đúc"      },
  { max: Infinity, id: "congested", label: "Ùn tắc"        },
];
// vcRatio null → los null (future slots chưa có prediction)
```

**`accuracyStatus`** — tính từ actual vs f5m:
```typescript
// actual == null → "pending"
// isFuture → null
// |actual - f5m| / actual * 100:
//   ≤ 5%  → "accurate"  / "✅ Chính xác"
//   ≤ 15% → "acceptable"/ "⚠️ Chấp nhận"
//   > 15% → "poor"      / "❌ Sai lệch lớn"
```

**`horizonRows`** — kế thừa slot offset -1 từ Entry 135:
```typescript
// source slot = nowIdx + horizon.slots - 1
// (DB lưu dự báo tại slot trước, xem AGENT_LOG entry 135)
const HORIZONS = [
  { key: "f5m",  label: "5 phút",  slots: 1 },
  { key: "f10m", label: "10 phút", slots: 2 },
  { key: "f15m", label: "15 phút", slots: 3 },
  { key: "f30m", label: "30 phút", slots: 6 },
  { key: "f60m", label: "60 phút", slots: 12 },
];
```

### Các file cần thay đổi

| File | Thay đổi |
|---|---|
| `backend/server/src/controllers/forecast.controller.ts` | Thêm `getLOS()`, `getAccuracyStatus()`, `buildHorizonRows()`. Thêm fields vào `buildSlots()`. Move `capacity` vào camera object. Thêm `metadata.nowTime`, `metadata.generatedAt`. |
| `web/src/services/forecast.service.ts` | Cập nhật TypeScript interfaces: thêm `isFuture`, `los`, `losLabel`, `accuracyStatus`, `accuracyLabel`, `errorPct` vào `ForecastSlotItem`. Thêm `HorizonRow` interface. Đổi `capacities` map → `capacity` trong `CameraForecast`. |
| `web/src/components/dashboard/forecast/forecast-rolling-chart.tsx` | Xóa inline `getAccuracyStatus()`, LOS computation, `buildHorizonRows()` logic, slot offset -1 lookup. Đọc trực tiếp từ `slot.los`, `slot.isFuture`, `slot.accuracyStatus`, `camera.horizonRows`. |
| `web/src/components/dashboard/overview/chart-area-interactive.tsx` | Tương tự — xóa business logic, đọc từ pre-computed fields. |
| `web/src/components/dashboard/forecast/forecast-mock-data.json` | Cập nhật structure: thêm `isFuture`, `los`, `losLabel`, `accuracyStatus`, `horizonRows`. |
| `backend/server/src/config/swagger.ts` | Update schema `/api/forecast/rolling` với fields mới. |

---

## Thứ tự thực hiện

```
Phase 1 – Backend pre-format (không broke FE hiện tại, chỉ thêm fields mới)
  1a. forecast.controller.ts – thêm computed fields + horizonRows + move capacity
  1b. forecast.service.ts    – cập nhật TypeScript interfaces

Phase 2 – Frontend refactor (đơn giản hóa sau khi Phase 1 xong)
  2a. forecast-rolling-chart.tsx – xóa business logic, dùng pre-computed
  2b. chart-area-interactive.tsx – đồng bộ
  2c. forecast-mock-data.json    – cập nhật structure

Phase 3 – Notification flow
  3a. predict_realtime.py    – thêm push_forecast_ready()
  3b. app-route/main.py      – thêm elif ForecastReady → emit FORECAST_UPDATED
  3c. SocketContext.tsx      – thêm forecastVersion + listener
  3d. chart components       – đổi useEffect deps → [forecastVersion]
  ── Sau 3a+3b deploy: chạy curl tạo FIWARE subscription ──
```

---

## Flow hoàn chỉnh sau khi thay đổi

```
15:00:00  image-predict scheduler thức dậy
15:00:03  query + predict (RF models từ cache)
15:00:10  forecast_and_save_to_db() → INSERT camera_forecasts
15:00:11  refresh_forecast_mv() → REFRESH CONCURRENTLY mv_forecast_rolling_today
15:00:12  asyncio.gather — FIWARE Camera × 20 cameras → CAMERA_UPDATED × 20
15:00:13  push_forecast_ready() → FIWARE ForecastReady → FORECAST_UPDATED × 1
15:00:13  Frontend nhận FORECAST_UPDATED → re-fetch /api/forecast/rolling
15:00:14  Chart render data mới với pre-computed fields — delay ~14 giây
```

**So sánh**: Trước đây chart hiển thị data cũ đến **5 phút** tiếp theo.

---

## Lưu ý

1. **Mock data JSON** cần cập nhật structure để khớp format mới sau Phase 1 hoàn thành — nên generate từ API response thật.
2. **FIWARE subscription** chỉ cần tạo 1 lần trên cluster — không cần tạo lại khi redeploy.
3. **Đặt tên field**: đổi `currentRatio` → `vcRatio` để nhất quán với `vc_ratio` trong SQL.

---

## Tài liệu cũ (Luồng dữ liệu trước 16/03)

### 1. Tổng quan nguồn dữ liệu

```
image-predict (Python, k8s CronJob)
  └─ Ghi vào: camera_forecasts (PostgreSQL)
        └─ MV refresh mỗi 5 phút (forecast-mv-refresh-cronjob)
              ├─ mv_forecast_capacity        → capacity per-camera
              ├─ mv_forecast_daily_stats     → stats ngày
              ├─ mv_forecast_hourly          → timeline theo giờ
              └─ mv_forecast_slots_recent    → chi tiết per-slot
                    └─ backend/server (Node.js) expose API
                          └─ dashboard.tsx fetch khi activeTab === "forecast"
```

---

## 2. Ba API và dữ liệu nuôi từng zone

### Zone 1 — Summary Bar (Thanh chỉ số trên cùng)
**API:** `GET /api/forecast/summary?date=YYYY-MM-DD`  
**MV:** `mv_forecast_daily_stats` (GROUP BY slot_date, horizon=5m, last 30 days)

| Trường hiển thị | Nguồn | Công thức |
|---|---|---|
| `avgAccuracy` | `mape` trong MV | `100 - mape` (null khi chưa có actual) |
| `MAE` | `mv_forecast_daily_stats.mae` | `AVG(error_value)` WHERE actual IS NOT NULL |
| `MAPE` | `mv_forecast_daily_stats.mape` | `AVG(error_value / actual_value * 100)` |
| `R²` | `mv_forecast_daily_stats.r2` | Công thức R² chuẩn, NULL khi VAR=0 |
| `highRiskCount` | `mv_forecast_slots_recent` | COUNT camera có `vc_pct >= 90` trong cửa sổ ±5–10 phút quanh NOW() |
| `networkTrend` | **socket** (client-side) | So `trendingUp` vs `trendingDown` từ `processedCameras` |
| `networkChangePct` | **socket** (client-side) | `|trendUp - trendDown| / totalCameras * 100` |

> **Vấn đề hiện tại:** `networkChangePct` tính theo số camera chứ không phải % xe thực — có thể không có ý nghĩa thống kê.

---

### Zone 2 — Timeline Chart (Biểu đồ 24h)
**API:** `GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all|<id>`  
**MV:** `mv_forecast_hourly` (GROUP BY slot_date, hour, camera_id)

| Trường | Nguồn | Ghi chú |
|---|---|---|
| `predicted` | `SUM(predicted_value)` | Tổng tất cả slot 5-phút trong giờ đó |
| `actual` | `SUM(actual_value)` | NULL nếu TẤT CẢ slot trong giờ chưa có actual |
| `isFuture` | `actual === null` | Map client-side từ actual |
| `vcPct` | `LEAST(100, predicted/capacity*100)` | capacity = `mv_forecast_capacity.capacity × COUNT(slots_in_hour)` |

> **Bug đã fix (13/03):** capacity trong MV cũ là per-5-min-slot, không nhân `COUNT(*)` → vcPct vượt 600%. Đã sửa trong `004_forecast_views.sql`.

---

### Zone 3 — Cảnh báo nguy cơ (ForecastNextPanel)
**Nguồn:** `forecastSlots` state (từ cùng API slots bên dưới)  
**Logic client:**
```
nextTime = slot đầu tiên có actualVehicles === null
atRisk   = slots có timeSlot === nextTime AND riskLevel ∈ {medium, high}
           sort by vcPct DESC
```

| riskLevel | Điều kiện (tính trong MV) |
|---|---|
| `low` | V/C < 70% |
| `medium` | 70% ≤ V/C < 90% |
| `high` | V/C ≥ 90% |

---

### Zone 4 — Bảng lịch sử (ForecastHistoryTable)
**API:** `GET /api/forecast/slots?date=YYYY-MM-DD&horizon=5&limit=200`  
**MV:** `mv_forecast_slots_recent` (pre-compute LOS, riskLevel, error_pct)

| Trường | Nguồn | Công thức |
|---|---|---|
| `predictedLos` | MV | CASE vc_ratio: <0.6→free_flow, <0.75→smooth, <0.85→moderate, <1.0→heavy, else→congested |
| `actualLos` | MV | Tương tự nhưng dùng actual_value |
| `vcPct` | MV | `LEAST(100, predicted/capacity*100)` |
| `errorPct` | MV | `error_value / actual_value * 100` (NULL khi actual=NULL) |
| `riskLevel` | MV | Theo vcPct (xem Zone 3) |

---

## 3. Capacity — nguồn gốc và cách tính

```
mv_forecast_capacity:
  MAX( AVG(total_objects) per 5-min bucket ) trong 7 ngày gần nhất
  WHERE total_objects > 5
  COALESCE(..., 100)  ← fallback nếu camera chưa có dữ liệu
```

**Điểm yếu:**
- Capacity = "đỉnh trung bình 5-phút cao nhất trong 7 ngày" — có thể thấp hơn thực tế nếu tuần qua giao thông nhẹ
- Fallback 100 xe/5-phút quá thấp cho nhiều camera (gây vcPct cao giả)
- MV refresh 5 phút nhưng capacity thay đổi theo tuần → có thể refresh ít hơn (hàng ngày là đủ)

---

## 4. LOS Threshold thống nhất

| LOS | V/C ratio | Label (canonical) |
|---|---|---|
| `free_flow` | < 60% | Thông thoáng |
| `smooth` | 60–75% | Trôi chảy |
| `moderate` | 75–85% | Vừa phải |
| `heavy` | 85–100% | Đông đúc |
| `congested` | ≥ 100% | Ùn tắc |

> Áp dụng nhất quán tại: `los_utils.py`, `004_forecast_views.sql`, `LOS_LABEL` trong `reports-types.ts`.

---

## 5. Các điểm cần chỉnh sửa (đã biết)

| # | Vấn đề | Nơi sửa |
|---|---|---|
| 1 | `mv_forecast_hourly` capacity sai đơn vị | ✅ Đã fix 13/03 — cần rebuild MV trên k8s |
| 2 | `networkChangePct` tính logic lạ | `dashboard.tsx` lines ~65–73 |
| 3 | `highRiskCount` query dùng cửa sổ `±5–10 phút` — quá hẹp lúc chạy trễ | `forecast.controller.ts` line ~34 |
| 4 | `avgAccuracy = null` khi ngày chưa có actual_value | Cân nhắc dùng MAPE của ngày hôm qua làm fallback |
| 5 | Capacity fallback = 100 quá nhỏ | `los_utils.py` `DEFAULT_CAPACITY` và `COALESCE(..., 100)` trong SQL |
