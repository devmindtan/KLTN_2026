# Kế hoạch Refactor: UI Terminology Constants + i18n-Ready Architecture

> **Ngày lập**: 16/03/2026  
> **Cập nhật**: 16/03/2026 — Bổ sung phân tích i18n  
> **Trạng thái**: Phase 1 ✅ DONE — Phase 2–6 chờ review  
> **Mục tiêu**: Tập trung toàn bộ nhãn chuyên ngành vào 1 file, xây dựng interface i18n-ready để sau này hỗ trợ đa ngôn ngữ không cần viết lại component.

---

## 1. Bối cảnh & Vấn đề

Hiện tại `lib/los-config.ts` đã xử lý đúng cho LOS labels (đọc từ VITE env, có fallback).  
**Tuy nhiên**, các nhóm thuật ngữ khác vẫn đang được hardcode rải rác khắp components:

- Nhãn metrics ML (`MAE`, `MAPE`, `RMSE`, `R²`, `Accuracy ≤5xe`, `Trend Accuracy`) xuất hiện ≥6 lần mỗi cái
- Khoảng thời gian (`5 phút`, `10 phút`, `15 phút`, `30 phút`, `60 phút`) lặp 8–14 lần
- Status job model (`running`, `succeeded`, `failed`) → 10–12 lần, không có label tiếng Việt nhất quán
- Xu hướng (`Tăng`, `Giảm`, `Ổn định`) → mỗi cái 2–11 lần
- Tên trang nav sidebar → mỗi cái 4 lần (sidebar + page header + breadcrumb + title)

---

## 2.A. Phân tích: Có nên dùng i18next không?

### Các lựa chọn

| Phương án | Ưu điểm | Nhược điểm | Phù hợp khi |
|---|---|---|---|
| **A. app-constants.ts thuần** (đã làm) | 0 dep, type-safe, đơn giản | Build-time only, không switch ngôn ngữ runtime | Chỉ 1 ngôn ngữ mãi mãi |
| **B. i18next + react-i18next** | Chuẩn công nghiệp, switch runtime, pluralization | +50–80KB bundle, setup phức tạp, thêm Provider wrap | Đã có 2+ ngôn ngữ hoặc cần switch ngay |
| **C. i18n-Ready Bridge Pattern** ⭐ | 0 dep thêm hôm nay, interface giống i18next, migrate sau 1 file | Component cần nhớ dùng hook `useT()` thay vì import trực tiếp | **Muốn future-proof mà chưa cần i18n ngay** |

---

### Khuyến nghị: Phương án C — i18n-Ready Bridge Pattern

**Lý do chọn C cho dự án này:**

1. **Hệ thống hiện tại chỉ có tiếng Việt** — i18next là overkill, tăng bundle không cần thiết
2. **Thesis project** — deadline quan trọng hơn feature tương lai chưa có trong scope
3. **app-constants.ts đã là nền tảng tốt** — keys đã được định nghĩa rõ ràng
4. **Điểm mấu chốt**: Giá trị thực của i18next không phải ở việc lưu trữ translation — mà là ở **interface `t("key")`** mà nó cung cấp cho component

**Cách hoạt động của Pattern C:**

```
Hôm nay:
  Component → useT() hook → đọc từ app-constants.ts → trả về string tiếng Việt

Khi cần i18n thật:
  Component (KHÔNG ĐỔI GÌ) → useT() hook → (chỉ sửa hook này) → i18next → JSON files
```

Toàn bộ component không cần sửa. **Chỉ sửa 1 file**: implementation bên trong `useT()`.

---

### Interface của `useT()` hook

```tsx
// Cách dùng trong component — giống hệt i18next
const { t } = useT();

<span>{t("los.free_flow")}</span>          // → "Thông thoáng"
<span>{t("metrics.MAE")}</span>             // → "MAE"
<span>{t("ui.loading")}</span>              // → "Đang tải dữ liệu..."
<span>{t("time.10m")}</span>                // → "10 phút"
```

```tsx
// Migration sang i18next sau này: chỉ sửa useT.ts
// TRƯỚC (bridge):
export function useT() {
  const t = (key: string) => resolveFromConstants(key);
  return { t };
}

// SAU (i18next drop-in, component không đổi):
export function useT() {
  return useTranslation(); // i18next hook, interface giống hệt
}
```

---

### Cấu trúc key namespace (flat dot-notation)

Key format: `{namespace}.{subkey}` — khớp với cả JSON file của i18next lẫn object trong app-constants.ts

