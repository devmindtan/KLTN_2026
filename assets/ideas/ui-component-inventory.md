# UI Component Inventory — Kiểm kê toàn bộ loại component hiện có

> Mục đích: Liệt kê tất cả patterns đang tồn tại trong codebase để lên kế hoạch đồng nhất thiết kế.  
> Ngày tạo: 12/03/26  
> Scope: `web/src/components/` + `web/src/pages/`

---

## 1. Page Header (Header đầu trang)

| Variant | Component | Dùng tại | Ghi chú |
|---|---|---|---|
| `PageHeader` | `components/page-header.tsx` | `analytics`, `data-library`, `models`, `monitoring`, `reports-forecasts`, `search` | Template: icon 9×9 bg-primary/10 + `text-lg font-semibold` + desc + right slot |
| Dashboard header | Không có PageHeader | `dashboard.tsx` | Dùng `SectionCards` thay thế — không có page title |

**Vấn đề**: Dashboard thiếu page title/context selector hiển thị rõ đang ở trang nào.

---

## 2. Stats Cards (Card số liệu tổng quan)

| Variant | Component | Dùng tại | Structure |
|---|---|---|---|
| Dashboard stats | `section-cards.tsx` | `dashboard.tsx` | 4-col grid · label+icon top · `text-2xl` value · badge row · description |
| Forecast stats bar | `forecast-summary-bar.tsx` | `reports-forecasts.tsx` tab Dự báo | 4-col grid · cùng pattern nhưng viết lại riêng biệt |
| Analytics metric card | `analytics.tsx` (inline) | `analytics.tsx` | Dùng `Card + CardHeader + CardTitle + CardContent` — format khác 2 cái trên |

**Vấn đề**: 3 chỗ cùng mục đích (stats overview) nhưng implement riêng, không có component chung.

---

## 3. Card/Section Header (Tiêu đề block nội dung)

| Variant | Component | Dùng tại | Structure |
|---|---|---|---|
| `CardSectionHeader` | `components/card-section-header.tsx` | 4 dashboard components | icon hộp 8×8 + `text-sm font-medium` title + description + badge + menu |
| `CardTitle` + icon inline | JSX in-place | `forecast-history-table.tsx`, `analytics.tsx` | `<CardTitle className="text-sm font-medium flex items-center gap-2"><Icon/> Text</CardTitle>` |
| `CardTitle` không icon | JSX in-place | Nhiều chỗ trong `analytics.tsx` | `<CardTitle>` thuần, không có size control nhất quán |
| Icon box + `CardTitle` | `model-card.tsx` | `models/model-card.tsx` | `div p-2 rounded-lg bg-primary/10` + `<CardTitle className="text-sm">` — gần giống CardSectionHeader nhưng không dùng component |

**Vấn đề**: Chỉ 4 dashboard files dùng `CardSectionHeader`, còn lại (`analytics`, `models`, `reports-forecasts`, `data-library`) đều dùng raw JSX hoặc `CardTitle`.

---

## 4. Charts (Biểu đồ)

| Loại | Component | Dùng tại | Recharts component |
|---|---|---|---|
| Area chart (2 series) | `chart-area-interactive.tsx` | dashboard | `AreaChart` + gradient fill + legend text |
| Bar chart | `traffic-density-chart.tsx` | dashboard | `BarChart` + LabelList + gradient |
| Area chart mini (forecast) | `camera-detail-dialog.tsx` | monitoring | `AreaChart` + PctForecastLabel custom |
| Area chart (forecast timeline) | `forecast-timeline-chart.tsx` | reports-forecasts | `AreaChart` + `ReferenceLine` hện tại |

**Ghi chú**: Tất cả dùng `ChartContainer + ChartTooltip` từ shadcn/ui — nhất quán về wrapper. Tooltip format chưa đồng nhất.

---

## 5. Tables (Bảng dữ liệu)

| Loại | Component | Dùng tại | Tính năng |
|---|---|---|---|
| TanStack table (full) | `data-table.tsx` | dashboard | Sort, filter, pagination, column toggle, row click → Sheet |
| shadcn `Table` (simple) | `model-detail-sheet.tsx` | models | Sort, search, date filter, pagination thủ công |
| shadcn `Table` (simple) | `analytics.tsx` | analytics | Static, không sort/filter |
| shadcn `Table` (simple) | `forecast-history-table.tsx` | reports-forecasts | Filter by camera, không sort |

**Vấn đề**: `model-detail-sheet.tsx` implement pagination + sort thủ công. Nên có pattern chung cho simple sortable table.

---

## 6. Badge (Nhãn trạng thái / loại)

