# UI Style Guide — Chuẩn thiết kế giao diện

> Dựa trên phong cách của `pages/reports-forecasts.tsx` được xác nhận là chuẩn (đẹp, rõ ràng, nhiều màu sắc, gọn gàng).
> Mọi component/page mới PHẢI tuân theo guide này.

---

## 1. Bảng màu ngữ nghĩa (Color Semantics)

| Màu      | Ý nghĩa ngữ cảnh                                |
|----------|-------------------------------------------------|
| `blue`   | Thông tin / thời gian / daily / link            |
| `purple` | Tuần / period / level thứ hai                   |
| `orange` | Tháng / xu hướng / cảnh báo nhẹ / warning-soft |
| `red`    | Sự cố / nguy cơ cao / lỗi / error              |
| `green`  | Thành công / chính xác / nguy cơ thấp           |
| `yellow` | Trung bình / nguy cơ vừa / cảnh báo             |
| `emerald`| Trôi chảy / bình thường / smooth               |
| `gray`   | Trung tính / disabled / N/A                     |

---

## 2. Badge Pattern

Badge chuẩn dùng `variant="outline"` với tone màu rõ ràng:

```tsx
<Badge
  variant="outline"
  className="text-[10px] px-1.5 py-0 text-{color}-700 border-{color}-200 bg-{color}-50 dark:bg-{color}-950/30 dark:text-{color}-400"
>
  Nội dung
</Badge>
```

### Áp dụng cho các loại badge:

| Badge type  | Color   | Class mẫu                                           |
|-------------|---------|-----------------------------------------------------|
| Type ngày   | blue    | `text-blue-700 border-blue-200 bg-blue-50`          |
| Type tuần   | purple  | `text-purple-700 border-purple-200 bg-purple-50`    |
| Type tháng  | orange  | `text-orange-700 border-orange-200 bg-orange-50`    |
| Sự cố       | red     | `text-red-700 border-red-200 bg-red-50`             |
| Đã tạo      | green   | `text-green-700 border-green-200 bg-green-50`       |
| Đang xử lý  | yellow  | `text-yellow-700 border-yellow-200 bg-yellow-50`    |
| Thất bại    | red     | `text-red-700 border-red-200 bg-red-50`             |
| Hành động   | blue    | dùng `text-blue-700 ...` với icon Generate          |
| Xóa         | red     | dùng `text-red-700 ...` với icon Trash              |
| Tải xuống   | green   | dùng `text-green-700 ...` với icon Download         |

---

## 3. Stats Card Layout

Dùng pattern "label + icon top / value bottom" (kiểu dashboard metric):

```tsx
<Card className="flex-1">
  <CardContent className="pt-4 pb-4">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-muted-foreground">Tên chỉ số</span>
      <IconName className="size-4 text-{color}-500" />
    </div>
    <div className="text-2xl font-bold tabular-nums">{value}</div>
    <p className="text-[11px] text-muted-foreground mt-0.5">{subText}</p>
  </CardContent>
</Card>
```

- Label: `text-xs text-muted-foreground`
- Icon: `size-4`, top-right (`justify-between`)
- Value: `text-2xl font-bold tabular-nums`
- Sub text: `text-[11px] text-muted-foreground`

---

## 4. Table / List Row Pattern

```tsx
<div className="flex items-center gap-3 py-3 px-4 border-b last:border-0 hover:bg-accent/40 transition-colors">
  {/* Icon vùng — fixed width */}
  <div className="size-9 rounded-lg bg-{color}-100 dark:bg-{color}-950/40 flex items-center justify-center shrink-0">
    <IconName className="size-4 text-{color}-600 dark:text-{color}-400" />
  </div>

  {/* Content — flex-1 */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">{title}</p>
    <div className="flex items-center gap-1.5 mt-0.5">
      {/* badges, metadata */}
    </div>
  </div>

  {/* Actions — right-aligned, shrink-0 */}
  <div className="flex items-center gap-1 shrink-0">
    <Button variant="ghost" size="sm">...</Button>
  </div>
</div>
```

- Hover: `hover:bg-accent/40`
- Divider: `border-b last:border-0`
- Transition: `transition-colors`
- Icon container: 36px (`size-9`), màu nhạt bg + màu đậm icon

---

## 5. Threshold / Error Badges

Dùng màu theo ngưỡng giá trị — áp dụng cho mọi chỉ số sai số hay mức độ:

| Ngưỡng    | Màu       | Ý nghĩa     |
|-----------|-----------|-------------|
| ≤ 5%      | `green`   | Tốt / Thấp  |
| 5% – 15%  | `yellow`  | Trung bình  |
| > 15%     | `red`     | Xấu / Cao   |