| Key | Giá trị tiếng Việt | Group |
|---|---|---|
| `los.free_flow` | Thông thoáng | LOS |
| `los.smooth` | Trôi chảy | LOS |
| `los.moderate` | Vừa phải | LOS |
| `los.heavy` | Đông đúc | LOS |
| `los.congested` | Ùn tắc | LOS |
| `metrics.MAE` | MAE | Metrics |
| `metrics.MAPE` | MAPE | Metrics |
| `metrics.RMSE` | RMSE | Metrics |
| `metrics.R2` | R² | Metrics |
| `metrics.ACC_5` | Accuracy ≤5xe | Metrics |
| `metrics.TREND_ACC` | Trend Accuracy | Metrics |
| `metrics.desc.MAE` | Sai số tuyệt đối trung bình... | Metric tooltips |
| `time.5m` | 5 phút | Time |
| `time.10m` | 10 phút | Time |
| `time.15m` | 15 phút | Time |
| `time.30m` | 30 phút | Time |
| `time.60m` | 60 phút | Time |
| `time.f5m` | Dự báo 5 phút | Time |
| `time.f60m` | Dự báo 60 phút | Time |
| `job.running` | Đang chạy | Job Status |
| `job.succeeded` | Thành công | Job Status |
| `job.failed` | Thất bại | Job Status |
| `job.pending` | Chờ xử lý | Job Status |
| `trend.increasing` | Tăng | Trend |
| `trend.decreasing` | Giảm | Trend |
| `trend.stable` | Ổn định | Trend |
| `traffic.vehicles` | Phương tiện | Traffic |
| `traffic.flow_rate` | Lưu lượng | Traffic |
| `traffic.vc_ratio` | Mức tải V/C | Traffic |
| `forecast.forecast` | Dự báo | Forecast |
| `forecast.actual` | Thực tế | Forecast |
| `page.dashboard` | Tổng quan | Pages |
| `page.monitoring` | Giám sát lưu lượng | Pages |
| `page.analytics` | Phân tích mô hình | Pages |
| `page.models` | Danh sách mô hình | Pages |
| `camera.all` | Tất cả camera | Camera |
| `camera.select` | Chọn camera | Camera |
| `camera.offline_msg` | Camera offline... | Camera |
| `ui.loading` | Đang tải dữ liệu... | UI |
| `ui.no_data` | N/A | UI |
| `ui.all` | Tất cả | UI |
| `ui.clear_filter` | Xóa bộ lọc | UI |

---

### 2.1. LOS (Level of Service) — ĐÃ CÓ `lib/los-config.ts`

| Key (canonical) | Label hiện tại | File xử lý |
|---|---|---|
| `free_flow` | Thông thoáng | `lib/los-config.ts` ✅ |
| `smooth` | Trôi chảy | — (chỉ hardcode trong `camera-utils.tsx`) |
| `moderate` | Vừa phải / Trung bình (không nhất quán!) | — |
| `heavy` | Nặng / Đông đúc (không nhất quán!) | `los-config.ts` dùng "Đông đúc", component dùng "Nặng" |
| `congested` | Ùn tắc | `lib/los-config.ts` ✅ |

> ⚠️ **Bug**: `smooth` chưa có trong `LOS_LABEL`. `moderate` và `heavy` bị lệch giữa config và component.

---

### 2.2. Traffic Domain Terms (Lưu lượng giao thông)

| Constant name | Giá trị mặc định | Xuất hiện ở |
|---|---|---|
| `TERM_VEHICLES` | `"Phương tiện"` | section-cards, stat-cards, search |
| `TERM_VEHICLE_COUNT` | `"Tổng phương tiện"` | 2–4 lần (section-cards, forecast) |
| `TERM_FLOW_RATE` | `"Lưu lượng"` | monitoring, analytics |
| `TERM_FLOW_RATE_HOURLY` | `"Lưu lượng theo giờ"` | analytics page |
| `TERM_PEAK_HOUR` | `"Giờ cao điểm"` | analytics |
| `TERM_VC_RATIO` | `"Mức tải V/C"` | section-cards, detail-sheet |
| `TERM_FORECAST_SLOT` | `"Slot dự báo"` | forecast-history-table |
| `TERM_UNIT_VEHICLES_PER_HOUR` | `"(xe/h)"` | analytics, chart labels |
| `TERM_UNIT_VEHICLES` | `"xe"` | stat-cards, tooltips |

---

### 2.3. Forecast Terms (Dự báo)

