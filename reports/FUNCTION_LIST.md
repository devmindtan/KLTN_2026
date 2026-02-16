# 📋 MASTER FUNCTION LIST - Hệ thống Giám sát Giao thông

> **Session Context**: [Cập nhật: 16/02/2026] 

## 📝 Tổng quan hệ thống (System Overview)
- **Kiến trúc**: Microservices (Node.js API + Python ML Service + React).
- **Luồng dữ liệu chính**: Camera -> YOLO -> Database -> ML Prediction -> Dashboard.
- **Quy tắc quan trọng**: Mọi thay đổi về Logic trong bảng này phải được đồng bộ với `AGENT_LOG.md`.


Template:
<!-- ID | Chức năng / Route | Inputs / Outputs |	Trạng thái (Đã làm) | Hạn chế & Lý do (Chưa làm) | Logic & Giải pháp | Vị trí của các hàm đảm nhận chức năng | -->
---
## 📊 Danh sách chức năng chi tiết

### 🔷 Backend Node.js API Server

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TS-C01 | **GET /api/cameras** - Lấy tất cả camera | **Input:** None<br>**Output:** `{success, count, data: CameraInfo[]}` | ✅ | None | Query tất cả camera từ bảng `camera_data`, trả về `cam_id`, `location`, `display_name` | `backend/src/server/src/controllers/camera.controller.ts::getAllCameras()` |
| TS-C02 | **GET /api/cameras/:cam_id** - Chi tiết camera | **Input:** `cam_id` (string)<br>**Output:** `{success, data: CameraInfo}` | ✅ | None | Validation `cam_id`, query theo `cam_id`, trả về 404 nếu không tìm thấy | `backend/src/server/src/controllers/camera.controller.ts::getCameraById()` |
| TS-C03 | **GET /api/cameras/nearby** - Tìm camera gần | **Input:** `lat, lng, radius` (query)<br>**Output:** `{success, data: CameraInfo[]}` | ⚠️ | [TODO] Chưa implement logic tìm kiếm theo GPS thực sự, hiện tại chỉ return tất cả | Cần nâng cấp với PostGIS hoặc thuật toán Haversine để tính khoảng cách thực | `backend/src/server/src/controllers/camera.controller.ts::getNearbyCamera()` |
| TS-T01 | **GET /** - Health check | **Input:** None<br>**Output:** "Hello from testController!" | ✅ | None | Endpoint kiểm tra server đang hoạt động | `backend/src/server/src/controllers/test.controller.ts::testController()` |

---

### 🔷 Python ML Services

#### **📌 Image Processing Service** (`image-process`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-001 | **process_and_upload()** - Xử lý ảnh YOLO | **Input:** `camera_id, image_bytes`<br>**Output:** Detections, MinIO key | ✅ | None | Chạy YOLO detection, vẽ bounding boxes, upload lên MinIO, lưu kết quả vào DB | `backend/src/image-process/src/main.py::process_and_upload()` |
| PY-002 | **save_to_db()** - Lưu kết quả vào PostgreSQL | **Input:** `minio_key, cam_id, detections, total_objects`<br>**Output:** None | ✅ | None | Insert detection data vào bảng `traffic_data` với `detection_data` (JSONB) và `total_objects` | `backend/src/image-process/src/main.py::save_to_db()` |
| PY-003 | **YOLO Detection Loop** - Xử lý realtime | **Input:** Stream từ 20 cameras<br>**Output:** Continuous detection | ✅ | None | Async loop fetch ảnh từ camera URLs, xử lý YOLO, cập nhật FIWARE và PostgreSQL mỗi 5 phút | `backend/src/image-process/src/main.py::main()` |

#### **📌 ML Prediction Service** (`image-predict`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-004 | **train_camera_model()** - Huấn luyện ML model | **Input:** DataFrame với LAG/LEAD features<br>**Output:** Trained RandomForest model (.joblib) | ✅ | Cần ít nhất 100 records để train | Label encode `camera_id`, train với features (hour, day_of_week, LAG/LEAD), lưu model và encoder | `backend/src/image-predict/train.py::train_camera_model()` |
| PY-005 | **predict_realtime()** - Dự đoán realtime | **Input:** Current data từ DB<br>**Output:** Forecasts (5m, 10m, 15m, 30m, 60m) | ✅ | None | Load model, tạo LAG features, predict multiple horizons, tính LOS status & trend, cập nhật FIWARE | `backend/src/image-predict/predict_realtime.py::predict_realtime()` |
| PY-006 | **calculate_los_status()** - Tính LOS | **Input:** `volume, capacity` (float)<br>**Output:** Status string | ✅ | None | Tính V/C ratio, classify theo 5 mức: free_flow (<60%), smooth (60-75%), moderate (75-85%), heavy (85-100%), congested (≥100%) | `backend/src/image-predict/predict_realtime.py::calculate_los_status()` |
| PY-007 | **calculate_trend()** - Tính xu hướng | **Input:** `current_val, predicted_val, threshold`<br>**Output:** "increasing"/"decreasing"/"stable" | ✅ | None | So sánh diff với threshold (default 5), return xu hướng tăng/giảm/ổn định | `backend/src/image-predict/predict_realtime.py::calculate_trend()` |
| PY-008 | **get_camera_capacity_map()** - Capacity động | **Input:** `lookback_days=30, percentile=95`<br>**Output:** Dict `{cam_id: capacity}` | ✅ | None | Tính 95th percentile của `total_objects` trong 30 ngày qua theo từng camera, fallback về DEFAULT_CAPACITY (100) nếu thiếu data | `backend/src/image-predict/query.py::get_camera_capacity_map()` |
| PY-009 | **query_from_db_realtime()** - Lấy data realtime | **Input:** None<br>**Output:** DataFrame với current traffic data | ✅ | None | Query 5 phút gần nhất từ bảng `traffic_data`, group by camera, tính avg_objects | `backend/src/image-predict/query.py::query_from_db_realtime()` |
| PY-010 | **query_from_db_total()** - Lấy historical data | **Input:** `start_date, end_date`<br>**Output:** DataFrame với LAG/LEAD features | ✅ | None | Query data theo time range, tạo LAG (1-12) và LEAD features cho training | `backend/src/image-predict/query.py::query_from_db_total()` |
| PY-011 | **forecast_and_save_to_db()** - Lưu dự đoán | **Input:** `predictions, df_input`<br>**Output:** None | ✅ | None | Insert forecasts vào bảng `traffic_forecast` với `predicted_at`, `forecast_for`, `predicted_value` | `backend/src/image-predict/query.py::forecast_and_save_to_db()` |
| PY-012 | **sync_actual_values()** - Sync actual với forecast | **Input:** None<br>**Output:** None | ✅ | None | Update `actual_value` trong bảng `traffic_forecast` khi forecast_for đã qua (cho monitoring accuracy) | `backend/src/image-predict/query.py::sync_actual_values()` |
| PY-013 | **predict_total()** - Dự đoán batch | **Input:** New data for batch prediction<br>**Output:** Predictions array | ✅ | None | Load model, predict cho toàn bộ dataset (dùng cho evaluation/testing) | `backend/src/image-predict/predict_total.py::predict_total()` |
| PY-014 | **monitor_performance()** - Decorator logging | **Input:** Function to monitor<br>**Output:** Wrapped function with timing | ✅ | None | Decorator ghi log thời gian thực thi của function, dùng cho performance monitoring | `backend/src/image-predict/monitor_performance.py::monitor_performance()` |

#### **📌 App Route Service** (`app-route`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-015 | **POST /webhook** - Nhận FIWARE notifications | **Input:** FIWARE notification payload<br>**Output:** 200 OK | ✅ | None | Webhook nhận thông báo từ FIWARE Orion khi entity thay đổi, log và xử lý data | `backend/src/app-route/src/main.py::fiware_webhook()` |
| PY-016 | **get_ip()** - Lấy IP hiện tại | **Input:** None<br>**Output:** IP address string | ✅ | None | Utility function để lấy IP của server (dùng cho FIWARE subscription) | `backend/src/app-route/src/main.py::get_ip()` |
| PY-017 | **show_all_ips()** - Hiển thị server info | **Input:** `port`<br>**Output:** Print all available IPs | ✅ | None | In ra console tất cả IP addresses với port để debug/config FIWARE subscriptions | `backend/src/app-route/src/main.py::show_all_ips()` |

---

### 🔷 Frontend React Services

#### **📌 Camera Service** (`web-user/services`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TS-S01 | **getAllCameras()** - Lấy danh sách camera | **Input:** None<br>**Output:** `CameraInfo[]` | ✅ | None | Fetch `GET /api/cameras` từ Backend API, parse response, return array of cameras | `web/web-user/src/services/camera.service.ts::getAllCameras()` |
| TS-S02 | **getCameraById()** - Chi tiết camera | **Input:** `camId` (string)<br>**Output:** `CameraInfo \| null` | ✅ | None | Validation `camId`, fetch `GET /api/cameras/:camId`, return single camera hoặc null nếu không tìm thấy | `web/web-user/src/services/camera.service.ts::getCameraById()` |
| TS-S03 | **getNearbyCameras()** - Tìm camera gần | **Input:** `lat, lng, radius`<br>**Output:** `CameraInfo[]` | ⚠️ | [TODO] Backend chưa implement logic GPS thực | Fetch `GET /api/cameras/nearby`, hiện tại chỉ return tất cả cameras | `web/web-user/src/services/camera.service.ts::getNearbyCameras()` |

#### **📌 Socket Context** (`web-user/contexts`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-K01 | **SocketProvider** - Quản lý Socket.io | **Input:** React children<br>**Output:** Real-time camera data context | ✅ | None | Connect Socket.io, subscribe `camera:update`, merge với static camera info từ API, provide context cho toàn app | `web/web-user/src/contexts/SocketContext.tsx::SocketProvider()` |
| TSX-K02 | **useSocket()** - Hook lấy socket state | **Input:** None<br>**Output:** `{cameras, isConnected, socket}` | ✅ | None | Custom hook để components consume socket context data | `web/web-user/src/contexts/SocketContext.tsx::useSocket()` |

#### **📌 Theme Context** (`web-user/contexts`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-H01 | **ThemeProvider** - Quản lý Dark/Light mode | **Input:** React children<br>**Output:** Theme context | ✅ | None | Detect system preference, load từ localStorage, toggle theme, apply class "dark"/"light" vào `<html>` | `web/web-user/src/contexts/ThemeContext.tsx::ThemeProvider()` |
| TSX-H02 | **useTheme()** - Hook theme control | **Input:** None<br>**Output:** `{theme, toggleTheme, setTheme}` | ✅ | None | Custom hook để components toggle giữa dark/light mode | `web/web-user/src/contexts/ThemeContext.tsx::useTheme()` |

#### **📌 UI Components** (`web-user/components`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-A01 | **AppSidebar** - Main navigation sidebar | **Input:** None<br>**Output:** Collapsible sidebar UI | ✅ | None | Sidebar với NavMain, NavSecondary, NavDocuments, NavUser. Responsive collapse, navigation menu cho tất cả pages | `web/web-user/src/components/app-sidebar.tsx::AppSidebar()` |
| TSX-A02 | **SectionCards** - Dashboard metrics cards | **Input:** `metrics: Metrics, isConnected: boolean`<br>**Output:** 4 metric cards | ✅ | None | Hiển thị 4 cards: Tổng phương tiện, Camera hoạt động, Trạng thái (good/bad), Xu hướng. Real-time badge | `web/web-user/src/components/section-cards.tsx::SectionCards()` |
| TSX-A03 | **ChartAreaInteractive** - Area chart forecast | **Input:** `cameras: CameraData[]`<br>**Output:** Interactive area chart | ✅ | None | Chart với dropdown chọn camera, search, hiển thị forecasts 5/10/15/30/60 phút, responsive | `web/web-user/src/components/chart-area-interactive.tsx::ChartAreaInteractive()` |
| TSX-A04 | **NavMain** - Primary navigation menu | **Input:** `items: NavItem[]`<br>**Output:** Navigation menu | ✅ | None | Render primary nav items với icon, title, active state tracking từ current route | `web/web-user/src/components/nav-main.tsx::NavMain()` |
| TSX-A05 | **NavSecondary** - Secondary navigation menu | **Input:** `items: NavItem[]`<br>**Output:** Secondary nav menu | ✅ | None | Render secondary nav items (Settings, Help, Search) với active state | `web/web-user/src/components/nav-secondary.tsx::NavSecondary()` |
| TSX-A06 | **NavUser** - User profile menu | **Input:** `user: UserInfo`<br>**Output:** User dropdown menu | ✅ | None | Avatar + dropdown menu: Account, Notifications, Billing, Logout. Mobile responsive | `web/web-user/src/components/nav-user.tsx::NavUser()` |
| TSX-A07 | **NavDocuments** - Documents navigation | **Input:** `items: DocumentItem[]`<br>**Output:** Documents section menu | ✅ | None | Sidebar section hiển thị documents (Reports, Data Library, Word Assistant) với actions | `web/web-user/src/components/nav-documents.tsx::NavDocuments()` |
| TSX-A08 | **DataTable** - Bảng hiển thị camera data | **Input:** `data: CameraData[]`<br>**Output:** Interactive table | ✅ | None | TanStack Table với sorting, filtering, pagination, drag-and-drop reordering, responsive mobile | `web/web-user/src/components/data-table.tsx::DataTable()` |
| TSX-A09 | **ScrollToTop** - Nút cuộn lên đầu | **Input:** None (auto-detect scroll)<br>**Output:** Floating button | ✅ | None | Hiển thị khi scroll > 1 viewport, opacity 70%, smooth scroll to top | `web/web-user/src/components/scroll-to-top.tsx::ScrollToTop()` |
| TSX-A10 | **SiteHeader** - Header với breadcrumb | **Input:** Current route<br>**Output:** Header component | ✅ | None | Breadcrumb navigation từ pathname, theme toggle button góc phải | `web/web-user/src/components/site-header.tsx::SiteHeader()` |

#### **📌 Pages** (`web-user/pages`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-P01 | **Dashboard** - Trang tổng quan | **Input:** Real-time socket data<br>**Output:** Cards, charts, metrics | ✅ | None | Hiển thị tổng quan giao thông: total cameras, avg vehicles, status distribution, trending cameras | `web/web-user/src/pages/dashboard.tsx` |
| TSX-P02 | **Lifecycle** - Trang lifecycle camera | **Input:** Socket data<br>**Output:** Camera list with DataTable | ✅ | None | Bảng chi tiết tất cả camera với status, trend, forecasts, search/filter, detail modal | `web/web-user/src/pages/lifecycle.tsx` |
| TSX-P03 | **Analytics** - Trang phân tích | **Input:** TBD<br>**Output:** Analytics dashboard | 🚧 | [TODO] Chưa implement logic phân tích nâng cao | Sẽ có charts, trends, historical comparisons | `web/web-user/src/pages/analytics.tsx` |
| TSX-P04 | **Settings** - Trang cài đặt | **Input:** User preferences<br>**Output:** Settings form | 🚧 | [TODO] Chưa có UI settings | User preferences, notifications, display options | `web/web-user/src/pages/setting.tsx` |

---

## 📌 Ghi chú quan trọng

### 🔴 Known Issues & TODOs
- **[TODO] TS-C03**: Nearby camera search chưa có logic GPS thực sự → Cần implement PostGIS hoặc Haversine
- **[TODO] TS-S03**: Frontend nearby search phụ thuộc vào TS-C03
- **[TODO] TSX-P03**: Analytics page chưa implement logic
- **[TODO] TSX-P04**: Settings page chưa có UI

### ✅ Recent Updates (Từ AGENT_LOG.md)
- **LOS Calculation**: Đã chuyển sang dynamic capacity per camera (95th percentile/30 days)
- **Trend Logic**: Refactored để dùng threshold = 5 vehicles
- **Frontend**: Đã Việt hóa toàn bộ UI, responsive mobile, dark mode
- **Theme System**: LocalStorage + system preference detection
- **UI Components**: Bổ sung đầy đủ 10 components (Sidebar, Cards, Charts, Navigation)

### 📊 Thống kê Functions
- **Backend API**: 4 endpoints
- **Python ML**: 14 functions (Image Process, Prediction, Query)
- **Python App Route**: 3 functions
- **Frontend Services**: 3 API services + 2 Contexts
- **UI Components**: 10 components (Navigation, Dashboard, Table, Charts)
- **Pages**: 4 pages (Dashboard, Lifecycle, Analytics, Settings)
- **Tổng cộng**: **41 functions** được document

### 🎯 Luồng dữ liệu chính
```
Camera(20x) → [image-process YOLO] → PostgreSQL → [image-predict ML] → FIWARE Orion 
                                                                             ↓
                                                                    Socket.io → React Frontend
```