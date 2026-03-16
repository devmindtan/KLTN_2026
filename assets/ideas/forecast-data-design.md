# Thiết kế Dữ liệu cho Tab "Dự báo" (`dashboard.tsx`)

> **Tạo ngày**: 13/03/2026  
> **Trạng thái**: Draft — chưa implement API thực tế, đang dùng mock data  
> **Scope**: Tab "Dự báo" trong `web/src/pages/dashboard.tsx`

---

## 1. Tổng quan luồng dữ liệu

```
┌──────────────────────────────────────────────────────────────────┐
│                     NGUỒN DỮ LIỆU                                │
│                                                                  │
│  [Socket – Real-time]         [API – Historical / Aggregated]    │
│  processedCameras[]           GET /api/forecast/summary          │
│  ├─ forecasts.5m/10m/…        GET /api/forecast/timeline         │
│  ├─ inputValue                GET /api/forecast/slots            │
│  ├─ totalObjects              GET /api/forecast/accuracy         │
│  └─ calculation.capacity                                         │
└──────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────────────────────────────────────────────────────┐
│               TRANSFORM / AGGREGATE (dashboard.tsx)              │
│  buildForecastSummary()    buildForecastSlots()                  │
│  buildTimelinePoints()     (dùng processedCameras + API data)    │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FORECAST TAB COMPONENTS                       │
│  ForecastSummaryBar   ForecastTimelineChart                      │
│  ForecastNextPanel    ForecastHistoryTable                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Dữ liệu Socket hiện có (`processedCameras`)

Đây là dữ liệu **real-time** từ `SocketContext`, đã có sẵn trong dashboard:

```typescript
// Type: ProcessedCamera (từ SocketContext)
interface ProcessedCamera {
  id: string;               // FIWARE entity id — "urn:ngsi:camera:xxxxx"
  shortId: string;          // Mã ngắn — "CAM-001"
  name: string;             // Tên hiển thị — "Cầu Sài Gòn - Hướng Q.Bình Thạnh"
  totalObjects: number;     // Tổng xe hiện tại (5 phút cuối)
  carCount: number;
  motorbikeCount: number;

  // ─── DỮ LIỆU DỰ BÁO (từ FIWARE / image-predict service) ───
  forecasts: {
    "5m":  number;          // Dự báo xe 5 phút tới
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  inputValue?: number;      // Trung bình 5p thực dùng làm input cho model (base để tính % thay đổi)
  lastPredicted: string;    // ISO timestamp lần predict cuối

  // ─── TÍNH TOÁN LOS / CAPACITY ───
  calculation?: {
    capacity: number;       // Ngưỡng "congested" của camera (xe/5p)
    vc_ratio: number;       // V/C ratio hiện tại (0–1)
  };
  status: {
    current:  string;       // LOS hiện tại: "free_flow" | "smooth" | "moderate" | "heavy" | "congested"
    forecast: string;       // LOS dự báo 5p tới
  };
  trend: TrendInfo;         // GTI + direction + current_ratio + diff
}
```

---

## 3. Dữ liệu cần bổ sung từ API (chưa có)

### 3.1 `ForecastSummary` → Zone 1 `ForecastSummaryBar`

**Endpoint**: `GET /api/forecast/summary?date=YYYY-MM-DD`

```typescript
interface ForecastSummary {
  date: string;             // "2026-03-13"
  
  // ─── Chỉ số độ chính xác (từ bảng forecast_results trong PostgreSQL) ───
  avgAccuracy: number;      // % accuracy tổng. Ví dụ: 94.2
  mae: number;              // Mean Absolute Error (xe)
  mape: number;             // Mean Absolute Percentage Error (%)
  r2: number;               // Hệ số xác định (0–1)
  totalSlots: number;       // Tổng số slot dự báo trong ngày
  coveredSlots: number;     // Số slot đã có actual để đánh giá

  // ─── Xu hướng mạng (tính từ processedCameras real-time) ───
  networkTrend: "increase" | "stable" | "decrease";
  networkChangePct: number; // % thay đổi so với 1h trước. Ví dụ: 12

