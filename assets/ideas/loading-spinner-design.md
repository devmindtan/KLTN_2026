# Global Loading Spinner – Thiết kế kỹ thuật (v2)

**Mục tiêu**: Tách biệt 2 lớp feedback độc lập nhau — chuyển trang luôn có phản hồi ngay, dữ liệu chậm mới hiện spinner che trang.

---

## Hai lớp loading độc lập

| | Lớp 1: TopProgressBar | Lớp 2: PageLoadingOverlay |
|---|---|---|
| **Trigger** | React Router navigation (route change) | `useLoading().startLoading()` thủ công từ page/component |
| **Debounce** | Không — hiển thị ngay lập tức | 300ms — tránh flash khi API nhanh |
| **Vị trí** | Thanh 3px cố định đỉnh viewport | Overlay bán trong suốt phủ `<main>` |
| **Khi ẩn** | Route hoàn tất (`navigation.state === "idle"`) | `stopLoading()` (data về hoặc lỗi) |
| **Phụ thuộc** | Chỉ `useNavigation()` — **độc lập LoadingContext** | Dùng `LoadingContext` |
| **Mục đích** | Cảm giác phản hồi khi click menu/link | Chờ server trả dữ liệu sau khi trang đã mount |

---

## Lớp 1 — `TopProgressBar` (Route transition)

**Vai trò**: Mọi lần chuyển route đều có phản hồi thị giác ngay lập tức, bất kể API nhanh hay chậm.

### Hành vi
- Hiển thị **ngay lập tức** khi `navigation.state === "loading"`
- Animation fake progress: `0% → 85%` với ease-out trong khi đang load
- Khi route xong: nhảy lên `100%` nhanh → fade-out sau 200ms
- Hoàn toàn **không dùng LoadingContext**

### Kỹ thuật
```tsx
// top-progress-bar.tsx — tự dùng useNavigation() bên trong
const navigation = useNavigation()
const isNavigating = navigation.state === "loading"

// CSS: width controlled bằng state + CSS transition
// isNavigating=true  → width: 85%, transition: width 8s ease-out  (giả lập chậm)
// isNavigating=false → width: 100%, transition: width 200ms ease-in (chạy nốt)
//                   → sau 200ms → opacity: 0, width reset về 0%
```

### Không cần `RouterLoadingWatcher` nữa
`TopProgressBar` tự subscribe `useNavigation()` → file `router-loading-watcher.tsx` **bị xóa**.

---

## Lớp 2 — `PageLoadingOverlay` (API data slow)

**Vai trò**: Khi một trang đã mount nhưng đang chờ dữ liệu > 300ms, phủ overlay để tránh user thấy UI trống/skeleton lẫn lộn.

### Hành vi
- **Không hiện** nếu API trả về trong vòng 300ms
- Sau 300ms: overlay bán trong suốt (`bg-background/70 backdrop-blur-sm`) phủ lên `<main>`
- Giữa overlay: spinner xoay + text "Đang tải dữ liệu..."
- Tắt ngay khi `stopLoading()` (dù là data hoặc lỗi)

### Kỹ thuật
```tsx
// page-loading-overlay.tsx — dùng useLoading() từ LoadingContext
const { isLoading } = useLoading()

// Render: overlay fixed phủ main content (không che sidebar/header)
// Dùng pointer-events-none khi ẩn để không block click
```

### Cách page dùng
```tsx
// Trong bất kỳ page nào có fetch data:
const { startLoading, stopLoading } = useLoading()

useEffect(() => {
  startLoading()
  fetchData()
    .then(setData)
    .catch(setError)
    .finally(stopLoading)
}, [])
```

---

## `LoadingContext` — giữ nguyên

```tsx
interface LoadingContextType {
  startLoading: () => void  // debounce 300ms trước khi isLoading=true
  stopLoading: () => void   // tắt ngay lập tức
  isLoading: boolean
}
```

---

## Cấu trúc file

```
web/src/
  contexts/
    LoadingContext.tsx          ← giữ nguyên (debounce 300ms)
  components/
    top-progress-bar.tsx        ← viết lại: tự dùng useNavigation(), fake progress animation
    page-loading-overlay.tsx    ← tạo mới: overlay + spinner dùng useLoading()
    router-loading-watcher.tsx  ← XÓA (TopProgressBar tự handle)
```

---

## Tích hợp App.tsx

```tsx
const RootLayout = () => (
  <ThemeProvider>
    <AuthProvider>
      <LoadingProvider>
        <TopProgressBar />          {/* luôn ở đây, tự track useNavigation() */}
        <SocketProvider>
          <CustomSidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <SiteHeader />
              <main className="relative flex flex-1 flex-col">
                <PageLoadingOverlay /> {/* overlay phủ main, dùng LoadingContext */}
                <AuthGate>
                  <Outlet />
                </AuthGate>
              </main>
            </SidebarInset>
          </CustomSidebarProvider>
        </SocketProvider>
      </LoadingProvider>
    </AuthProvider>
  </ThemeProvider>
)
```

---

## Checklist triển khai

- [x] `LoadingContext.tsx` — đã có, giữ nguyên
- [ ] `top-progress-bar.tsx` — viết lại: fake progress, tự dùng `useNavigation()`
- [ ] `page-loading-overlay.tsx` — tạo mới: overlay + spinner
- [ ] Xóa `router-loading-watcher.tsx`
- [ ] Cập nhật `App.tsx`: bỏ `<RouterLoadingWatcher />`, thêm `<PageLoadingOverlay />` trong `<main>`
- [ ] Các page có fetch data: gọi `startLoading()` / `stopLoading()` quanh API calls
- [ ] Xóa loader giả 2s trong `App.tsx` (dùng để test)

---

## Lưu ý

- `TopProgressBar` **không** dùng `LoadingContext` — 2 lớp hoàn toàn tách biệt
- `PageLoadingOverlay` chỉ che `<main>` — sidebar và header vẫn tương tác được
- Nếu trang đã có per-component skeleton thì **không cần** gọi `startLoading()` — 2 pattern không xung đột
- iOS: `position: fixed` trên mobile có thể glitch khi scroll bounce → test riêng

