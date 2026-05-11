# Thiết kế trang Reports & Forecasts (`reports-forecasts.tsx`)

> **Ngày cập nhật**: 11/03/2026  
> **Trạng thái**: Kế hoạch thiết kế – chưa implement

---

## 1. Mục tiêu trang

Trang **Báo cáo & Dự báo** gồm 2 tab với tính chất hoàn toàn khác nhau:

| Tab | Tính chất | Nguồn dữ liệu |
|-----|-----------|---------------|
| **Báo cáo** | Tài liệu tĩnh, có thể tải về | API tạo file PDF/CSV từ DB |
| **Dự báo** | Dữ liệu động realtime, **không có file tải** | Socket/API – dữ liệu dự báo từ mô hình ML |

---

## 2. Layout tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│  PageHeader: "Báo cáo & Dự báo"                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Tabs]  📄 Báo cáo (12)  |  📊 Dự báo  |  🕓 Lịch sử           │
├──────────────────────────────────────────────────────────────────┤
│  [Content area — thay đổi hoàn toàn theo tab được chọn]          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Tab "Báo cáo" – Traditional List View

### 3.1 UX Concept

Hiển thị **dạng danh sách** (list) truyền thống, giống trình quản lý tài liệu (Document Manager / Email Inbox style). Mặc định là **list view**, có toggle chuyển sang **grid cards view**.

### 3.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 Tìm kiếm báo cáo...  [Loại ▼] [Trạng thái ▼]  [⊞ Grid ≡ List]│
├──────────────────────────────────────────────────────────────────┤
│  Mới nhất ↓          12 báo cáo                                  │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 📄  Báo cáo lưu lượng ngày 17/05/2025    [Ngày] [✅ Sẵn]    ││
│  │     17/05/2025 – 17/05/2025  •  48,320 xe  •  2 sự cố       ││
│  │     Tạo: 18/05/2025 06:00               284 KB  [↓] [👁]    ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ 📄  Báo cáo lưu lượng tuần 19–25/05      [Tuần] [✅ Sẵn]   ││
│  │     19/05 – 25/05/2025  •  312,000 xe  •  8 sự cố           ││
│  │     Tạo: 25/05/2025 22:00              1.1 MB  [↓] [👁]    ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ ⏳  Báo cáo lưu lượng ngày 18/05/2025    [Ngày] [🔄 Xử lý] ││
│  │     Đang tạo báo cáo...                                      ││
│  │     Tạo: 18/05/2025 23:55               —      [—] [—]     ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 ReportRow Component (List View – Default)

Mỗi dòng report là 1 row với layout 3 zone:

```
[icon] [info-left]                          [meta-right]
  📄    Title (bold)          [Type] [Status]
        DateRange  •  Metrics summary
        Tạo: timestamp                  Size  [↓ Tải]  [👁 Xem]
```

Style:
- Background hover: `hover:bg-accent/50`
- Border bottom giữa các dòng: `border-b`
- Icon file: màu theo type (ngày=blue, tuần=purple, tháng=orange, sự cố=red)
- Khi `status=processing`: dim 60% opacity, hiển thị `Skeleton` trên phần metrics
- Column widths: icon (40px) | title+meta (flex-1) | actions (120px fixed)

### 3.4 ReportCard Component (Grid View – Toggle)

Giữ nguyên như thiết kế card thông thường khi người dùng chuyển sang grid view.

```
┌─────────────────────────────────────────────────┐
│ [PDF icon]  Báo cáo lưu lượng ngày 17/05/2025  │
│             Badge: [Ngày] [Đã sẵn]             │
│                                                 │
│  17/05/2025                    📅 18/05 06:00   │
│  ─────────────────────────────────────────────  │
│  Tổng xe: 48,320      Giờ cao điểm: 17:00–18:00 │
│  Trung bình: 2,013/h  Sự cố: 2    Camera: 5    │
│                                                 │
│  [Xem nhanh]          [↓ Tải PDF  284 KB]      │
└─────────────────────────────────────────────────┘
```

### 3.5 View Mode Toggle

```tsx
// State
const [viewMode, setViewMode] = useState<"list" | "grid">("list");  // default = list

// UI
<div className="flex gap-1 border rounded-md p-0.5">
  <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
    <IconList className="size-4" />
  </Button>
  <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
    <IconLayoutGrid className="size-4" />
  </Button>
</div>
```