  // ─── Cảnh báo ───
  highRiskCount: number;    // Số camera có riskLevel = "high" trong slot tiếp theo
}
```

**Cách tính `networkTrend` / `networkChangePct`** (từ socket, không cần API):
- So sánh `totalObjects` hiện tại với `inputValue` của tất cả camera
- `changePct = round((sum(totalObjects) - sum(inputValue)) / sum(inputValue) * 100)`
- `trend = changePct > 5 ? "increase" : changePct < -5 ? "decrease" : "stable"`

---

### 3.2 `TimelinePoint[]` → Zone 2 `ForecastTimelineChart`

**Endpoint**: `GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all`

**Ý nghĩa**: Chuỗi thời gian dự báo vs thực tế theo từng khung giờ (aggregated toàn mạng hoặc per-camera).

```typescript
interface TimelinePoint {
  hour: string;             // "06:00" — khung giờ (HH:00)
  predicted: number;        // Tổng xe dự báo tất cả camera trong giờ đó
  actual: number | null;    // Tổng xe thực tế. null = giờ chưa xảy ra (tương lai)
  isFuture: boolean;        // true nếu hour > giờ hiện tại
  vcPct?: number | null;    // V/C ratio % tổng mạng (0–100). null nếu không có capacity
}
```

**Cách xây dựng** (server-side, từ DB):
- `predicted`: lấy từ bảng `forecast_results` — trung bình hoặc tổng slot trong giờ đó
- `actual`: lấy từ bảng `surveillance_snapshot` — tổng `total_objects` trong giờ đó
- `vcPct`: `predicted / sum(capacity_all_cameras) * 100`
- `isFuture`: `hour > CURRENT_TIME trunc to hour`

**Phạm vi**: 24h của ngày hiện tại (00:00 → 23:00), trả về 24 điểm.

---

### 3.3 `ForecastSlot[]` → Zone 3 `ForecastNextPanel` + Zone 4 `ForecastHistoryTable`

**Endpoint**: `GET /api/forecast/slots?date=YYYY-MM-DD&limit=48`

**Ý nghĩa**: Danh sách các slot dự báo per-camera, kết hợp cả past (có actual) và future (chưa có actual).

```typescript
interface ForecastSlot {
  id: string;                 // "fs-{uuid}" hoặc DB primary key

  timeSlot: string;           // ISO datetime — "2026-03-13T17:00:00+07:00"
  duration: 5 | 10 | 15 | 30 | 60;  // ← Cần thêm 5/10/15 (hiện đang chỉ 30|60)

  camId: string;              // FIWARE entity id
  camName: string;            // Tên camera (join từ cameras table)

  // ─── Dự báo ───
  predictedVehicles: number;
  predictedLos: "free_flow" | "smooth" | "moderate" | "heavy" | "congested";
  confidence: number;         // 0–100. Từ model predict output
  modelVersion: string;       // "LSTM_v2.3" — từ model metadata

  // ─── Thực tế (null nếu chưa xảy ra) ───
  actualVehicles: number | null;
  actualLos: string | null;
  errorPct: number | null;    // |predicted - actual| / actual * 100