| Variant | Class pattern | Dùng tại |
|---|---|---|
| **Chuẩn mới** (semantic, dark-mode) | `variant="outline" text-[10px] px-1.5 py-0 text-{color}-700 border-{color}-200 bg-{color}-50 dark:bg-{color}-950/30 dark:text-{color}-400` | `section-cards`, `data-table`, `forecast-accuracy-card`, `report-row`, `report-card`, `forecast-history-table` |
| Badge cũ / analytics | `variant="outline"` không có bg/dark class | `analytics.tsx` — `getQualityBadge()` |
| Badge analytics destructive | `variant="destructive"` | `analytics.tsx` — Kém/Cần cải thiện |
| Badge source | `variant="default"/"secondary"` | `data-library.tsx` CollectionCard — khác toàn bộ |
| Badge active model | `bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0` | `model-card.tsx` — thiếu dark mode |

**Vấn đề**: `analytics.tsx` và `model-card.tsx` dùng pattern badge cũ, thiếu dark mode và size chuẩn.

---

## 7. Modal / Detail Panel

| Loại | Component | Dùng tại | Trigger |
|---|---|---|---|
| **Sheet** (slide-in phải) | `data-table.tsx` — `TableCellViewerModal` | dashboard | Click row trong table |
| **Sheet** | `model-detail-sheet.tsx` | models | Click "Xem chi tiết" trên ModelCard |
| **Sheet** | `collection-detail-sheet.tsx` | data-library | Click card/button |
| **Sheet** | `search/detail-sheet.tsx` | search | Click result item |
| **Dialog** | `camera-detail-dialog.tsx` | monitoring | Button "Xem thông tin chi tiết" |
| **AlertDialog** | Inline trong `collection-detail-sheet`, `data-library` | data-library | Confirm xóa |
| **Dialog** | `activate-model-dialog.tsx` | models | Button "Kích hoạt" |
| **Dialog** | `edit-collection-dialog.tsx` | data-library | Button chỉnh sửa |
| **Dialog** | `train-new-version-modal.tsx` | models | Button "Huấn luyện mới" |

**Ghi chú**: Nhất quán tương đối — Sheet cho liệt kê chi tiết, Dialog/AlertDialog cho xác nhận/form. Tuy nhiên camera detail dùng Dialog thay Sheet (bất nhất với các detail panel khác).

---

## 8. Filter / Search Bar

| Pattern | Dùng tại | Components |
|---|---|---|
| `Input` search + `Select` filter(s) + reset `Button` | `data-table.tsx`, `model-detail-sheet.tsx` | Flat row, no card wrapper |
| `Input` search + 2× `Select` | `data-library.tsx` | Flat row |
| `Tabs` + `Select` camera | `traffic-density-chart.tsx` | Tabs cho period, Select cho camera |
| `Tabs` + view toggle (`Button` grid/list) + `Input` search | `reports-forecasts.tsx` | Tabs chính + search trong Báo cáo tab |
| `Input` + tag + debounce | `search.tsx` | Standalone search page |

**Vấn đề**: Không có pattern chung cho filter bar — mỗi trang viết riêng, positioning và styling khác nhau.

---

## 9. List Row Items (Hàng trong danh sách)

| Loại | Component | Dùng tại | Structure |
|---|---|---|---|
| Document row | `report-row.tsx` | reports-forecasts | Hộp icon 8×8 + title + badges + meta + action buttons góc phải |
| Search result | `result-item.tsx` | search | Hộp icon 8×8 + title + badge + hover-reveal button |
| Camera ranking | inline trong `analytics.tsx` | analytics | Không có icon, text-only, 2 cột left/right |
| Accordion file row | inline trong `collection-detail-sheet.tsx` | data-library | Icon file + filename + size + download button |

**Vấn đề**: `CameraRankingList` trong analytics thiếu icon box và không dùng hover pattern chuẩn.

---

## 10. Card Grid Items (Card trong danh sách lưới)

| Loại | Component | Dùng tại | Header style |
|---|---|---|---|
| Model card | `model-card.tsx` | models | icon box `p-2 bg-primary/10` + `CardTitle text-sm` + badge góc phải |
| Report card | `report-card.tsx` | reports-forecasts | icon box `h-10 w-10 border bg-muted/50` + `font-medium text-sm` (raw div) |
| Collection card | inline `data-library.tsx` | data-library | `IconDatabase` inline + `CardTitle text-base` (quá lớn!) |
| Forecast next panel | `forecast-next-panel.tsx` | reports-forecasts | Không có header chính thức |

**Vấn đề**: 
- `CollectionCard` dùng `text-base` (lớn hơn chuẩn `text-sm`)
- Icon box size không thống nhất: p-2 / h-10 w-10 / h-9 w-9 / size-8
- `ModelCard` không dùng `CardSectionHeader`

---

## 11. Metric Chip (Chỉ số nhỏ gọn)