```tsx
function ErrorBadge({ value }: { value: number }) {
  const color = value <= 5 ? "green" : value <= 15 ? "yellow" : "red";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}>
      {value}%
    </Badge>
  );
}
```

---

## 6. LOS (Level of Service) Colors

```ts
const LOS_COLORS = {
  free_flow:  "green",    // Thông thoáng
  smooth:     "emerald",  // Trôi chảy
  moderate:   "yellow",   // Vừa phải
  heavy:      "orange",   // Đông đúc
  congested:  "red",      // Ùn tắc
};
```

---

## 7. Risk Level Colors

```ts
const RISK_COLORS = {
  low:    "green",
  medium: "yellow",
  high:   "red",
};
```

---

## 8. Delta / Trend Coloring

Khi hiển thị delta % so với baseline (giá trị thay đổi):

| Điều kiện   | Màu      |
|-------------|----------|
| > +10%      | `red`    |
| > 0%        | `orange` |
| ≤ 0%        | `green`  |

---

## 9. Chart Pattern (AreaChart)

```tsx
// Gradient defs — luôn dùng trong AreaChart
<defs>
  <linearGradient id="fillPredicted" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
  </linearGradient>
</defs>

// 2 series: actual (solid) + predicted (dashed)
<Area dataKey="actual"    stroke="var(--chart-2)"  fill="url(#fillActual)"    strokeWidth={2} />
<Area dataKey="predicted" stroke="var(--primary)"  fill="url(#fillPredicted)" strokeWidth={2} strokeDasharray="5 3" />

// ReferenceLine cho "now"
<ReferenceLine x={NOW_LABEL} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
```

---

## 10. Progress Bar Pattern (Confidence / Mức tin cậy)

```tsx
<div className="flex items-center gap-2">
  <Progress value={confidence} className="h-1.5 flex-1" />
  <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{confidence}%</span>
</div>
```

---

## 11. Spacing & Layout Constants

| Element            | Class                          |
|--------------------|-------------------------------|
| Card gap trong grid| `gap-3` / `gap-4`             |
| Section gap        | `flex flex-col gap-4`         |
| Inline badge gap   | `flex items-center gap-1.5`   |
| Icon size — list   | `size-3.5` đến `size-4`       |
| Icon size — heading| `size-4` đến `size-5`         |
| Row padding        | `py-3 px-4`                   |
| Card content pt    | `pt-4 pb-4`                   |

---

## 12. Empty State Pattern

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
  <IconName className="size-10 mb-3 opacity-30" />
  <p className="text-sm font-medium">Không có dữ liệu</p>
  <p className="text-xs mt-1">Mô tả ngắn gọn nguyên nhân</p>
</div>
```

---

---

## 13. Card/Chart/Table Title Pattern (CardSectionHeader)

**Quy tắc bắt buộc**: Mọi card có biểu đồ (chart) hoặc bảng liệt kê (table) PHẢI dùng `<CardSectionHeader>` từ `@/components/card-section-header`. KHÔNG dùng `CardTitle`/`CardDescription` trực tiếp cho heading của chart/table.

### Component API:

```tsx
import { CardSectionHeader } from "@/components/card-section-header"

<CardSectionHeader
  icon={SomeIcon}           // bắt buộc — lucide-react / @tabler/icons-react
  title="Tiêu đề"           // bắt buộc — luôn text-sm font-medium
  iconColor="text-blue-600 dark:text-blue-400"         // tùy chỉnh màu icon
  iconBg="bg-blue-100 dark:bg-blue-950/40"             // tùy chỉnh nền ô icon
  description="Mô tả phụ"                              // text-[11px] dưới title
  action={<button>Xem →</button>}  // ngang hàng với title (inline)
  badge={<Badge>12 camera</Badge>} // sau khối text
  menu={<DropdownMenu>...</DropdownMenu>}               // flush-right (ml-auto)
  className="w-full"        // thêm khi cần full-width
/>
```

### Quy tắc font size trong chart/table:

| Vị trí | Class | Ghi chú |
|---|---|---|
| Title | `text-sm font-medium` | Bắt buộc, không thay đổi |
| Description / label | `text-[11px] text-muted-foreground` | Nhỏ hơn title |
| Column header table | `text-xs` | Nhỏ hơn title |
| Cell text | `text-xs` đến `text-sm` | Tối đa `text-sm` |
| Giá trị số liệu chính | `text-2xl font-bold tabular-nums` | Ngoại lệ duy nhất |

> Mẫu chuẩn: `data-table.tsx` (với `menu`) · `chart-area-interactive.tsx` (với `action`) · `forecast-accuracy-card.tsx` · `traffic-density-chart.tsx`