### 3.6 ReportData Interface

```typescript
interface ReportData {
  id: string;
  title: string;
  type: "daily" | "weekly" | "monthly" | "incident";
  dateRange: { from: string; to: string };    // ISO date
  createdAt: string;                           // ISO datetime
  status: "ready" | "processing" | "failed";
  fileSizeKB: number;
  downloadUrl?: string;
  metrics: {
    totalVehicles: number;
    peakHour: string;           // "17:00–18:00"
    avgDensity: number;         // xe/giờ avg
    incidentCount: number;
    camerasIncluded: number;
  };
}
```

### 3.7 Mock Data

```typescript
const MOCK_REPORTS: ReportData[] = [
  {
    id: "rpt-001",
    title: "Báo cáo lưu lượng ngày 17/05/2025",
    type: "daily",
    dateRange: { from: "2025-05-17", to: "2025-05-17" },
    createdAt: "2025-05-18T06:00:00Z",
    status: "ready",
    fileSizeKB: 284,
    downloadUrl: "/reports/rpt-001.pdf",
    metrics: { totalVehicles: 48320, peakHour: "17:00–18:00", avgDensity: 2013, incidentCount: 2, camerasIncluded: 5 },
  },
  {
    id: "rpt-002",
    title: "Báo cáo lưu lượng tuần 19–25/05/2025",
    type: "weekly",
    dateRange: { from: "2025-05-19", to: "2025-05-25" },
    createdAt: "2025-05-25T22:00:00Z",
    status: "ready",
    fileSizeKB: 1120,
    downloadUrl: "/reports/rpt-002.pdf",
    metrics: { totalVehicles: 312000, peakHour: "Thứ Hai 17:30–18:30", avgDensity: 1857, incidentCount: 8, camerasIncluded: 5 },
  },
  {
    id: "rpt-003",
    title: "Báo cáo tháng 4/2025",
    type: "monthly",
    dateRange: { from: "2025-04-01", to: "2025-04-30" },
    createdAt: "2025-05-01T08:00:00Z",
    status: "ready",
    fileSizeKB: 3840,
    downloadUrl: "/reports/rpt-003.pdf",
    metrics: { totalVehicles: 1430000, peakHour: "Thứ Sáu 17:00–18:00", avgDensity: 1986, incidentCount: 31, camerasIncluded: 5 },
  },
  {
    id: "rpt-004",
    title: "Sự cố ùn tắc – Cầu Sài Gòn 14/05",
    type: "incident",
    dateRange: { from: "2025-05-14T07:15:00Z", to: "2025-05-14T09:45:00Z" },
    createdAt: "2025-05-14T10:00:00Z",
    status: "ready",
    fileSizeKB: 512,
    downloadUrl: "/reports/rpt-004.pdf",
    metrics: { totalVehicles: 4200, peakHour: "07:15–09:45", avgDensity: 1680, incidentCount: 1, camerasIncluded: 1 },
  },
  {
    id: "rpt-005",
    title: "Báo cáo lưu lượng ngày 18/05/2025",
    type: "daily",
    dateRange: { from: "2025-05-18", to: "2025-05-18" },
    createdAt: "2025-05-18T23:55:00Z",
    status: "processing",
    fileSizeKB: 0,
    metrics: { totalVehicles: 0, peakHour: "—", avgDensity: 0, incidentCount: 0, camerasIncluded: 5 },
  },
];
```

---

## 4. Tab "Dự báo" – Realtime Forecast Dashboard

### 4.1 UX Concept

> Đây **KHÔNG PHẢI** tài liệu tải về. Dữ liệu dự báo từ mô hình ML được hiển thị **trực tiếp** từ database/socket, tập trung phân tích sâu với nhiều góc nhìn:
> - Tổng quan ngay trước mắt (overview cards)
> - Timeline dự báo trải dài theo giờ trong ngày
> - So sánh dự báo vs thực tế đã xảy ra (accuracy validation)
> - Phân tích biến động: confidence, sai số, xu hướng
> - Breakdown chi tiết per-camera

### 4.2 Layout 4 Zone