  // ─── Chỉ số bổ sung ───
  deltaVsWeekAvg: number | null;  // % so với trung bình cùng khung giờ 7 ngày gần nhất
  riskLevel: "low" | "medium" | "high";
}
```

**Schema DB tương ứng** — Bảng `camera_forecasts` **đã tồn tại** (xem `DATABASE_SCHEMA.md`):
```sql
-- ĐÃ CÓ – không cần tạo mới
TABLE camera_forecasts (
  camera_id           VARCHAR(100),     -- FIWARE entity id
  forecast_for_time   TIMESTAMPTZ,      -- = input_bucket + horizon_minutes
  horizon_minutes     INTEGER,          -- 5 | 10 | 15 | 30 | 60
  predicted_value     DOUBLE PRECISION, -- Kết quả RF model
  actual_value        DOUBLE PRECISION, -- Điền bởi sync-actual sau khi thời điểm qua đi
  error_value         DOUBLE PRECISION, -- |predicted - actual|
  input_value         DOUBLE PRECISION, -- Trung bình xe bucket đầu vào (baseline % thay đổi)
  input_sample_count  INTEGER,
  lag_sample_count    INTEGER,
  sync_sample_count   INTEGER,
  created_at          TIMESTAMPTZ,
  PRIMARY KEY (camera_id, forecast_for_time, horizon_minutes)
)
-- NOTE: Không có predicted_los, confidence — LOS tính động từ predicted_value + capacity
-- qua shared/los_utils.py::calculate_los_status(), không lưu vào DB
```

---

## 4. Cách xây dựng `ForecastSlot[]` từ `processedCameras` (Next Slot – real-time)

**Dùng ngay cho ForecastNextPanel** khi chưa có API:

```typescript
// Xây "next slot" từ processedCameras (5m forecast)
function buildNextSlots(cameras: ProcessedCamera[]): ForecastSlot[] {
  const nowISO = new Date().toISOString();
  return cameras.map(cam => ({
    id:               `live-${cam.id}-5m`,
    timeSlot:         nowISO,
    duration:         5,
    camId:            cam.id,
    camName:          cam.name,
    predictedVehicles: cam.forecasts["5m"],
    predictedLos:     cam.status.forecast as ForecastSlot["predictedLos"],
    confidence:       85,              // placeholder — model chưa trả confidence
    modelVersion:     "LSTM_v2.x",    // placeholder
    actualVehicles:   null,
    actualLos:        null,
    errorPct:         null,
    deltaVsWeekAvg:   null,            // cần API historical
    riskLevel:        cam.calculation
      ? (cam.calculation.vc_ratio > 0.9 ? "high" : cam.calculation.vc_ratio > 0.7 ? "medium" : "low")
      : "low",
  }));
}
```

---

## 5. Priority thực hiện

| Ưu tiên | Component | Nguồn dữ liệu | Ghi chú |
|---------|-----------|---------------|---------|
| 🔴 Ngay | `ForecastNextPanel` | `processedCameras` (Socket) | Có thể implement ngay từ data hiện có |
| 🔴 Ngay | `ForecastSummaryBar` (trend) | `processedCameras` (Socket) | Tính `networkTrend` từ totalObjects vs inputValue |
| 🟡 Sau | `ForecastTimelineChart` | API `GET /forecast/timeline` | Cần API + bảng DB forecast_results |
| 🟡 Sau | `ForecastHistoryTable` | API `GET /forecast/slots` | Cần API + actual data từ DB |
| 🟠 Cuối | `ForecastSummaryBar` (accuracy) | API `GET /forecast/summary` | Cần MAPE/R² tính từ historical actual vs predicted |

---

## 6. Cập nhật `ForecastSummaryBar` từ Socket (tạm thời)

Trước khi có API, truyền `summary` với chỉ phần `networkTrend` từ real-time, phần accuracy dùng null/default:

```typescript
// Trong dashboard.tsx
const forecastSummary = useMemo<ForecastSummary>(() => {
  const totalNow     = processedCameras.reduce((s,c) => s + c.totalObjects, 0);
  const totalBase    = processedCameras.reduce((s,c) => s + (c.inputValue ?? c.totalObjects), 0);
  const changePct    = totalBase > 0 ? Math.round((totalNow - totalBase) / totalBase * 100) : 0;
  const highRiskCams = processedCameras.filter(c =>
    c.calculation && c.calculation.vc_ratio > 0.9
  ).length;

  return {
    date:             new Date().toISOString().slice(0, 10),
    avgAccuracy:      0,     // TODO: từ API
    mae:              0,
    mape:             0,
    r2:               0,
    totalSlots:       processedCameras.length * 5,  // ước tính
    coveredSlots:     0,
    networkTrend:     changePct > 5 ? "increase" : changePct < -5 ? "decrease" : "stable",
    networkChangePct: Math.abs(changePct),
    highRiskCount:    highRiskCams,
  };
}, [processedCameras]);
```

---

## 7. TODO khi có API `/api/forecast/*`

> **`camera_forecasts` đã có sẵn** — `image-predict` ghi dự báo, `sync-actual` điền actual mỗi 5 phút.
> Chỉ cần thêm API routes trong `backend/server` để frontend đọc.

- [ ] Thêm API `GET /api/forecast/summary?date=` → tính MAPE/MAE/R² từ `camera_forecasts WHERE actual_value IS NOT NULL`
- [ ] Thêm API `GET /api/forecast/timeline?date=&camId=` → group by giờ từ `camera_forecasts`
- [ ] Thêm API `GET /api/forecast/slots?date=&limit=` → list rows từ `camera_forecasts`, join camera name
- [ ] Thêm Swagger docs cho 3 endpoints trên trong `swagger.ts`
- [ ] Tính `predicted_los` phía server (dùng `los_utils::calculate_los_status`) trước khi trả về API
- [ ] Cập nhật `ForecastTimelineChart` nhận `data` prop từ API thay vì MOCK_TIMELINE
- [ ] Cập nhật `ForecastHistoryTable` nhận `slots` props từ API thay vì MOCK_FORECAST_SLOTS
- [ ] Cập nhật `ForecastSummaryBar` nhận accuracy từ API summary