| Constant name | Giá trị mặc định | Xuất hiện ở |
|---|---|---|
| `TERM_FORECAST` | `"Dự báo"` | 7+ lần khắp hệ thống |
| `TERM_ACTUAL` | `"Thực tế"` | forecast-history-table, chart |
| `TERM_CURRENT` | `"Hiện tại"` | section-cards, monitoring |
| `TERM_FORECAST_TRAFFIC` | `"Dự báo lưu lượng giao thông"` | page header, monitoring |
| `TERM_FORECAST_5M` | `"Dự Báo 5 Phút"` | section-cards |
| `TERM_PAST` | `"Quá khứ"` | forecast-rolling-chart |
| `TERM_FUTURE` | `"Tương lai"` | forecast-rolling-chart |
| `TERM_ROLLING` | `"Rolling"` | forecast tabs |

---

### 2.4. Time Interval Labels

| Constant name | Key nội bộ | Label hiển thị | Lần xuất hiện |
|---|---|---|---|
| `TIME_LABEL["5m"]` | `"5m"` | `"5 phút"` | 4 |
| `TIME_LABEL["10m"]` | `"10m"` | `"10 phút"` | 11 |
| `TIME_LABEL["15m"]` | `"15m"` | `"15 phút"` | 14 |
| `TIME_LABEL["30m"]` | `"30m"` | `"30 phút"` | 11 |
| `TIME_LABEL["60m"]` | `"60m"` | `"60 phút"` | 14 |
| `TIME_LABEL["f5m"]` | `"f5m"` | `"Dự báo 5 phút"` | 4 |
| `TIME_LABEL["f10m"]` | `"f10m"` | `"Dự báo 10 phút"` | 4 |
| `TIME_LABEL["f15m"]` | `"f15m"` | `"Dự báo 15 phút"` | 4 |
| `TIME_LABEL["f30m"]` | `"f30m"` | `"Dự báo 30 phút"` | 4 |
| `TIME_LABEL["f60m"]` | `"f60m"` | `"Dự báo 60 phút"` | 4 |

---

### 2.5. ML Metric Labels

| Constant name | Giá trị mặc định | Mô tả ngắn để tooltip |
|---|---|---|
| `METRIC_MAE` | `"MAE"` | `"Sai số tuyệt đối trung bình (xe/5 phút). Càng thấp càng tốt."` |
| `METRIC_MAPE` | `"MAPE"` | `"Sai số phần trăm trung bình"` |
| `METRIC_RMSE` | `"RMSE"` | `"Căn bậc hai sai số bình phương trung bình"` |
| `METRIC_R2` | `"R²"` | `"Hệ số xác định – độ khớp tổng thể"` |
| `METRIC_ACC_5` | `"Accuracy ≤5xe"` | `"Tỷ lệ dự đoán có sai số trong phạm vi ±5 xe"` |
| `METRIC_TREND_ACC` | `"Trend Accuracy"` | `"Độ chính xác dự đoán xu hướng tăng/giảm"` |
| `METRIC_TRAINING_SAMPLES` | `"Mẫu huấn luyện"` | `"Số lượng bản ghi dùng để train"` |

---

### 2.6. Model Job Status Labels

| Key (canonical) | Label tiếng Việt hiển thị | Màu badge |
|---|---|---|
| `running` | `"Đang chạy"` | blue |
| `succeeded` | `"Thành công"` | green |
| `failed` | `"Thất bại"` | red |
| `pending` | `"Chờ xử lý"` | yellow |

> Hiện tại code dùng key tiếng Anh trực tiếp trong Badge — cần label tiếng Việt nhất quán.

---

### 2.7. Trend Labels

| Key (canonical) | Label tiếng Việt | Xuất hiện ở |
|---|---|---|
| `increasing` | `"Tăng"` | section-cards, forecast-stat-cards |
| `decreasing` | `"Giảm"` | section-cards, forecast-stat-cards |
| `stable` | `"Ổn định"` | section-cards, forecast-stat-cards |

---

### 2.8. Navigation / Page Titles

| Constant name | Giá trị | Dùng ở |
|---|---|---|
| `PAGE_DASHBOARD` | `"Tổng quan"` | sidebar, page header |
| `PAGE_MONITORING` | `"Giám sát lưu lượng"` | sidebar, monitoring.tsx |
| `PAGE_ANALYTICS` | `"Phân tích mô hình"` | sidebar, analytics.tsx |
| `PAGE_MODELS` | `"Danh sách mô hình"` | sidebar, models.tsx |
| `PAGE_DATA_LIBRARY` | `"Dữ liệu giao thông"` | sidebar |
| `PAGE_REPORTS` | `"Báo cáo & Dự báo"` | sidebar, reports-forecasts.tsx |
| `PAGE_SEARCH` | `"Tìm kiếm nhanh"` | sidebar, search.tsx |