```
┌──────────────────────────────────────────────────────────────────────┐
│  ZONE 1 – Summary Bar (4 stats ngang)                                │
│  [Độ chính xác tổng]  [Dự báo tiếp theo]  [Camera nguy cơ]  [Trend] │
├──────────────────────────────────────────────────────────────────────┤
│  ZONE 2 – Timeline Chart          │  ZONE 3 – Next Forecast Panel    │
│  Biểu đồ AreaChart dự báo vs      │  Khung giờ tiếp theo chi tiết:   │
│  thực tế 24h cuối                 │  · Từng camera: xe dự báo + LOS  │
│  (2 area: predicted + actual)     │  · Risk level badge              │
│  Trục X: theo giờ                 │  · Confidence + sai số dự báo    │
│  Trục Y: số xe                    │  · So sánh vs trung bình lịch sử │
├───────────────────────────────────┴──────────────────────────────────┤
│  ZONE 4 – Forecast History Table                                     │
│  Bảng so sánh dự báo vs thực tế các khung giờ đã qua (cuộn được)    │
│  Giờ | Camera | Dự báo | Thực tế | Sai số (%) | Trạng thái | Độ TC  │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 Zone 1 – Summary Stats (4 cards ngang)

| Card | Giá trị | Icon | Màu | Mô tả |
|------|---------|------|-----|-------|
| Độ chính xác hôm nay | 94.2% | `IconBullseye` | green | Avg accuracy tất cả cameras trong 24h |
| Dự báo tiếp theo | "17:00 – 15p nữa" | `IconClock` | blue | Thời điểm slot dự báo tiếp theo |
| Camera nguy cơ cao | 2 camera | `IconAlertTriangle` | red | Số camera dự báo congested/heavy |
| Xu hướng mạng lưới | ↑ Tăng 12% | `IconTrendingUp` | orange | So với cùng giờ hôm qua |

### 4.4 Zone 2 – Timeline Forecast + Actual Chart

**Loại**: AreaChart (Recharts), 2 series overlay:
- `predicted` — Area màu primary, strokeDasharray (dự báo)
- `actual` — Area màu chart-2 solid (thực tế đã xảy ra)

**Trục X**: đơn vị theo giờ ("06:00", "07:00", ..., "23:00"); tô màu nhạt vùng tương lai; ReferenceLine đứng "Hiện tại"

**Trục Y**: Số xe (tổng toàn mạng lưới hoặc riêng 1 camera)

**Tooltip chuẩn** (theo quy tắc Chart Tooltip trong copilot-instructions):
```
19:00
● Dự báo      1,240 xe
● Thực tế     (chờ dữ liệu)
```
Khi slot đã qua:
```
16:00
● Dự báo      1,180 xe
● Thực tế      1,205 xe
Sai số: +2.1%  ✅
```

**Select camera**: Dropdown chọn xem biểu đồ 1 camera cụ thể hoặc toàn mạng lưới.

### 4.5 Zone 3 – Next Forecast Detail Panel

Panel bên phải hiển thị chi tiết dự báo khung giờ **tiếp theo**:

```
┌─────────────────────────────────────────────┐
│  Dự báo 17:00 – 17:30             [🔴 Cao]  │
│  Độ tin cậy: 91%  ▓▓▓▓▓▓▓▓▓░  9/10         │
│  Mô hình: LSTM_v2.3               [Active]  │
├─────────────────────────────────────────────┤
│  Camera            Dự báo    LOS    Δ Avg   │
│  ─────────────────────────────────────────  │
│  Cầu Sài Gòn       480 xe  [Ùn tắc] +23%  │
│  Đinh Tiên Hoàng   310 xe  [Nặng]   +15%  │
│  Ngã tư Bến Thành  190 xe  [TB]      +3%  │
├─────────────────────────────────────────────┤
│  🔴 2 điểm nguy cơ cao                      │
│  📈 Tăng 18% so với cùng giờ hôm qua        │
│  ⚠️  Cao hơn 25% so với TB 7 ngày           │
└─────────────────────────────────────────────┘
```

**Cột "Δ Avg"**: % chênh lệch so với trung bình cùng khung giờ 7 ngày gần nhất — màu đỏ nếu dương (tăng), xanh nếu âm (giảm).

### 4.6 Zone 4 – Forecast vs Actual History Table

Bảng cuộn được, hiển thị 24–48h gần nhất, sort by time DESC.

**Columns**:
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| Khung giờ | Text | "16:00–16:30 Th5 17/05" |
| Camera | Text | Tên camera (có filter dropdown) |
| Dự báo | Number | Số xe dự báo (model output) |
| Thực tế | Number | Số xe thực tế từ DB (—nếu chưa có) |
| Sai số | % badge | `|actual-pred|/pred × 100` — xanh ≤5%, vàng 5–15%, đỏ >15% |
| Độ tin cậy | Progress bar | 0–100% |
| Trạng thái | Badge | ✅ Chính xác / ⚠️ Lệch / ❌ Sai nhiều / ⏳ Chờ |

**Filter**: chọn camera + date range (mặc định 24h gần nhất).

**Stats summary dưới bảng**:
```
MAE trung bình: 8.3 xe  •  MAPE: 4.2%  •  R²: 0.934  •  Số khung: 48/48
```

### 4.7 ForecastData Interface

```typescript
interface ForecastSlot {
  id: string;
  timeSlot: string;              // ISO datetime (đầu khung giờ)
  duration: 30 | 60;             // phút
  camId: string;
  camName: string;