| Variant | Component | Dùng tại | Value size |
|---|---|---|---|
| `MetricChip` | `models/metric-chip.tsx` | `model-card.tsx`, `model-detail-sheet.tsx` | **`text-base font-semibold`** — quá lớn so với context |
| Metric row (2-col) | Inline trong `analytics.tsx` | analytics | `text-sm font-semibold` |
| Inline metric text | Inline nhiều chỗ | camera detail, section cards | Không dùng chip |

**Vấn đề**: `MetricChip` value `text-base` vi phạm font size rule. Nên là `text-sm font-semibold`.

---

## 12. Progress Bar

| Loại | Dùng tại | Implementation |
|---|---|---|
| 3-color segment bar | `section-cards.tsx` (LOS traffic) | `div flex h-1.5` với 3 div con |
| V/C ratio bar | `data-table.tsx`, `camera-detail-dialog.tsx` | `div h-1.5 rounded-full bg-muted` + inner div width% |
| shadcn `<Progress>` | `forecast-history-table.tsx`, `forecast-next-panel.tsx` | `<Progress value={x} className="h-1.5" />` |

**Ghi chú**: V/C bar và `<Progress>` làm cùng việc — nên thống nhất dùng một trong hai.

---

## 13. Camera Cell / Media

| Loại | Component | Dùng tại |
|---|---|---|
| Camera wall grid | `camera-wall-cell.tsx` | monitoring — grid view |
| Inline camera image | JSX trong nhiều sheet | data-table Sheet, camera-detail-dialog |

---

## 14. Accordion / Collapsible

| Component | Dùng tại | Mục đích |
|---|---|---|
| `Collapsible` | `analytics.tsx` | Thu/mở giải thích về chỉ số |
| `Accordion` | `collection-detail-sheet.tsx` | Nhóm entries theo ngày |

---

## 15. Tooltip

| Dùng tại | Trigger |
|---|---|
| `data-library.tsx` edit button | Hover button icon nhỏ |
| `report-row.tsx` download button | Hover button |
| `analytics.tsx` metric labels | Hover icon `?` kèm tiêu đề |

---

## 16. Empty State (Trạng thái rỗng)

| Variant | Dùng tại |
|---|---|
| Icon lớn + `text-sm font-medium` + `text-xs` description | `data-table.tsx`, `camera-wall-view.tsx` |
| Chỉ text `text-sm text-muted-foreground` | `analytics.tsx` CameraRankingList, `forecast-accuracy-card.tsx` |
| Không có (bỏ qua) | Một số component chưa handle |

**Vấn đề**: Cần chuẩn hóa thành 1 pattern duy nhất (icon + 2 dòng text).

---

## 17. Skeleton / Loading State

| Variant | Dùng tại |
|---|---|
| `<Skeleton>` lines | `forecast-accuracy-card.tsx`, `data-library.tsx` CollectionCardSkeleton |
| `animate-pulse` div thủ công | `forecast-accuracy-card.tsx` list rows |
| `page-loading-overlay.tsx` spinner | Toàn trang khi route navigate |
| `top-progress-bar.tsx` | Route transitions |
| Inline `IconLoader2 animate-spin` | `login.tsx` submit button, `report-row.tsx` processing |

---

## 18. Action Buttons

| Pattern | Class | Dùng tại |
|---|---|---|
| Primary CTA | `Button` default full-width | Các form submit, camera detail |
| Secondary outline | `Button variant="outline"` | Hầu hết action phụ |
| Ghost icon-only | `Button variant="ghost" size="sm" h-6 w-6 p-0` | Edit/delete inline |
| Ghost text-sm | `Button variant="ghost" h-7 px-2 text-xs` | Hover-reveal "Xem" trong search |
| Destructive | `Button variant="destructive"` | Confirm xóa trong dialog |

---

## Tổng hợp điểm cần đồng nhất (Ưu tiên cao → thấp)

| STT | Vấn đề | Phạm vi ảnh hưởng |
|:---:|---|---|
| 1 | **Card header** — `analytics.tsx`, `model-card.tsx`, `forecast-history-table.tsx` chưa dùng `CardSectionHeader` | 3 files |
| 2 | **Badge** — `analytics.tsx` dùng `variant="destructive"` và thiếu dark mode | 1 file |
| 3 | **Stats card** — `forecast-summary-bar.tsx` và `section-cards.tsx` là 2 component riêng làm cùng việc | 2 files |
| 4 | **CollectionCard** title — `text-base` thay vì `text-sm` | 1 file |
| 5 | **MetricChip** value — `text-base` thay vì `text-sm` | 1 file |
| 6 | **Camera detail** — dùng Dialog thay Sheet (không nhất quán với các detail panel khác) | 1 file |
| 7 | **Filter bar** — không có pattern/component chung | 4+ trang |
| 8 | **Progress bar** — V/C bar custom vs `<Progress>` shadcn lẫn lộn | 3 files |
| 9 | **Empty state** — 2 cách khác nhau | Nhiều files |
| 10 | **List row** — `CameraRankingList` thiếu icon box và hover pattern | 1 file |
