# Kế hoạch Thiết kế: Camera Wall – Màn hình giám sát đa camera

> **Ngày tạo:** 06/03/2026 | **Cập nhật:** 06/03/2026  
> **Phạm vi:** `web/src/pages/lifecycle.tsx` (view mode mới) + component `CameraWallCell`  
> **Liên quan:** `SocketContext`, `lifecycle.tsx` (tích hợp trực tiếp – **không tạo route mới**)

> **⚠️ Quyết định thiết kế:**  
> - Tích hợp vào `lifecycle.tsx` dưới dạng toggle view mode (Grid Cards ↔ Camera Wall)  
> - Overlay tối giản: chỉ hiển thị ảnh + thông tin cơ bản (tên, status dot) – không quá nhiều thông tin  
> - **Đã xóa auto-rotate**: ảnh cập nhật tự động qua Socket – không cần timer chuyển trang tự động  
> - **Route fix**: `/:prefix` (ví dụ `/user`) tự redirect → `/user/dashboard`

---

## 🎯 Mục tiêu

Xây dựng trang **Camera Wall** – giao diện fullscreen hiển thị nhiều camera đồng thời trên một màn hình rộng chuyên dụng. Phù hợp với use case đặt màn hình lớn tại trung tâm điều phối giao thông để theo dõi toàn bộ camera đang hoạt động.

---

## 🏗️ Kiến trúc Tổng quan

```
/user/lifecycle (lifecycle.tsx) – TÍCH HỢP TRỰC TIẾP
    │
    ├── PageHeader (đã có)
    │     └── [+ Nút toggle: 🔲 Chế độ Wall]  ← THÊM VÀO ĐÂY
    │
    ├── [VIEW MODE: "cards"] → Grid Cards hiện tại (giữ nguyên)
    │
    └── [VIEW MODE: "wall"] → Camera Wall (MỚI)
          │
          ├── Wall Toolbar (compact, 1 dòng)
          │     ├── Preset: [4][6][9][16][20][25]
          │     ├── ← Trang X/Y →
          │     └── [⛶ Toàn màn hình]  [✕ Thoát Wall]
          │
          ├── Camera Grid (CSS Grid dynamic)
          │     └── CameraWallCell × N
          │           ├── <img> từ camera.imageUrl (MinIO – tự cập nhật qua socket)
          │           └── Overlay tối giản (tên + status dot)
          │
          └── *(không có progress bar – auto-rotate đã xóa)*
```

**Data Flow**: Tái sử dụng `useSocket()`, `filteredCameras`, `processedCameras` đã có trong lifecycle.tsx → không cần API mới, không cần state mới cho data.

---

## 📐 Grid Presets

Người dùng chọn số camera hiển thị mỗi trang. Mỗi preset áp dụng CSS Grid class tương ứng:

| Preset | Grid | Ghi chú |
|--------|------|---------|
| **4** | `grid-cols-2 grid-rows-2` | Màn hình nhỏ / xem kỹ |
| **6** | `grid-cols-3 grid-rows-2` | Phổ biến |
| **9** | `grid-cols-3 grid-rows-3` | Standard CCTV 9-split |
| **16** | `grid-cols-4 grid-rows-4` | Standard CCTV 16-split |
| **20** | `grid-cols-5 grid-rows-4` | Màn hình rộng |
| **25** | `grid-cols-5 grid-rows-5` | Màn hình 4K |

> **Lưu ý:** Mỗi ô camera chiều cao = `100vh / rows` (fullscreen) hoặc `(100vh - toolbar) / rows` (normal mode).

### Layout đặc biệt cho 4 cams (spotlight mode – TODO sau):
```
┌──────────────┬─────┐
│   Camera 1   │ C2  │  ← Cam chính chiếm 2x2, 3 cam nhỏ bên phải
│   (spotlight)├─────┤
│              │ C3  │
└──────┬───────┴─────┘
       │     C4       │
       └──────────────┘
```
*(Phase 2 – bổ sung sau)*

---

## 🧩 Components Cần Tạo

### 1. `CameraWallCell` (`web/src/components/camera-wall-cell.tsx`)

```tsx
interface CameraWallCellProps {
  camera: CameraData;
  showOverlay?: boolean;  // default: true
}
```

**Ưu tiên hiển thị ảnh là chính.** Overlay chỉ mang thông tin tối thiểu để nhận dạng camera:

**Nội dung mỗi ô:**
- `<img src={camera.imageUrl} className="w-full h-full object-cover" />` – ảnh chiếm toàn bộ ô
- **Overlay dưới** (gradient đen mờ, mỏng – chỉ ~20% chiều cao ô):
  - Dấu chấm trạng thái: 🟢 có tín hiệu / 🔴 mất tín hiệu
  - Tên camera ngắn (truncate)
  - *(Không hiện xe count, badge LOS đầy đủ, forecast...)*
- **Nếu không có ảnh** (imageUrl null/undefined): nền tối + icon camera + "Không có tín hiệu"

> **Lý do tối giản:** Khi chiếu trên màn hình lớn với 9–25 ô, mỗi ô rất nhỏ → quá nhiều text/badge gây nhiễu. Mục tiêu chính là nhìn thấy hình ảnh camera.

### 2. State mới thêm vào `lifecycle.tsx`

```ts
// View mode toggle
const [viewMode, setViewMode] = useState<"cards" | "wall">("cards");

// Wall-specific state (chỉ dùng khi viewMode === "wall")
const [wallPerPage, setWallPerPage] = useState<number>(9);     // preset mặc định: 9
const [wallCurrentPage, setWallCurrentPage] = useState<number>(1);
const [wallAutoRotate, setWallAutoRotate] = useState<boolean>(false);
const [wallRotateInterval, setWallRotateInterval] = useState<number>(10); // seconds
const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
// showOverlay giữ luôn true (ẩn hẳn nếu cần sau)
```

> **Tái sử dụng từ lifecycle:** `filteredCameras` (đã filter + sort) dùng thẳng cho Wall Grid.

---

## 📄 Logic Phân trang

```ts
// Lọc cameras theo statusFilter
const filteredCameras = cameras.filter(cam =>
  statusFilter === "all" || cam.status.current === statusFilter
);

// Tính tổng trang
const totalPages = Math.ceil(filteredCameras.length / perPage);

// Cameras cho trang hiện tại
const pageCameras = filteredCameras.slice(
  (currentPage - 1) * perPage,
  currentPage * perPage
);

// Auto-rotate: nếu đang bật, mỗi `rotateInterval` giây → nextPage()
// Khi đến trang cuối → quay về trang 1
```

---

## 🖥️ Fullscreen Mode

Sử dụng [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) của trình duyệt:

```ts
const containerRef = useRef<HTMLDivElement>(null);

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await containerRef.current?.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
};

// Lắng nghe thay đổi fullscreen
useEffect(() => {
  const handler = () => setIsFullscreen(!!document.fullscreenElement);
  document.addEventListener("fullscreenchange", handler);
  return () => document.removeEventListener("fullscreenchange", handler);
}, []);
```

**Khi fullscreen:**
- Toolbar ẩn mặc định, hiện khi hover vào vùng trên cùng (`group/toolbar hover:opacity-100`)
- Pagination bar ẩn, điều hướng bằng phím mũi tên (keyboard shortcuts)
- Body tag nhận class `overflow-hidden` để tránh scroll

---

## ⌨️ Keyboard Shortcuts

| Phím | Hành động |
|------|-----------|
| `→` / `Space` | Trang tiếp theo |
| `←` | Trang trước |
| `F` | Toggle fullscreen |
| `Escape` | Thoát Wall (khi không fullscreen) |

---

## 🔄 Auto-rotate

> **⛔ Đã xóa khỏi implementation.**  
> Ảnh camera cập nhật tự động real-time qua SocketContext – không cần timer chuyển trang tự động. Phân trang thủ công (← →) đủ dùng.

---

## 🗺️ Tích hợp vào Lifecycle

**Không thêm route hay sidebar mới.** Chỉ thêm nút toggle vào `PageHeader` của lifecycle:

```tsx
// Trong PageHeader của lifecycle.tsx
<PageHeader ...>
  {/* Badge connected đã có */}
  <Badge variant={isConnected ? "default" : "destructive"}>...</Badge>
  
  {/* THÊM: Nút toggle view mode */}
  <Button
    variant={viewMode === "wall" ? "default" : "outline"}
    size="sm"
    onClick={() => setViewMode(v => v === "cards" ? "wall" : "cards")}
  >
    <IconLayoutGrid className="w-4 h-4 mr-1" />
    {viewMode === "wall" ? "Thoát Wall" : "Chế độ Wall"}
  </Button>
</PageHeader>
```

