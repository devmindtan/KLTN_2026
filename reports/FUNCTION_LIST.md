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
| TS-M01 | **GET /api/model-metrics/latest** - Lấy snapshot model metrics mới nhất | **Input:** None<br>**Output:** `{success, data: ModelMetricsHistoryRow}` | ✅ | None | Query bản ghi mới nhất từ `model_metrics_history` theo `generated_at DESC`, trả 404 nếu chưa có dữ liệu | `backend/src/server/src/controllers/model-metrics.controller.ts::getLatestModelMetrics()` |
| TS-M02 | **GET /api/model-metrics/history** - Lấy lịch sử model metrics | **Input:** `limit, offset, period_days, from, to` (query)<br>**Output:** `{success, pagination, data: ModelMetricsHistoryRow[]}` | ✅ | [UPDATED 22/02/26] Có validation bằng Zod cho toàn bộ query params | Hỗ trợ filter theo thời gian và `period_days`, phân trang chuẩn để frontend dựng biểu đồ quá khứ | `backend/src/server/src/controllers/model-metrics.controller.ts::getModelMetricsHistory()` |
| TS-T01 | **GET /** - Health check | **Input:** None<br>**Output:** "Hello from testController!" | ✅ | None | Endpoint kiểm tra server đang hoạt động | `backend/src/server/src/controllers/test.controller.ts::testController()` |

---

### 🔷 Python ML Services

#### **📌 Image Processing Service** (`image-process`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-001 | **process_and_upload()** - Xử lý ảnh YOLO | **Input:** `camera_id, image_bytes`<br>**Output:** Detections, MinIO key | ✅ | None | Chạy YOLO detection, vẽ bounding boxes, upload lên MinIO, lưu kết quả vào DB. Tính `status_current` real-time dựa trên total_objects và capacity động | `backend/src/image-process/src/main.py::process_and_upload()` |
| PY-002 | **save_to_db()** - Lưu kết quả vào PostgreSQL | **Input:** `minio_key, cam_id, detections, total_objects`<br>**Output:** None | ✅ | None | Insert detection data vào bảng `traffic_data` với `detection_data` (JSONB) và `total_objects` | `backend/src/image-process/src/main.py::save_to_db()` |
| PY-003 | **YOLO Detection Loop** - Xử lý realtime | **Input:** Stream từ 20 cameras<br>**Output:** Continuous detection | ✅ | [UPDATED 17/02/26] Dùng `get_camera_max_realtime_capacity()` - MAX dòng lớn nhất (không qua AVG 5p). Gửi `status.realtime` với cấu trúc chi tiết (current_volume, detections, capacity, vc_ratio, timestamp) | Async loop fetch ảnh từ camera URLs, xử lý YOLO, cập nhật FIWARE và PostgreSQL. Capacity là MAX(total_objects) trực tiếp trong 7 ngày để phản ánh giá trị cao nhất từng ghi nhận, khác với prediction dùng MAX(AVG) | `backend/src/image-process/src/main.py::main()` + `update_fiware()` |

#### **📌 ML Prediction Service** (`image-predict`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-004 | **train_camera_model()** - Huấn luyện ML model | **Input:** DataFrame với LAG/LEAD features<br>**Output:** Trained RandomForest model (.joblib) | ✅ | Cần ít nhất 100 records để train | Label encode `camera_id`, train với features (hour, day_of_week, LAG/LEAD), lưu model và encoder | `backend/src/image-predict/train.py::train_camera_model()` |
| PY-005 | **predict_realtime()** - Dự đoán realtime | **Input:** Current data từ DB<br>**Output:** Forecasts (5m, 10m, 15m, 30m, 60m) | ✅ | [UPDATED 17/02/26] Thêm field `calculation` vào FIWARE payload chứa `{predicted_volume, capacity, vc_ratio}` | Load model, tạo LAG features, predict multiple horizons, tính LOS status & trend, cập nhật FIWARE với thông tin chi tiết công thức tính (giúp frontend hiển thị "80/120 xe (67%)") | `backend/src/image-predict/predict_realtime.py::predict_realtime()` + `update_fiware()` |
| PY-006 | **calculate_los_status()** - Tính LOS | **Input:** `volume, capacity` (float)<br>**Output:** Status string | ✅ | [MOVED 16/02/26] Function đã được move vào `backend/src/shared/los_utils.py` để dùng chung giữa image-process và predict_realtime services. Dual status system: `status.current` từ image-process (real-time), `status.forecast` từ predict_realtime (ML) | Tính V/C ratio, classify theo 5 mức: free_flow (<60%), smooth (60-75%), moderate (75-85%), heavy (85-100%), congested (≥95%). Được dùng bởi cả 2 services để tính status khác nhau | `backend/src/shared/los_utils.py::calculate_los_status()` |
| PY-006b | **get_camera_capacity_map()** - Capacity prediction | **Input:** `lookback_days, camera_list` (optional)<br>**Output:** Dict `{cam_id: capacity}` | ✅ | [MOVED 17/02/26] Dùng cho PREDICTION service - Tính MAX(AVG 5p) trong 7 ngày | Query data với time_bucket 5p, tính AVG(total_objects) cho mỗi bucket, lấy MAX của các AVG đó làm capacity. Phản ánh năng lực trung bình cao nhất, phù hợp với dự đoán | `backend/src/shared/los_utils.py::get_camera_capacity_map()` |
| PY-006c | **get_camera_max_realtime_capacity()** - Capacity realtime | **Input:** `lookback_days, camera_list` (optional)<br>**Output:** Dict `{cam_id: capacity}` | ✅ | [NEW 17/02/26] Dùng cho IMAGE-PROCESS service - Lấy MAX DÒNG lớn nhất trực tiếp (không qua trung bình) | Query MAX(total_objects) trực tiếp trong 7 ngày, KHÔNG qua aggregation 5p. Phản ánh giá trị CAO NHẤT từng ghi nhận, phù hợp với realtime status | `backend/src/shared/los_utils.py::get_camera_max_realtime_capacity()` |
| PY-007 | **calculate_trend()** - Tính xu hướng | **Input:** `current_val, predicted_val, threshold_percent`<br>**Output:** "increasing"/"decreasing"/"stable" | ✅ | [FIXED 17/02/26] Đã sửa từ threshold tuyệt đối sang % thay đổi (10% default) để linh hoạt với mọi camera | Tính % thay đổi: `((pred - curr) / curr) * 100`. Nếu abs(%) < 10% → stable, nếu không → increasing/decreasing. Xử lý edge case current_val = 0 | `backend/src/image-predict/predict_realtime.py::calculate_trend()` |
| PY-008 | **get_camera_capacity_map() [DEPRECATED]** - Wrapper | **Input:** `lookback_days=7`<br>**Output:** Dict `{cam_id: capacity}` | ⚠️ | [DEPRECATED 17/02/26] Function này giờ chỉ là wrapper gọi shared version. Recommend import trực tiếp từ `shared.los_utils` | Wrapper để backward compatibility, gọi `shared.los_utils.get_camera_capacity_map()` bên trong | `backend/src/image-predict/query.py::get_camera_capacity_map()` (deprecated) |
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

#### **📌 Model Performance Service** (`model-performance`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-018 | **calculate_overall_metrics()** - Tính chỉ số tổng quan model | **Input:** `period_days`<br>**Output:** `{mae, rmse, mape, accuracy_*}` | ✅ | [UPDATED 22/02/26] MAPE đã lọc `actual_value >= 5` để tránh méo số do mẫu gần 0 | Tổng hợp accuracy model theo cửa sổ thời gian, chuẩn hóa query PostgreSQL bằng cast `::numeric` cho ROUND | `backend/src/model-performance/analyze_metrics.py::calculate_overall_metrics()` |
| PY-019 | **analyze_by_horizon()** - Phân tích theo horizon dự báo | **Input:** `period_days`<br>**Output:** `[{horizon_minutes, avg_error, accuracy_5xe...}]` | ✅ | None | So sánh chất lượng dự báo theo từng mốc 5/10/15/30/60 phút, gán recommendation theo ngưỡng lỗi | `backend/src/model-performance/analyze_metrics.py::analyze_by_horizon()` |
| PY-020 | **rank_cameras()** - Xếp hạng camera theo sai số | **Input:** `period_days, top_n, horizon_filter`<br>**Output:** `{best: [], worst: []}` | ✅ | [UPDATED 22/02/26] Bỏ `display_name` khỏi payload gửi FIWARE để tránh lỗi ký tự attribute value | Ranking theo `avg_error`, trả top tốt nhất và tệ nhất để phục vụ dashboard model quality | `backend/src/model-performance/analyze_metrics.py::rank_cameras()` |
| PY-021 | **calculate_data_coverage()** - Độ phủ và độ mới dữ liệu | **Input:** `period_days`<br>**Output:** `{verified, pending, verification_rate...}` | ✅ | None | Tính tỷ lệ bản ghi đã có ground-truth và freshness để đánh giá độ tin cậy bộ metrics | `backend/src/model-performance/analyze_metrics.py::calculate_data_coverage()` |
| PY-022 | **calculate_trend_accuracy()** - Độ chính xác dự đoán xu hướng | **Input:** `period_days`<br>**Output:** `{trend_accuracy, correct_predictions...}` | ✅ | None | So khớp chiều biến thiên dự báo/actual (tăng, giảm, ổn định) để đo chất lượng trend prediction | `backend/src/model-performance/analyze_metrics.py::calculate_trend_accuracy()` |
| PY-023 | **get_full_report()** - Tổng hợp full metrics report | **Input:** `period_days`<br>**Output:** `Dict` báo cáo hoàn chỉnh | ✅ | None | Orchestrate toàn bộ pipeline metrics trong 1 lần chạy và trả về cấu trúc chuẩn để publish | `backend/src/model-performance/analyze_metrics.py::get_full_report()` |
| PY-024 | **update_metrics_to_fiware()** - Upsert metrics lên Orion | **Input:** `metrics`<br>**Output:** `bool` success/fail | ✅ | [BUG FIX 22/02/26] Đã xử lý serialize `Decimal/datetime/NaN/Infinity` và chuẩn hóa payload để FIWARE nhận ổn định | Build entity `urn:ngsi-ld:ModelMetrics:performance`, gửi lên `/v2/entities?options=upsert` với `fiware-service` headers | `backend/src/model-performance/update_fiware.py::update_metrics_to_fiware()` |
| PY-025 | **ensure_metrics_history_table()** - Khởi tạo bảng lịch sử metrics | **Input:** None<br>**Output:** None | ✅ | None | Tạo bảng `model_metrics_history` và index `generated_at` nếu chưa tồn tại để đảm bảo service chạy độc lập không phụ thuộc migrate thủ công | `backend/src/model-performance/update_fiware.py::ensure_metrics_history_table()` |
| PY-026 | **save_metrics_history()** - Lưu snapshot metrics vào PostgreSQL | **Input:** `metrics`<br>**Output:** `bool` success/fail | ✅ | [UPDATED 22/02/26] Được gọi ở cả single-run và cycle-run trước khi đẩy FIWARE | Chuẩn hóa dữ liệu metrics và insert JSONB (`overall`, `by_horizon`, `camera_ranking`, `data_coverage`, `trend_accuracy`) để frontend truy vấn quá khứ theo thời gian | `backend/src/model-performance/update_fiware.py::save_metrics_history()` |

---

### 🔷 Frontend React Services

#### **📌 Camera Service** (`web-user/services`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TS-S01 | **getAllCameras()** - Lấy danh sách camera | **Input:** None<br>**Output:** `CameraInfo[]` | ✅ | None | Fetch `GET /api/cameras` từ Backend API, parse response, return array of cameras | `web/web-user/src/services/camera.service.ts::getAllCameras()` |
| TS-S02 | **getCameraById()** - Chi tiết camera | **Input:** `camId` (string)<br>**Output:** `CameraInfo \| null` | ✅ | None | Validation `camId`, fetch `GET /api/cameras/:camId`, return single camera hoặc null nếu không tìm thấy | `web/web-user/src/services/camera.service.ts::getCameraById()` |
| TS-S03 | **getNearbyCameras()** - Tìm camera gần | **Input:** `lat, lng, radius`<br>**Output:** `CameraInfo[]` | ⚠️ | [TODO] Backend chưa implement logic GPS thực | Fetch `GET /api/cameras/nearby`, hiện tại chỉ return tất cả cameras | `web/web-user/src/services/camera.service.ts::getNearbyCameras()` |
| TS-S04 | **getLatestModelMetrics()** - Lấy snapshot metrics mới nhất | **Input:** None<br>**Output:** `ModelMetricsHistoryRow \| null` | ✅ | None | Fetch `GET /api/model-metrics/latest`, chuẩn hóa response và fallback `null` khi chưa có dữ liệu | `web/web-user/src/services/model-metrics.service.ts::getLatestModelMetrics()` |
| TS-S05 | **getModelMetricsHistory()** - Lấy lịch sử metrics model | **Input:** `limit`<br>**Output:** `ModelMetricsHistoryRow[]` | ✅ | None | Fetch `GET /api/model-metrics/history` phục vụ bảng lịch sử trên trang analytics | `web/web-user/src/services/model-metrics.service.ts::getModelMetricsHistory()` |

#### **📌 Socket Context** (`web-user/contexts`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-K01 | **SocketProvider** - Quản lý Socket.io | **Input:** React children<br>**Output:** Real-time camera data context | ✅ | [UPDATED 17/02/26] Thêm field `realtimeData` vào CameraData interface để xử lý `status.realtime` từ backend (current_volume, detections, capacity, vc_ratio, timestamp) | Connect Socket.io, subscribe `camera:update`, merge với static camera info từ API, transform NGSI-LD data sang CameraData interface. Giờ xử lý cả `calculation` (prediction) và `realtimeData` (status.realtime) để frontend có đủ thông tin chi tiết cho cả 2 loại status | `web/web-user/src/contexts/SocketContext.tsx::SocketProvider()` |
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
| TSX-A08 | **DataTable** - Bảng hiển thị camera data | **Input:** `data: CameraData[]`<br>**Output:** Interactive table | ✅ | [UPDATED 17/02/26] Thêm hiển thị calculation trong Sheet detail components | TanStack Table với sorting, filtering, pagination, drag-and-drop reordering, responsive mobile. Hiển thị dual status badges (current + forecast 5p). Sheet detail hiển thị calculation ("11/120 xe (9%)") giúp user hiểu công thức LOS | `web/web-user/src/components/data-table.tsx::DataTable()` |
| TSX-A09 | **ScrollToTop** - Nút cuộn lên đầu | **Input:** None (auto-detect scroll)<br>**Output:** Floating button | ✅ | None | Hiển thị khi scroll > 1 viewport, opacity 70%, smooth scroll to top | `web/web-user/src/components/scroll-to-top.tsx::ScrollToTop()` |
| TSX-A10 | **SiteHeader** - Header với breadcrumb | **Input:** Current route<br>**Output:** Header component | ✅ | None | Breadcrumb navigation từ pathname, theme toggle button góc phải | `web/web-user/src/components/site-header.tsx::SiteHeader()` |

#### **📌 Pages** (`web-user/pages`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| TSX-P01 | **Dashboard** - Trang tổng quan | **Input:** Real-time socket data<br>**Output:** Cards, charts, metrics | ✅ | None | Hiển thị tổng quan giao thông: total cameras, avg vehicles, status distribution (dùng status.current), trending cameras. Metrics tính từ processedCameras với LOS grouping (goodStatus: free_flow+smooth, moderateStatus: moderate, badStatus: heavy+congested) | `web/web-user/src/pages/dashboard.tsx` |
| TSX-P02 | **Lifecycle** - Trang lifecycle camera | **Input:** Socket data<br>**Output:** Camera list with DataTable | ✅ | [UPDATED 17/02/26] Thêm hiển thị calculation (predicted_volume / capacity + vc_ratio%) trong Dialog detail | Bảng chi tiết tất cả camera với dual status (current+forecast), trend, forecasts, search/filter (theo status.current), detail dialog với calculation info "11/120 xe (9%)" giúp user hiểu công thức tính LOS | `web/web-user/src/pages/lifecycle.tsx` |
| TSX-P03 | **Analytics** - Trang phân tích hiệu suất model | **Input:** API model-metrics (`latest`, `history`)<br>**Output:** Cards + bảng horizon + ranking + history table | ✅ | [UPDATED 22/02/26] Đã chuyển từ mock sang dữ liệu thật từ backend | Hiển thị MAE/MAPE/Accuracy/Trend Accuracy, so sánh theo horizon, top/bottom camera và snapshot lịch sử để theo dõi quá khứ | `web/web-user/src/pages/analytics.tsx` |
| TSX-P04 | **Settings** - Trang cài đặt | **Input:** User preferences<br>**Output:** Settings form | 🚧 | [TODO] Chưa có UI settings | User preferences, notifications, display options | `web/web-user/src/pages/setting.tsx` |

---

## 📌 Ghi chú quan trọng

### 🔴 Known Issues & TODOs
- **[TODO] TS-C03**: Nearby camera search chưa có logic GPS thực sự → Cần implement PostGIS hoặc Haversine
- **[TODO] TS-S03**: Frontend nearby search phụ thuộc vào TS-C03
- **[TODO] TSX-P04**: Settings page chưa có UI

### ✅ Recent Updates (Từ AGENT_LOG.md)
- **LOS Calculation**: Đã chuyển sang dynamic capacity với 2 nhánh realtime/prediction theo MAX 7 ngày
- **Trend Logic**: Refactored sang ngưỡng % thay đổi (10%)
- **Frontend**: Đã Việt hóa toàn bộ UI, responsive mobile, dark mode
- **Theme System**: LocalStorage + system preference detection
- **UI Components**: Bổ sung đầy đủ 10 components (Sidebar, Cards, Charts, Navigation)
- **Model Performance**: Bổ sung service đo chất lượng ML và đẩy entity `ModelMetrics` lên FIWARE thành công
- **Model Performance History**: Bổ sung lưu snapshot metrics vào PostgreSQL (`model_metrics_history`) phục vụ màn hình dữ liệu quá khứ
- **Model Metrics API**: Bổ sung endpoint backend cho frontend query lịch sử và snapshot mới nhất
- **Analytics Page**: Đã hiển thị dữ liệu model metrics thật từ backend thay cho mock

### 📊 Thống kê Functions
- **Backend API**: 6 endpoints
- **Python ML**: 23 functions (Image Process, Prediction, Query, Model Performance)
- **Python App Route**: 3 functions
- **Frontend Services**: 5 API services + 2 Contexts
- **UI Components**: 10 components (Navigation, Dashboard, Table, Charts)
- **Pages**: 4 pages (Dashboard, Lifecycle, Analytics, Settings)
- **Tổng cộng**: **54 functions** được document

### 🎯 Luồng dữ liệu chính
```
Camera(20x) → [image-process YOLO] → PostgreSQL → [image-predict ML] → FIWARE Orion 
                                                                             ↓
                                                                    Socket.io → React Frontend
```