  // Dự báo từ model
  predictedVehicles: number;
  predictedLos: "free_flow" | "smooth" | "moderate" | "heavy" | "congested";
  confidence: number;            // 0–100
  modelVersion: string;          // "LSTM_v2.3"

  // Thực tế (null nếu khung giờ chưa xảy ra)
  actualVehicles: number | null;
  actualLos: string | null;

  // Computed
  errorPct: number | null;       // |(actual - pred) / pred| * 100
  deltaVsWeekAvg: number | null; // % so với TB cùng giờ 7 ngày
  riskLevel: "low" | "medium" | "high";
}

interface ForecastSummary {
  date: string;                  // "2025-05-18"
  avgAccuracy: number;           // % dự báo có MAE ≤5xe
  mae: number;
  mape: number;
  r2: number;
  totalSlots: number;
  coveredSlots: number;          // slots đã có thực tế
  networkTrend: "increase" | "stable" | "decrease";
  networkChangePct: number;      // % vs hôm qua
  highRiskCount: number;         // số camera dự báo high risk
}
```

### 4.8 Mock Data

```typescript
const MOCK_FORECAST_SLOTS: ForecastSlot[] = [
  // Slot đã qua – có actual
  {
    id: "fs-001", timeSlot: "2025-05-18T09:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 210, predictedLos: "moderate", confidence: 88, modelVersion: "LSTM_v2.3",
    actualVehicles: 203, actualLos: "smooth",
    errorPct: 3.3, deltaVsWeekAvg: 5, riskLevel: "low",
  },
  {
    id: "fs-002", timeSlot: "2025-05-18T16:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 390, predictedLos: "heavy", confidence: 85, modelVersion: "LSTM_v2.3",
    actualVehicles: 412, actualLos: "congested",
    errorPct: 5.6, deltaVsWeekAvg: 18, riskLevel: "medium",
  },
  {
    id: "fs-003", timeSlot: "2025-05-18T16:00:00+07:00", duration: 60,
    camId: "cam-02", camName: "Ngã tư Đinh Tiên Hoàng",
    predictedVehicles: 260, predictedLos: "moderate", confidence: 82, modelVersion: "LSTM_v2.3",
    actualVehicles: 271, actualLos: "heavy",
    errorPct: 4.2, deltaVsWeekAvg: 12, riskLevel: "medium",
  },
  // Slot tương lai – không có actual
  {
    id: "fs-004", timeSlot: "2025-05-18T17:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 480, predictedLos: "congested", confidence: 91, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null,
    errorPct: null, deltaVsWeekAvg: 23, riskLevel: "high",
  },
  {
    id: "fs-005", timeSlot: "2025-05-18T17:00:00+07:00", duration: 60,
    camId: "cam-02", camName: "Ngã tư Đinh Tiên Hoàng",
    predictedVehicles: 310, predictedLos: "heavy", confidence: 87, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null,
    errorPct: null, deltaVsWeekAvg: 15, riskLevel: "high",
  },
  {
    id: "fs-006", timeSlot: "2025-05-18T18:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 395, predictedLos: "heavy", confidence: 83, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null,
    errorPct: null, deltaVsWeekAvg: 10, riskLevel: "medium",
  },
];