**Conditional rendering trong return:**
```tsx
{viewMode === "cards" ? (
  /* ... Grid Cards hiện tại... */
) : (
  <CameraWallView
    cameras={filteredCameras}
    perPage={wallPerPage}
    currentPage={wallCurrentPage}
    autoRotate={wallAutoRotate}
    rotateInterval={wallRotateInterval}
    onPerPageChange={setWallPerPage}
    onPageChange={setWallCurrentPage}
    onAutoRotateChange={setWallAutoRotate}
    onRotateIntervalChange={setWallRotateInterval}
    onExit={() => setViewMode("cards")}
  />
)}
```

> `CameraWallView` là component nội bộ trong `lifecycle.tsx` hoặc extract ra `web/src/components/camera-wall-view.tsx`.

---

## 🎨 UI Chi tiết

### Wall Toolbar (compact, 1 dòng):

```
┌────────────────────────────────────────────────────────────────────┐
│  Lưới: [4][6][9][16][20][25]   ← Trang 1/6 →   X camera         │
│  [⛶ Toàn màn hình]   [✕ Thoát Wall]                              │
└────────────────────────────────────────────────────────────────────┘
```

> Không cần filter trên Wall Toolbar – dùng filter từ lifecycle (đã lọc trước khi vào wall mode).

### Camera Grid (9-split ví dụ):

```
┌────────┬────────┬────────┐
│  Cam 1 │  Cam 2 │  Cam 3 │  ← Mỗi ô: ảnh camera + overlay status
├────────┼────────┼────────┤
│  Cam 4 │  Cam 5 │  Cam 6 │
├────────┼────────┼────────┤
│  Cam 7 │  Cam 8 │  Cam 9 │
└────────┴────────┴────────┘
```

### Mỗi ô CameraWallCell (tối giản):

```
┌─────────────────────────────┐
│                             │
│    [ảnh camera từ MinIO]    │  ← object-cover, chiếm toàn ô
│                             │
│ ● Hồng Bàng - Hoàng Lê Kha │  ← overlay mỏng, chỉ tên + dot
└─────────────────────────────┘
```

> Không hiển thị badge LOS, số xe, trend, forecast trong wall mode.

---

## 📋 Checklist Triển khai

### Phase 1 – Core (ưu tiên)
- [ ] Tạo `web/src/components/camera-wall-cell.tsx` (overlay tối giản: tên + dot)
- [ ] Tạo `web/src/components/camera-wall-view.tsx` (wall container + toolbar)
  - [ ] Grid rendering với 6 preset sizes
  - [ ] Pagination logic (tái dùng `filteredCameras` từ lifecycle)
  - [ ] Wall Toolbar compact (preset + pagination + auto-rotate + fullscreen)
- [ ] Thêm state `viewMode` + nút toggle vào `lifecycle.tsx`
- [ ] Conditional render: `viewMode === "wall"` → `<CameraWallView />`

### Phase 2 – Enhanced UX
- [x] Fullscreen API integration (✅ done)
- [x] Keyboard shortcuts (←→ trang, F fullscreen) (✅ done)
- [x] Toolbar fade in/out khi hover fullscreen (✅ done)
- ~~Auto-rotate with progress bar~~ – **đã xóa** (không cần, ảnh tự cập nhật qua socket)

### Phase 3 – Nâng cao (sau)
- [ ] Spotlight layout cho 4 cameras (1 lớn + 3 nhỏ)
- [ ] Kéo-thả sắp xếp thứ tự camera (DnD Kit – đã có trong project)
- [ ] Ghim camera (pinned cameras luôn xuất hiện trang 1)

---

## ⚠️ Lưu ý Kỹ thuật

1. **Image polling**: `camera.imageUrl` cập nhật qua SocketContext khi có data mới từ FIWARE → không cần polling thêm.
2. **Performance**: Với 25 ô ảnh đồng thời, cần `loading="lazy"` cho img tags và `will-change: opacity` cho overlay.
3. **Camera offline**: Khi `camera.imageUrl === null || undefined` → placeholder tối + icon camera + "Không có tín hiệu".
4. **Responsive**: Wall mode hiển thị warning trên mobile (`useIsMobile()` đã có) – đây là tính năng cho màn hình lớn.
5. **No scroll trong wall**: Wall container dùng `overflow-hidden`, chiều cao cố định = `100vh - toolbar`.
6. **Re-use filter state**: Khi chuyển sang wall mode, giữ nguyên `statusFilter`/`searchQuery` từ lifecycle → Wall chỉ phân trang `filteredCameras` đã lọc sẵn.
7. **Reset page khi đổi preset**: `setWallCurrentPage(1)` mỗi khi `wallPerPage` thay đổi.
