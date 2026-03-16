# Frontend Coding Rules

> Đọc file này khi thực hiện task liên quan đến UI/UX, component React, routing, và đặc biệt là luôn sử dụng Tailwind/ShadCN (chỉ suy nghĩ sử dụng css hay cách thiết kế đặc thù khi và chỉ khi không có trong Tailwind/ShadCN).
> Nguồn sự thật cho phong cách giao diện: `style-guide/frontend/UI_STYLE_GUIDE.md`

---

## 1. Component File Organization

- **Page-specific**: Component chỉ dùng cho 1 page → `components/{page-name}/`. Ví dụ: `ModelCard` → `components/models/model-card.tsx`.
- **Shared**: Component dùng cho ≥2 pages → `components/` root. Ví dụ: `PageHeader`, `HighlightText`, `TopProgressBar`.
- **Page file size**: Vượt ~500 lines hoặc ≥3 inline sub-component → BẮT BUỘC tách ra folder tương ứng.
- **Current folders**: `dashboard/`, `monitoring/`, `models/`, `search/`, `data-library/`, `reports-forecasts/` (tất cả tại `web/src/components/`).

---

## 2. UI/UX — Nguyên tắc chung

- Chỉ dùng **Shadcn UI** + **Tailwind CSS**.
- Icon: **Lucide React** hoặc **@tabler/icons-react** (thống nhất trong file).
- Text giao diện: **Tiếng Việt**.
- Mọi component/page mới tuân theo `UI_STYLE_GUIDE.md` (màu sắc, badge, stats card, table row, threshold, LOS, chart, empty state).

---

## 3. Dialog / Sheet / Drawer

- `DialogContent` và `AlertDialogContent` không cần thêm sizing — base `dialog.tsx` / `alert-dialog.tsx` đã có `w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto`.
- Detail views (Sheet/Dialog mở để đọc đầy đủ): TUYỆT ĐỐI KHÔNG dùng `truncate` — dùng `break-words`.

---

## 4. Tooltip

- Chỉ hiện khi hover (không khi focus). `tooltip.tsx` đã handle.
- `TooltipProvider delayDuration={200}`. Không dùng native `title=""`.

---

## 5. Text Overflow

- **Main pages** (card, list, table): `truncate` + `max-w-*`.
- **Detail views** (Sheet, Dialog, Drawer): `break-words` — hiển thị đầy đủ 100%.

---

## 6. Scroll

- Container có `overflow-y-auto` / `overflow-auto` PHẢI kèm class `scrollbar` (định nghĩa trong `index.css`).
- Không dùng `overflow-hidden` trên container chứa danh sách.

---

## 7. Chart Tooltip (Recharts)

- KHÔNG dùng `<ChartTooltipContent>` mặc định. PHẢI custom `content` render function.
- Wrapper: `rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]`
- Mỗi row: `flex items-center justify-between gap-3`, dấu màu `size-2 rounded-full` + `background: p.color`
- BarChart: `cursor={{ fill: "hsl(var(--foreground))", opacity: 0.05 }}` — AreaChart/LineChart: `cursor={false}`
- Xem mẫu: `web/src/components/dashboard/chart-area-interactive.tsx`

---

## 8. Loading (Page mới — BẮT BUỘC 2 lớp)

1. **Route-level**: `loader: () => new Promise(r => setTimeout(r, 0))` trong `App.tsx`. Dùng `setTimeout` không phải `Promise.resolve`.
2. **API-level**: `useLoading()` từ `@/contexts/LoadingContext` — `startLoading()` trước fetch, `stopLoading()` trong `finally`.
- Page tĩnh (không fetch) chỉ cần bước 1.

---

## 9. Custom Scrollbar

- KHÔNG dùng scrollbar mặc định trình duyệt.
- Mọi `overflow-y-auto` / `overflow-auto` PHẢI có class `scrollbar` (4px, bo tròn, `--muted-foreground` 25% / hover 50%).

---

## 10. Highlight Tìm Kiếm (`<HighlightText>`)

- **BẮT BUỘC** với mọi filter/search list. Import: `import { HighlightText } from "@/components/highlight-text"`.
- Dùng: `<HighlightText text={item.name} query={filterQuery} />` (query là live input, không debounce).
- Style cố định trong component — KHÔNG override. Fallback: query rỗng → text gốc.

---

## 11. Theme (dark/light)

- `index.html` PHẢI có inline `<script>` apply `dark`/`light` class trước React render — KHÔNG xóa.
- CSS transition chỉ active khi `html.theme-switching *` (toggle qua `ThemeContext.tsx`, 200ms). Tránh transition toàn cục.
- Recharts SVG: KHÔNG dùng `hsl(var(--...))` làm `fill` — dùng `useTheme()` từ `@/contexts/ThemeContext` rồi gán màu thực.
- Section lớn ngoài `<Card>` PHẢI có `bg-card rounded-xl border`.
- `useTheme` hook: luôn từ `@/contexts/ThemeContext`, KHÔNG từ `next-themes`.

---

## 12. Navigate State

- Sau khi consume `location.state`, BUỘC clear: `navigate(pathname, { replace: true, state: {} })`.

---

## 13. Ưu Tiên Custom Component Có Sẵn

- **BẮT BUỘC**: Trước khi tạo mới một component, PHẢI kiểm tra xem đã có custom component phù hợp trong `web/src/components/` chưa.
- Nếu component cần dùng ĐÃ được tham chiếu trong bản thiết kế (design doc, `assets/ideas/`), PHẢI ưu tiên sử dụng lại component đó thay vì tự implement lại.
- Ví dụ các custom component cần ưu tiên: `<HighlightText>`, `<PageHeader>`, `<TopProgressBar>`, `<StatusBadge>`, v.v.
- Chỉ tạo component mới khi: (1) chưa tồn tại, hoặc (2) yêu cầu behavior khác biệt không thể giải quyết qua props.
