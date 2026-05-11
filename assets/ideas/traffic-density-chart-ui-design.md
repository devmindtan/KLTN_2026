# UI Design: Chart Giao động Mật độ Giao thông

**Ngày**: 07/03/2026 | **Trạng thái**: Sẵn sàng implement giao diện

---

## 1. Vị trí trên Dashboard

Thêm component `<TrafficDensityChart />` vào `dashboard.tsx` ngay sau `<ChartAreaInteractive />`, trước `<DataTable />`:

```tsx
<SectionCards metrics={metrics} isConnected={isConnected} />
<div className="px-4 lg:px-6">
  <ChartAreaInteractive cameras={processedCameras} />
</div>
<div className="px-4 lg:px-6">
  <TrafficDensityChart />          {/* ← Thêm vào đây */}
</div>
<DataTable data={processedCameras} />
```

---

## 2. Layout tổng thể của Component

```
┌─────────────────────────────────────────────────────────────────┐
│  Card                                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CardHeader                                              │   │
│  │  Title: "Giao động Mật độ Giao thông"                   │   │
│  │  Desc:  "Phân tích lưu lượng theo chu kỳ thời gian"     │   │
│  │                              [Dropdown: Tất cả camera ▾]│   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Tabs (4 tabs, full-width)                               │   │
│  │  [Theo Giờ]  [Theo Ngày]  [Theo Tuần]  [Theo Tháng]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CardContent                                             │   │
│  │  BarChart (h-[280px])                                   │   │
│  │  - Bar màu gradient (chart-2 token)                     │   │
│  │  - Tooltip: "XX xe TB | Max: YY xe"                     │   │
│  │  - Label trục Y: "Xe TB / 5 phút"                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Thiết kế từng Tab

### Tab 1 — Theo Giờ (mặc định)

| Thuộc tính     | Giá trị                                     |
|---------------|---------------------------------------------|
| Trục X        | 00:00, 01:00, ..., 23:00 (24 cột)           |
| Trục Y        | 0 → max avg + 10% padding                   |
| Bar color     | `hsl(var(--chart-2))` (màu xanh teal)        |
| Highlight     | 2 bars cao nhất tô màu `chart-1` (cam)       |
| Tooltip       | `07:00 — TB: 87 xe · Max: 134 xe`           |
| Note dưới chart | "Dữ liệu trung bình trong 90 ngày qua"    |

### Tab 2 — Theo Ngày

| Thuộc tính     | Giá trị                                             |
|---------------|-----------------------------------------------------|
| Trục X        | Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6, Thứ 7, CN (7 cột) |
| Bar color     | `hsl(var(--chart-2))`                               |
| Highlight     | Bar "Thứ 6" + "Thứ 5" thường cao nhất              |
| Tooltip       | `Thứ 2 — TB: 72 xe · Max: 134 xe`                  |

### Tab 3 — Theo Tuần trong Tháng

| Thuộc tính     | Giá trị                                     |
|---------------|---------------------------------------------|
| Trục X        | Tuần 1, Tuần 2, Tuần 3, Tuần 4 (4 cột)     |
| Bar color     | `hsl(var(--chart-2))`                       |
| Tooltip       | `Tuần 1 — TB: 68 xe · Max: 112 xe`         |

### Tab 4 — Theo Tháng

| Thuộc tính     | Giá trị                                            |
|---------------|----------------------------------------------------|
| Trục X        | T1, T2, ..., T12 (12 cột)                         |
| Bar color     | `hsl(var(--chart-2))`                              |
| Tooltip       | `Tháng 3 — TB: 75 xe · Max: 128 xe`               |
| Note          | "Dữ liệu trong 12 tháng qua"                       |

---

## 4. Camera Dropdown

Tái sử dụng **đúng pattern** của `ChartAreaInteractive`:
- Vị trí: `absolute right-4 top-4` trong CardHeader
- Include search input bên trong dropdown
- Option đầu: "Tất cả camera (trung bình)"
- Các option: tên camera từ `camera_data` (hardcode trong mock, sau thay API)

---

## 5. File structure cần tạo

```
web/src/
├── components/
│   └── traffic-density-chart.tsx     ← Component chính
├── mock/
│   └── traffic-pattern-mock.ts       ← Mock data 4 tabs × 20 cameras
```

---

## 6. Mock Data Shape

```ts
// Một entry trong distribution
interface TrafficPatternPoint {
  label: string;        // "07:00" | "Thứ 2" | "Tuần 1" | "Tháng 3"
  avg_vehicles: number; // giá trị trung bình
  max_vehicles: number; // giá trị max
}

// Data gốc được mock
interface TrafficPatternMock {
  byHour:        TrafficPatternPoint[]; // 24 items
  byDow:         TrafficPatternPoint[]; // 7 items
  byWeekOfMonth: TrafficPatternPoint[]; // 4 items
  byMonth:       TrafficPatternPoint[]; // 12 items
}

// Exported: mock "tất cả cameras" + mock riêng cho ~3 cameras mẫu
export const mockAllCameras: TrafficPatternMock
export const mockByCameraId: Record<string, TrafficPatternMock>
```

---

## 7. Các trạng thái UI cần handle

| State             | Hiển thị                                                    |
|-------------------|-------------------------------------------------------------|
| Loading           | Skeleton bars (animate-pulse) inside ChartContainer         |
| No data           | Empty state: "Chưa có dữ liệu lịch sử"                     |
| Camera not found  | Fallback về "Tất cả camera"                                 |
| Data ready        | BarChart đầy đủ                                             |