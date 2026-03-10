# Thiết kế nâng cấp trang Tìm kiếm (`search.tsx`)

> Ngày tạo: 10/03/2026  
> Trang hiện tại: `web/src/pages/search.tsx`

---

## 1. Hiện trạng

Trang hiện tại (`search.tsx`) chỉ là **UI tĩnh (mock)**:
- Input tìm kiếm + nút "Tìm kiếm" (không gọi API)
- "Tìm kiếm gần đây" hardcode 4 cụm từ cố định
- "Truy cập nhanh" hardcode 3 mục cố định
- Không có kết quả thực tế, không filter, không điều hướng

---

## 2. Mục tiêu nâng cấp

Biến trang tìm kiếm thành **công cụ tìm kiếm toàn cục** (global search) thực sự hữu ích cho hệ thống giao thông đô thị, cho phép tìm kiếm xuyên suốt các thực thể: camera, mô hình, báo cáo, dữ liệu dự báo.

---

## 3. Các ý tưởng thiết kế

### 3.1 Command Palette Style (Ưu tiên cao)
Lấy cảm hứng từ **VS Code Cmd+K**, **Linear**, **Raycast**:

- Khi nhấn `Ctrl+K` / `Cmd+K` (bất kỳ trang nào), mở **Dialog tìm kiếm toàn màn hình**
- Input luôn được focus
- Kết quả hiển thị ngay khi gõ (debounce 300ms)
- Nhấn `Esc` để đóng
- Điều hướng bằng `↑` `↓`, `Enter` để mở kết quả

**Component**: `CommandDialog` từ [cmdk](https://cmdk.paco.me/) (đã có sẵn trong ShadCN `command.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│  🔍  Tìm kiếm...                             Esc        │
├─────────────────────────────────────────────────────────┤
│  📷  Camera                                             │
│      Ngã tư Nguyễn Huệ - Lê Lợi         > Xem live     │
│      Cầu Sài Gòn Camera 01               > Xem live     │
│                                                         │
│  📊  Mô hình ML                                         │
│      LSTM Traffic v2.1                   > Chi tiết     │
│      XGBoost Peak Hour                   > Chi tiết     │
│                                                         │
│  📁  Báo cáo                                            │
│      Báo cáo tháng 2/2026                > Mở           │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 Trang /search – Phân loại kết quả (Tabs/Filters)

Thay vì một danh sách phẳng, chia kết quả theo **Tab hoặc Badge filter**:

```
[Tất cả]  [📷 Camera (4)]  [📊 Mô hình (2)]  [📁 Báo cáo (3)]  [🔮 Dự báo (1)]
```

- Mỗi tab hiển thị danh sách kết quả tương ứng
- Có skeleton loading khi đang fetch
- Empty state khi không có kết quả

---

### 3.3 Các scope tìm kiếm thực tế

| Scope | Nguồn dữ liệu API | Thông tin hiển thị |
|---|---|---|
| **Camera** | `GET /api/cameras` | Tên camera, vị trí, trạng thái (online/offline), lưu lượng hiện tại |
| **Mô hình ML** | `GET /api/models` | Tên model, loại (LSTM/XGB...), độ chính xác, ngày train |
| **Báo cáo** | `GET /api/reports` | Tiêu đề, loại báo cáo, ngày tạo |
| **Thư viện dữ liệu** | `GET /api/data-library` | Tên collection, số entries, loại dữ liệu |
| **Dự báo** | `GET /api/forecasts` | Camera, khung giờ dự báo, mức độ ùn tắc |

---

### 3.4 Tìm kiếm gần đây – Lưu localStorage

Thay vì hardcode, lưu lịch sử tìm kiếm vào `localStorage`:

```ts
const MAX_HISTORY = 8;
// Khi search thành công → push vào history
// Hiển thị X button để xóa từng mục
// Nút "Xóa tất cả lịch sử"
```

---

### 3.5 Kết quả nổi bật (Highlighted Match)

Khi hiển thị kết quả, **highlight** phần text khớp với từ khóa tìm kiếm:

```
Camera: Ngã tư [Nguyễn Huệ] - Lê Lợi   ← highlight "Nguyễn Huệ"
```

Dùng regex hoặc thư viện `mark.js` / custom component `<Highlight>`.

---

### 3.6 Quick Actions – Không cần tìm kiếm

Một section "Hành động nhanh" cố định phía trên kết quả (hoặc khi input rỗng):

```
🔄  Làm mới dữ liệu camera
📊  Xem mô hình đang active
📥  Xuất báo cáo hôm nay
🗺️  Mở bản đồ giám sát
```

---

### 3.7 Trạng thái Empty / Error / Loading

- **Loading**: Skeleton cards trong khi debounce đang chạy
- **Empty**: Illustration nhỏ + text "Không tìm thấy kết quả cho '{query}'" + gợi ý: "Thử tìm: camera, mô hình, báo cáo"
- **Error**: Toast + retry button (nếu API lỗi)

---

## 4. Giao diện trang `/search` đề xuất

```
┌──────────────────────────────────────────────────────────────────┐
│  [🔍 Icon]  Tìm kiếm                                             │
│  Tìm kiếm dữ liệu, báo cáo và thông tin giao thông              │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  [Tìm kiếm]  │
│  │ 🔍  Nhập từ khóa tìm kiếm...         ✕ Xóa   │              │
│  └────────────────────────────────────────────────┘              │
│                                                                  │
│  [ Tất cả ]  [ 📷 Camera ]  [ 📊 Mô hình ]  [ 📁 Báo cáo ]     │
│                                                                  │
│  ── Kết quả (8 mục) ────────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 📷  Ngã tư [Nguyễn] Huệ - Lê Lợi          [Vị trí]     │   │
│  │     145 xe/giờ • Online • Cập nhật 2 phút trước  [Xem]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 📊  LSTM Traffic v2.1                       [Mô hình]   │   │
│  │     Độ chính xác: 94.2% • Huấn luyện: 01/03/2026 [Xem] │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ── Tìm kiếm gần đây ──────────────────────────────────────    │
│  [⏱ Lưu lượng Ngã tư Bến Thành ✕]  [⏱ Dự đoán giờ cao điểm ✕] │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Thứ tự ưu tiên triển khai

| Giai đoạn | Nội dung | Mức độ |
|---|---|---|
| **Phase 1** | Kết nối API thực tế cho camera search | Cao |
| **Phase 2** | Lọc theo tab (Camera/Mô hình/Báo cáo) | Cao |
| **Phase 3** | Lưu history vào localStorage | Trung bình |
| **Phase 4** | Highlight từ khóa trong kết quả | Trung bình |
| **Phase 5** | Command Palette (`Ctrl+K`) toàn app | Thấp (nice-to-have) |
| **Phase 6** | Quick Actions (shortcuts) | Thấp |

---

## 6. Notes kỹ thuật

- **Debounce**: 300ms sau khi ngừng gõ mới gọi API (dùng `useEffect` + `setTimeout` / thư viện `use-debounce`)  
- **ShadCN Command**: Component `<Command>` + `<CommandDialog>` đã có sẵn, dùng cho Command Palette  
- **API Design**: Cần endpoint `GET /api/search?q=...&type=camera|model|report` tại backend  
- **State**: `useState` cho query, results, activeTab, isLoading; không cần Redux/Zustand  
- **URL Sync**: Sync query param `?q=...` vào URL để share link tìm kiếm được (`useSearchParams`)