---

### 2.9. Camera Labels

| Constant name | Giá trị | Xuất hiện ở |
|---|---|---|
| `TERM_CAMERA` | `"Camera"` | monitoring, search, sidebar |
| `TERM_CAMERA_ACTIVE` | `"Camera hoạt động"` | section-cards |
| `TERM_CAMERA_SELECT` | `"Chọn camera"` | dropdowns |
| `TERM_CAMERA_ALL` | `"Tất cả camera"` | dropdowns, chart labels |
| `TERM_CAMERA_ID` | `"Mã Camera"` | detail-sheet |
| `TERM_CAMERA_OFFLINE_MSG` | `"Camera offline — kiểm tra kết nối mạng và nguồn điện"` | camera-wall-cell |

---

### 2.10. Common UI Labels (Action / Feedback)

| Constant name | Giá trị | Tần suất |
|---|---|---|
| `UI_LOADING` | `"Đang tải dữ liệu..."` | 2+ lần |
| `UI_LOADING_FORECAST` | `"Đang tải dữ liệu dự báo..."` | 2 lần |
| `UI_NOT_FOUND` | `"Không tìm thấy"` | chung |
| `UI_NO_DATA` | `"N/A"` | 6 lần |
| `UI_ALL` | `"Tất cả"` | 5+ lần mọi nơi |
| `UI_DETAIL` | `"Xem chi tiết"` | 2+ lần |
| `UI_CLEAR_FILTER` | `"Xóa bộ lọc"` | search, filter panels |

---

## 3. Kiến trúc đề xuất

### 3.1. File structure — 2 files, tách rõ data và interface

```
web/src/lib/
├── app-constants.ts    ← DATA: Mọi string đều ở đây, phân nhóm bằng comment
├── use-t.ts            ← INTERFACE: Hook useT() — bridge pattern, tương lai replace bằng i18next
└── los-config.ts       ← SHIM: Re-export LOS_LABEL, getLOSLabel cho backward compat ✅ DONE
```

**Tại sao tách `use-t.ts` ra khỏi `app-constants.ts`?**
- `app-constants.ts` = pure data, không có React dependency, dễ test, dễ dùng ngoài component
- `use-t.ts` = React hook, chứa logic lookup, đây là **điểm duy nhất thay đổi** khi migrate sang i18next
- Component import từ `@/lib/use-t`, không import trực tiếp từ `@/lib/app-constants`

### 3.2. Thiết kế `use-t.ts`

```ts
// use-t.ts — Bridge implementation (hôm nay)
import { LOS_LABEL, METRIC_LABELS, TIME_LABEL, ... } from "@/lib/app-constants";

const TRANSLATIONS: Record<string, string> = {
  // LOS
  "los.free_flow": LOS_LABEL.free_flow,
  "los.smooth":    LOS_LABEL.smooth,
  // ... flatten toàn bộ app-constants thành dot-notation keys
};

export function useT() {
  const t = (key: string, fallback?: string): string =>
    TRANSLATIONS[key] ?? fallback ?? key;
  return { t };
}
```

```ts
// use-t.ts — Khi migrate sang i18next (chỉ sửa file này, component KHÔNG ĐỔI)
import { useTranslation } from "react-i18next";
export { useTranslation as useT };
```

### 3.3. Quy tắc đưa vào env vs constant thuần

| Loại | Dùng VITE env? | Lý do |
|---|---|---|
| LOS labels, Metric names, Page titles | ✅ app-constants + VITE env | Có thể custom theo deployment |
| Time labels, Trend, Job status | ❌ constant thuần | UI utility, ít thay đổi |
| Common UI feedback (loading, N/A...) | ❌ constant thuần | Text nội bộ |

---

## 4. Thứ tự thực hiện (Priority)

### Phase 1A — Tạo `app-constants.ts` + chuyển `los-config.ts` thành shim ✅ DONE
- `web/src/lib/app-constants.ts` — 1 file, 10 nhóm, có comment section
- `web/src/lib/los-config.ts` → re-export shim, import cũ không break