const MOCK_FORECAST_SUMMARY: ForecastSummary = {
  date: "2025-05-18",
  avgAccuracy: 94.2,
  mae: 8.3,
  mape: 4.2,
  r2: 0.934,
  totalSlots: 48,
  coveredSlots: 36,
  networkTrend: "increase",
  networkChangePct: 12,
  highRiskCount: 2,
};
```

---

## 5. Tab "Lịch sử"

### 5.1 Mục đích
Audit log các thao tác: tạo báo cáo, tải về, xóa.

### 5.2 Interface

```typescript
interface HistoryEntry {
  id: string;
  action: "generate" | "download" | "delete";
  reportId: string;
  reportTitle: string;
  performedAt: string;   // ISO datetime
  performedBy: string;   // username
  detail?: string;
}
```

### 5.3 Layout

Table đơn giản với pagination 10 rows/page:

| Thao tác | Báo cáo | Thời gian | Người dùng |
|----------|---------|-----------|------------|
| ↓ Tải về | Báo cáo ngày 17/05 | 18/05 08:32 | admin |
| ＋ Tạo mới | Báo cáo tuần 19–25/05 | 25/05 22:01 | system |
| 🗑 Xóa | Báo cáo cũ 01/2025 | 26/05 09:14 | admin |

---

## 6. Component Plan

### Page file: `pages/reports-forecasts.tsx`

### Sub-components: `components/reports-forecasts/`

| File | Export | Mô tả |
|------|--------|-------|
| `reports-types.ts` | interfaces + mock | Không export JSX (tránh fast-refresh) |
| `report-row.tsx` | `ReportRow` | 1 dòng báo cáo – list view (default) |
| `report-card.tsx` | `ReportCard` | Card báo cáo – grid view (toggle) |
| `forecast-summary-bar.tsx` | `ForecastSummaryBar` | Zone 1: 4 stats cards ngang |
| `forecast-timeline-chart.tsx` | `ForecastTimelineChart` | Zone 2: AreaChart predicted vs actual 24h |
| `forecast-next-panel.tsx` | `ForecastNextPanel` | Zone 3: Chi tiết dự báo khung giờ tiếp theo |
| `forecast-history-table.tsx` | `ForecastHistoryTable` | Zone 4: Bảng so sánh dự báo vs thực tế |
| `history-table.tsx` | `HistoryTable` | Tab Lịch sử: audit log |

---

## 7. Routing

```tsx
// App.tsx
{ path: "reports-forecasts", element: <ReportsForecastsPage />, loader: () => new Promise(r => setTimeout(r, 0)) }
```

Sidebar: `{ title: "Báo cáo & Dự báo", url: "/reports-forecasts", icon: IconFileReport }`

---

## 8. API Tích hợp (tương lai)

```
GET /api/reports                  → danh sách báo cáo đã tạo
GET /api/reports/:id/download     → tải file PDF/CSV
POST /api/reports/generate        → tạo báo cáo mới
GET /api/forecasts                → lấy forecast slots (có filter camera, date)
GET /api/forecasts/summary        → ForecastSummary cho ngày hiện tại
GET /api/activity-logs            → lịch sử thao tác báo cáo
```

---

## 9. Ghi chú Implement

- **Loading**: BẮT BUỘC 2 lớp (TopProgressBar loader + useLoading startLoading/stopLoading)
- **reports-types.ts**: chỉ export types, interfaces, constants — không export JSX
- **ReportRow**: nút tải dùng `<a href={downloadUrl} download>`, disabled + tooltip nếu `status !== "ready"`
- **ForecastTimelineChart**: Dùng `CartesianGrid` + `ReferenceLine` đánh dấu "Hiện tại". Series "actual" chỉ render với data, không hiển thị điểm null.
- **deltaVsWeekAvg**: màu đỏ dương (tăng), xanh âm (giảm) — dùng `cn()` conditional
- **Sai số badge**: `errorPct <= 5` → green, `<= 15` → yellow, `> 15` → red
- **API realtime**: Forecast data đến từ `camera_forecasts` table qua API — không phải file download
- **HistoryTable**: tái dùng column config pattern của `DataTable` từ `components/dashboard/`