### Phase 1B — Tạo `use-t.ts` (i18n-Ready Bridge hook)
- Flatten toàn bộ `app-constants.ts` thành flat dot-notation key map
- Export `useT()` hook với interface `{ t(key, fallback?) }`
- Viết TypeScript type `TKey` cho toàn bộ keys → autocomplete khi dùng `t("")`
- **Chưa migrate component** — chỉ tạo hook và verify type-safe

### Phase 2 — Fix LOS bug + Migrate `camera-utils.tsx`
1. `camera-utils.tsx` dùng nhãn lệch (`smooth`="Ổn định", `moderate`="Trung bình", `heavy`="Nặng")
2. Chuyển sang dùng `useT()`: `t("los.free_flow")` thay vì hardcode

### Phase 3 — Migrate Metric + Time labels
- `components/models/metric-chip.tsx`
- `components/dashboard/forecast/forecast-history-table.tsx`
- `components/dashboard/forecast/forecast-rolling-chart.tsx`
- `components/dashboard/overview/section-cards.tsx`

### Phase 4 — Migrate Job Status + Trend labels
- `pages/models.tsx`, `pages/analytics.tsx`
- `components/dashboard/overview/section-cards.tsx` (TREND)

### Phase 5 — Migrate Page Titles + Camera Labels
- `components/layout/app-sidebar.tsx`
- `components/monitoring/camera-wall-view.tsx`, `camera-detail-dialog.tsx`

### Phase 6 — Migrate Common UI Labels
- Loading states, empty states, action labels còn lại

---

### Khi nào thêm i18next thật?

Khi có nhu cầu thêm ngôn ngữ thứ 2 (ví dụ tiếng Anh), chỉ cần:
1. `npm install i18next react-i18next`
2. Tạo `public/locales/vi/translation.json` từ key map trong `use-t.ts` (copy 1:1)
3. Tạo `public/locales/en/translation.json` (dịch)
4. Sửa `use-t.ts` → `export { useTranslation as useT } from "react-i18next"`
5. **0 dòng component nào cần sửa**

---

## 5. Quy tắc sử dụng (sau khi refactor)

1. **Trong component**: luôn dùng `useT()` hook — `const { t } = useT()`
2. **Không import trực tiếp** từ `app-constants.ts` trong component (trừ khi cần type)
3. **Ngoài component** (utils, helpers): dùng helper functions (`getLOSLabel`, `getJobStatusLabel`...)
4. Khi muốn đổi nhãn → chỉ sửa `app-constants.ts` hoặc `.env.local`
5. Thêm term mới → thêm vào `app-constants.ts` + thêm key vào `use-t.ts` + update doc này

---

## 6. .env.local template (sau refactor)

```env
# === LOS Labels ===
VITE_LOS_FREE_FLOW=Thông thoáng
VITE_LOS_SMOOTH=Trôi chảy
VITE_LOS_MODERATE=Vừa phải
VITE_LOS_HEAVY=Đông đúc
VITE_LOS_CONGESTED=Ùn tắc

# === Metric Labels ===
VITE_METRIC_MAE=MAE
VITE_METRIC_MAPE=MAPE
VITE_METRIC_RMSE=RMSE
VITE_METRIC_R2=R²
VITE_METRIC_ACC5=Accuracy ≤5xe
VITE_METRIC_TREND_ACC=Trend Accuracy

# === Page Titles (tùy chọn custom per deployment) ===
VITE_PAGE_DASHBOARD=Tổng quan
VITE_PAGE_MONITORING=Giám sát lưu lượng
VITE_PAGE_ANALYTICS=Phân tích mô hình
```

---

## 7. Impact Analysis

| Phase | Việc cần làm | Số file | Độ phức tạp |
|---|---|---|---|
| 1A | Tạo app-constants.ts + los-config shim | 2 files | ✅ Done |
| 1B | Tạo use-t.ts (bridge hook + TKey type) | 1 file mới | Thấp |
| 2 | Fix LOS bug, migrate camera-utils | 1 file | Thấp |
| 3 | Migrate metric/time labels | 4–5 files | Trung bình |
| 4 | Migrate job status + trend | 3–4 files | Trung bình |
| 5 | Migrate page titles + camera labels | 5–6 files | Trung bình |
| 6 | Migrate common UI labels | 8–10 files | Cao |

**Tổng ước tính Phase 1B–6**: ~20–25 file, không thay đổi logic runtime.  
**Khi migrate sang i18next thật**: Chỉ sửa `use-t.ts` (1 file), 0 component thay đổi.
