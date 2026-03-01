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
| TS-ML01 | **GET /api/models** - Active models | **Input:** None<br>**Output:** `{success, data: MLModelMetadata[]}` | ✅ | None | SELECT is_active=TRUE ORDER BY model_type priority, kèm display_name mapping | `backend/server/src/controllers/model.controller.ts::getActiveModels()` |
| TS-ML02 | **GET /api/models/all** - All versions grouped | **Input:** None<br>**Output:** `{success, data: Record<type, MLModelMetadata[]>}` | ✅ | None | Tất cả versions grouped by model_type, ORDER DESC created_at | `backend/server/src/controllers/model.controller.ts::getAllModelVersions()` |
| TS-ML03 | **GET /api/models/:id** - Chi tiết model | **Input:** `id` (number)<br>**Output:** `{success, data: MLModelMetadata}` | ✅ | None | Query single row + display_name | `backend/server/src/controllers/model.controller.ts::getModelById()` |
| TS-ML04 | **GET /api/models/:id/history** - Lịch sử versions | **Input:** `id` (number)<br>**Output:** `{success, model_type, display_name, data[]}` | ✅ | None | Tìm model_type từ id, query tất cả versions cùng type ORDER DESC | `backend/server/src/controllers/model.controller.ts::getModelHistory()` |
| TS-ML05 | **POST /api/models/:id/activate** - Kích hoạt version | **Input:** `id` (number)<br>**Output:** `{success, message, k8s_restart}` | ✅ | [UPDATED 28/02/26] Thêm k8s rollout restart qua `apps.patchNamespacedDeployment()` sau commit DB. Graceful fallback khi dev local | Transaction: deactivate all same-type → activate target. Sau đó patch deployment image-predict (rollout restart). k8s_restart=false khi dev | `backend/server/src/controllers/model.controller.ts::activateModel()` |
| TS-ML06 | **POST /api/models/train** - Tạo training job | **Input:** `{model_type, start_date, end_date}`<br>**Output:** `{success, job_name, job_id, status}` | ✅ | Cần in-cluster k8s config (server.yaml cần `serviceAccountName: server-sa`). 503 khi dev local | Tạo k8s Job bằng `@kubernetes/client-node`, Job chạy train_single.py với env vars từ image-predict-deployment, resources 2-4Gi RAM, ttl=3600s | `backend/server/src/controllers/model.controller.ts::trainModel()` |

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
| PY-004 | **train_camera_model()** - Huấn luyện tất cả 5 ML models | **Input:** DataFrame với LAG/LEAD features<br>**Output:** Dict {horizon: {model, mae, rmse, r2, features}} | ✅ | [UPDATED 28/02/26] Giữ nguyên, chỉ dùng cho scheduled train (is_active=TRUE). train_single.py cho UI-triggered | Label encode `camera_id`, train với features (hour, day_of_week, LAG/LEAD), lưu model và encoder | `backend/services/image-predict/app/train.py::train_camera_model()` |
| PY-004b | **main() train_single.py** - Huấn luyện 1 horizon theo yêu cầu UI | **Input:** CLI `--model_type, --start_date, --end_date, --job_id`<br>**Output:** Model MinIO + metadata DB (is_active=FALSE) | ✅ | [NEW 28/02/26] FIWARE subscription TrainingJob cần register 1 lần thủ công | 7 stages với FIWARE updates: query DB (10%) → preprocess (30%) → train (55%) → evaluate (70%) → upload MinIO (85%) → save DB is_active=FALSE (95%) → done (100%). Entity `urn:ngsi-ld:TrainingJob:latest` | `backend/services/image-predict/app/train_single.py::main()` |
| PY-004c | **reload_active_model()** - Hot-swap model khi activate version mới | **Input:** `model_type: str`<br>**Output:** `bool` | ✅ | [NEW 01/03/26] FIWARE subscription `ModelReload` cần register 1 lần thủ công (xem models-page-plan.md) | 5 stages: query DB is_active=TRUE (10%) → tìm thấy model (40%) → download MinIO (70%) → verify file (90%) → done (100%). Entity `urn:ngsi-ld:ModelReload:latest`. `time.sleep(1.5)` trước 100% | `backend/services/image-predict/app/reload_model.py::reload_active_model()` |
| PY-004d | **get_active_model_info()** - Query model đang active từ DB | **Input:** `model_type: str`<br>**Output:** `dict {minio_key, model_version, ...}` hoặc `None` | ✅ | [NEW 01/03/26] | Query `ml_model_metadata` WHERE `is_active=TRUE AND model_type=?`, ORDER BY `activated_at DESC LIMIT 1` | `backend/services/image-predict/app/reload_model.py::get_active_model_info()` |
| PY-004e | **start_reload_server() / ReloadHandler** - HTTP daemon server nhận trigger reload | **Input:** `port: int`<br>**Output:** None (blocking server) | ✅ | [NEW 01/03/26] Chạy trong daemon thread, không block scheduler | `BaseHTTPRequestHandler` POST `/reload` → body `{model_type}` → gọi `reload_active_model()` trong background thread → trả 202. Non-POST → 405 | `backend/services/image-predict/app/predict_realtime.py::start_reload_server()` |
| PY-005 | **predict_realtime()** - Dự đoán realtime | **Input:** Current data từ DB<br>**Output:** Forecasts (5m, 10m, 15m, 30m, 60m) | ✅ | [UPDATED 17/02/26] Thêm field `calculation` vào FIWARE payload chứa `{predicted_volume, capacity, vc_ratio}` | Load model, tạo LAG features, predict multiple horizons, tính LOS status & trend, cập nhật FIWARE với thông tin chi tiết công thức tính (giúp frontend hiển thị "80/120 xe (67%)") | `backend/src/image-predict/predict_realtime.py::predict_realtime()` + `update_fiware()` |
| PY-006 | **calculate_los_status()** - Tính LOS | **Input:** `volume, capacity` (float)<br>**Output:** Status string | ✅ | [MOVED 16/02/26] Function đã được move vào `backend/src/shared/los_utils.py` để dùng chung giữa image-process và predict_realtime services. Dual status system: `status.current` từ image-process (real-time), `status.forecast` từ predict_realtime (ML) | Tính V/C ratio, classify theo 5 mức: free_flow (<60%), smooth (60-75%), moderate (75-85%), heavy (85-100%), congested (≥95%). Được dùng bởi cả 2 services để tính status khác nhau | `backend/src/shared/los_utils.py::calculate_los_status()` |
| PY-006b | **get_camera_capacity_map()** - Capacity prediction | **Input:** `lookback_days, camera_list` (optional)<br>**Output:** Dict `{cam_id: capacity}` | ✅ | [MOVED 17/02/26] Dùng cho PREDICTION service - Tính MAX(AVG 5p) trong 7 ngày | Query data với time_bucket 5p, tính AVG(total_objects) cho mỗi bucket, lấy MAX của các AVG đó làm capacity. Phản ánh năng lực trung bình cao nhất, phù hợp với dự đoán | `backend/src/shared/los_utils.py::get_camera_capacity_map()` |
| PY-006c | **get_camera_max_realtime_capacity()** - Capacity realtime | **Input:** `lookback_days, camera_list` (optional)<br>**Output:** Dict `{cam_id: capacity}` | ✅ | [NEW 17/02/26] Dùng cho IMAGE-PROCESS service - Lấy MAX DÒNG lớn nhất trực tiếp (không qua trung bình) | Query MAX(total_objects) trực tiếp trong 7 ngày, KHÔNG qua aggregation 5p. Phản ánh giá trị CAO NHẤT từng ghi nhận, phù hợp với realtime status | `backend/src/shared/los_utils.py::get_camera_max_realtime_capacity()` |
| PY-007 | **calculate_trend()** - Tính xu hướng | **Input:** `current_val, predicted_val, threshold_percent`<br>**Output:** "increasing"/"decreasing"/"stable" | ✅ | [FIXED 17/02/26] Đã sửa từ threshold tuyệt đối sang % thay đổi (10% default) để linh hoạt với mọi camera | Tính % thay đổi: `((pred - curr) / curr) * 100`. Nếu abs(%) < 10% → stable, nếu không → increasing/decreasing. Xử lý edge case current_val = 0 | `backend/src/image-predict/predict_realtime.py::calculate_trend()` |
| PY-008 | **get_camera_capacity_map() [DEPRECATED]** - Wrapper | **Input:** `lookback_days=7`<br>**Output:** Dict `{cam_id: capacity}` | ⚠️ | [DEPRECATED 17/02/26] Function này giờ chỉ là wrapper gọi shared version. Recommend import trực tiếp từ `shared.los_utils` | Wrapper để backward compatibility, gọi `shared.los_utils.get_camera_capacity_map()` bên trong | `backend/src/image-predict/query.py::get_camera_capacity_map()` (deprecated) |
| PY-009 | **query_from_db_realtime()** - Lấy data realtime | **Input:** None<br>**Output:** DataFrame với current traffic data + sample counts | ✅ | [UPDATED 24/02/26] Bổ sung `sample_count` và các LAG counts (lag_5m_count, lag_10m_count, lag_15m_count, lag_30m_count, lag_60m_count) để track số lượng hình ảnh trong mỗi time bucket | Query 5 phút gần nhất từ bảng `traffic_data`, group by camera, tính AVG(total_objects) và COUNT(*) cho từng bucket, lấy LAG của count để biết số hình ảnh trong window quá khứ. Phục vụ data quality verification | `backend/src/image-predict/query.py::query_from_db_realtime()` |
| PY-010 | **query_from_db_total()** - Lấy historical data | **Input:** `start_date, end_date`<br>**Output:** DataFrame với LAG/LEAD features + sample counts | ✅ | [UPDATED 24/02/26] Bổ sung sample_count columns tương tự query_realtime để training data có metadata đầy đủ | Query data theo time range, tạo LAG (1-12) và LEAD features cho training. Thêm tracking số lượng hình ảnh để verify data quality trong historical training set | `backend/src/image-predict/query.py::query_from_db_total()` |
| PY-011 | **forecast_and_save_to_db()** - Lưu dự đoán + metadata | **Input:** `predictions, df_input`<br>**Output:** None | ✅ | [UPDATED 24/02/26] Lưu thêm `input_sample_count`, `lag_sample_count` để verify data window consistency | Extract sample count từ df_input (`sample_count` cho current, `lag_{horizon}m_count` tương ứng horizon), insert forecasts vào bảng `camera_forecasts` kèm metadata. Cho phép verify sau này rằng predict và sync dùng đúng số lượng samples | `backend/src/image-predict/query.py::forecast_and_save_to_db()` |
| PY-012 | **sync_actual_values()** - Sync actual với forecast | **Input:** None<br>**Output:** None | ✅ | [UPDATED 24/02/26] Lưu thêm `sync_sample_count` khi query lại actual value để verify data consistency | Update `actual_value` và `sync_sample_count` trong bảng `camera_forecasts` khi forecast_for đã qua. Tính COUNT(*) trong subquery để biết số hình ảnh thực tế khi sync, so sánh với `lag_sample_count` để phát hiện data mismatch | `backend/src/image-predict/query.py::sync_actual_values()` |
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
| PY-018 | **calculate_overall_metrics()** - Tính chỉ số tổng quan model + confidence | **Input:** `period_days`<br>**Output:** `{mae, rmse, mape, accuracy_*, prediction_confidence, error_confidence}` | ✅ | [UPDATED 26/02/26] Thêm prediction_confidence (input vs lag samples) và error_confidence (input vs sync samples). MAPE đã lọc `actual_value >= 5` để tránh méo số | Tổng hợp accuracy model theo cửa sổ thời gian + tính average sample counts, gọi helper functions để tính confidence scores, chuẩn hóa query PostgreSQL bằng cast `::numeric` cho ROUND | `backend/services/model-performance/app/analyze_metrics.py::calculate_overall_metrics()` |
| PY-019 | **analyze_by_horizon()** - Phân tích theo horizon + confidence scores | **Input:** `period_days`<br>**Output:** `[{horizon_minutes, avg_error, accuracy_5xe, prediction_confidence, error_confidence...}]` | ✅ | [UPDATED 26/02/26] Mỗi horizon giờ có prediction_confidence và error_confidence riêng biệt, cho phép identify horizons có data quality thấp | So sánh chất lượng dự báo theo từng mốc 5/10/15/30/60 phút, gán recommendation theo ngưỡng lỗi. Thêm confidence metrics per horizon để verify data consistency cho từng forecast window | `backend/services/model-performance/app/analyze_metrics.py::analyze_by_horizon()` |
| PY-020 | **rank_cameras()** - Xếp hạng camera theo sai số | **Input:** `period_days, top_n, horizon_filter`<br>**Output:** `{best: [], worst: []}` | ✅ | [UPDATED 22/02/26] Bỏ `display_name` khỏi payload gửi FIWARE để tránh lỗi ký tự attribute value | Ranking theo `avg_error`, trả top tốt nhất và tệ nhất để phục vụ dashboard model quality | `backend/services/model-performance/app/analyze_metrics.py::rank_cameras()` |
| PY-021 | **calculate_data_coverage()** - Độ phủ và độ mới dữ liệu | **Input:** `period_days`<br>**Output:** `{verified, pending, verification_rate...}` | ✅ | None | Tính tỷ lệ bản ghi đã có ground-truth và freshness để đánh giá độ tin cậy bộ metrics | `backend/services/model-performance/app/analyze_metrics.py::calculate_data_coverage()` |
| PY-022 | **calculate_trend_accuracy()** - Độ chính xác dự đoán xu hướng | **Input:** `period_days`<br>**Output:** `{trend_accuracy, correct_predictions...}` | ✅ | None | So khớp chiều biến thiên dự báo/actual (tăng, giảm, ổn định) để đo chất lượng trend prediction | `backend/services/model-performance/app/analyze_metrics.py::calculate_trend_accuracy()` |
| PY-022b | **analyze_confidence_distribution()** - Phân tích phân phối confidence scores | **Input:** `period_days`<br>**Output:** `{high_quality_percent, low_quality_percent, consistent_sync_percent...}` | ✅ | [NEW 26/02/26] Thêm function mới để analyze data quality distribution toàn bộ forecasts | Phân tích thống kê sample counts: high_quality_predictions (cả input & lag >=30), low_quality_predictions (<10), consistent_syncs (|diff|<=5), inconsistent_syncs. Return percentages và sample count ranges để dashboard hiển thị data quality overview | `backend/services/model-performance/app/analyze_metrics.py::analyze_confidence_distribution()` |
| PY-023 | **get_full_report()** - Tổng hợp full metrics report + confidence | **Input:** `period_days`<br>**Output:** `Dict` báo cáo hoàn chỉnh | ✅ | [UPDATED 26/02/26] Thêm `confidence_distribution` vào report output | Orchestrate toàn bộ pipeline metrics trong 1 lần chạy và trả về cấu trúc chuẩn để publish. Bao gồm overall, by_horizon, camera_ranking, data_coverage, trend_accuracy và confidence_distribution | `backend/services/model-performance/app/analyze_metrics.py::get_full_report()` |
| PY-024 | **update_metrics_to_fiware()** - Upsert metrics lên Orion + confidence | **Input:** `metrics`<br>**Output:** `bool` success/fail | ✅ | [UPDATED 26/02/26] Thêm `confidence_distribution` attribute vào FIWARE entity. [BUG FIX 22/02/26] Đã xử lý serialize `Decimal/datetime/NaN/Infinity` và chuẩn hóa payload | Build entity `urn:ngsi-ld:ModelMetrics:performance`, gửi lên `/v2/entities?options=upsert` với `fiware-service` headers. Payload giờ bao gồm confidence metrics để frontend display real-time data quality | `backend/services/model-performance/app/update_fiware.py::update_metrics_to_fiware()` |
| PY-025 | **ensure_metrics_history_table()** - Khởi tạo bảng lịch sử metrics + confidence column | **Input:** None<br>**Output:** None | ✅ | [UPDATED 26/02/26] Schema bao gồm cột `confidence_distribution JSONB DEFAULT NULL` | Tạo bảng `model_metrics_history` và index `generated_at` nếu chưa tồn tại để đảm bảo service chạy độc lập không phụ thuộc migrate thủ công. Bao gồm cột cho confidence data | `backend/services/model-performance/app/update_fiware.py::ensure_metrics_history_table()` |
| PY-026 | **save_metrics_history()** - Lưu snapshot metrics + confidence vào PostgreSQL | **Input:** `metrics`<br>**Output:** `bool` success/fail | ✅ | [UPDATED 26/02/26] Lưu thêm `confidence_distribution` JSONB field. Được gọi ở cả single-run và cycle-run trước khi đẩy FIWARE | Chuẩn hóa dữ liệu metrics và insert JSONB (`overall`, `by_horizon`, `camera_ranking`, `data_coverage`, `trend_accuracy`, `confidence_distribution`) để frontend truy vấn quá khứ theo thời gian | `backend/services/model-performance/app/update_fiware.py::save_metrics_history()` |
| PY-034 | **calculate_prediction_confidence()** - Helper tính độ tin cậy dự đoán | **Input:** `input_count, lag_count` (int)<br>**Output:** `{score: 0-1, level: High/Medium/Low, reason: str}` | ✅ | [NEW 26/02/26] Helper function so sánh input_sample_count vs lag_sample_count | Tính confidence dựa trên sample counts: High nếu cả 2 >=30 và diff <20%, Medium nếu diff 20-40%, Low nếu 1 trong 2 <10 hoặc diff >40%. Return score (0-1), level classification và reason string | `backend/services/model-performance/app/analyze_metrics.py::calculate_prediction_confidence()` |
| PY-035 | **calculate_error_confidence()** - Helper tính độ tin cậy error value | **Input:** `input_count, sync_count` (int)<br>**Output:** `{score: 0-1, level: High/Medium/Low, reason: str}` | ✅ | [NEW 26/02/26] Helper function so sánh input_sample_count vs sync_sample_count | Tính confidence dựa trên consistency: High nếu cả 2 >=30 và |diff|<=5, Medium nếu |diff|<=5 nhưng <30 hoặc mismatch 5-30%, Low nếu 1 trong 2 <10 hoặc mismatch >30%. Phát hiện data mismatch giữa predict và sync | `backend/services/model-performance/app/analyze_metrics.py::calculate_error_confidence()` |
| PY-038 | **ensure_models_ready()** - Kiểm tra và download models selective | **Input:** None<br>**Output:** `bool` (True nếu models sẵn sàng, False nếu lỗi) | ✅ | [UPDATED 28/02/26] Chỉ tải models còn thiếu thay vì tải lại toàn bộ | Kiểm tra chi tiết 6 models (map filename→type), log existing models với file size, identify missing models, gọi `download_random_forest_models(required_types=missing_models)` để selective download. Return False nếu download failed → container exit(1). Log format: "✅ Existing: 5m (245KB), encoder (12KB)" + "⚠️ Missing: 10m, 15m" | `backend/services/image-predict/app/predict_realtime.py::ensure_models_ready()` |
| PY-039 | **download_random_forest_models()** - Download models từ MinIO selective | **Input:** `output_dir, required_types` (list optional)<br>**Output:** `bool` (True nếu success) | ✅ | [UPDATED 28/02/26] Nhận parameter `required_types` để chỉ tải models cần thiết | List models trên MinIO (random-forest/v1/), group theo type (5m/10m/15m/30m/60m/encoder), lấy latest của mỗi type, filter theo `required_types` (nếu None → tải tất cả), download selective. Tránh tải lại models đã có local | `backend/services/image-predict/app/download_model.py::download_random_forest_models()` |
| PY-036 | **calculate_next_run_time()** - Tính thời gian chạy tiếp theo | **Input:** None<br>**Output:** `datetime` (UTC, phút tiếp theo chia hết cho 5) | ✅ | [NEW 28/02/26] Dùng trong scheduler loop để đảm bảo chạy đúng giờ (5, 10, 15, 20...) | Lấy current time UTC, tính phút tiếp theo chia hết cho 5 (next_minute = ((current // 5) + 1) * 5), return datetime object với second=0, microsecond=0. Xử lý edge case khi next_minute >= 60 (cộng 1 giờ) | `backend/services/image-predict/app/predict_realtime.py::calculate_next_run_time()` |
| PY-037 | **run_scheduler()** - Scheduler loop chạy prediction mỗi 5 phút | **Input:** None<br>**Output:** Infinite loop (chạy liên tục) | ✅ | [NEW 28/02/26] Thay thế cronjob K8s để tránh load lại models mỗi 5 phút | Infinite while loop: tính next run time → sleep đến thời điểm đó → chạy `asyncio.run(run_cycle())` → log completion → lặp lại. Error handling: sleep 60s nếu crash trước khi retry. Đảm bảo schedule không bị ảnh hưởng bởi thời gian chạy task trước (mỗi lần tính sleep time mới dựa trên current time) | `backend/services/image-predict/app/predict_realtime.py::run_scheduler()` |

#### **📌 Backup Service** (`backup-postgres`)

| ID | Chức năng / Route | Inputs / Outputs | Trạng thái | Hạn chế & Lý do | Logic & Giải pháp | Vị trí |
|:---:|:---|:---|:---:|:---|:---|:---|
| PY-027 | **main()** - Orchestrate backup workflow | **Input:** Env vars (DB credentials, GDrive config)<br>**Output:** None (side effects: backup file + DB log) | ✅ | [NEW 26/02/26] Service mới cho disaster recovery backup | Orchestrator chính: log start → get DB stats → pg_dump → compress → upload GDrive → log completion. Error handling với DB log update khi fail | `backend/services/backup-postgres/app/backup.py::main()` |
| PY-028 | **run_pg_dump()** - Backup database với pg_dump | **Input:** None (env vars)<br>**Output:** Path to dump file | ✅ | None | Execute `pg_dump` command với options: `--format=plain`, support BACKUP_TYPE (full/schema-only). PGPASSWORD env var để authentication | `backend/services/backup-postgres/app/backup.py::run_pg_dump()` |
| PY-029 | **compress_file()** - Compress backup với gzip | **Input:** `source_file` path<br>**Output:** `(compressed_file_path, file_size_mb)` | ✅ | None | Gzip compression để giảm dung lượng ~70-80%, xóa file gốc sau compress, return path và size (MB) | `backend/services/backup-postgres/app/backup.py::compress_file()` |
| PY-030 | **upload_to_gdrive()** - Upload file lên Google Drive | **Input:** `file_path`<br>**Output:** `(web_link, file_id)` | ✅ | None | Authenticate với Service Account JSON, dùng Google Drive API v3 upload file vào folder ID, return web link và file ID để lưu vào DB | `backend/services/backup-postgres/app/backup.py::upload_to_gdrive()` |
| PY-031 | **log_backup_start()** - Log thời gian bắt đầu backup | **Input:** `cursor` (DB connection)<br>**Output:** `backup_id` (int) | ✅ | None | Insert record vào table `backup_logs` với status='running', return ID để update sau | `backend/services/backup-postgres/app/backup.py::log_backup_start()` |
| PY-032 | **log_backup_complete()** - Log thời gian hoàn thành | **Input:** `cursor, backup_id, storage_location, file_size_mb, metadata, error_message`<br>**Output:** None | ✅ | None | Update record trong `backup_logs` với completed_at, duration_seconds (auto-calculated), status (success/failed), file info và metadata JSONB | `backend/services/backup-postgres/app/backup.py::log_backup_complete()` |
| PY-033 | **get_database_stats()** - Lấy thống kê database | **Input:** `cursor`<br>**Output:** Dict `{total_tables, schemas, top_tables}` | ✅ | None | Query pg_tables và pg_stat_user_tables để lấy số lượng tables, schema breakdown, top 10 tables theo row count → lưu vào metadata JSONB | `backend/services/backup-postgres/app/backup.py::get_database_stats()` |

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
| TSX-P03 | **Analytics** - Trang phân tích hiệu suất model | **Input:** API model-metrics (`latest`, `history`) + mapping camera data<br>**Output:** Cards + bảng horizon + ranking + history table | ✅ | [UPDATED 22/02/26] Đã chuyển từ mock sang dữ liệu thật và map ID camera thành tên hiển thị | Hiển thị MAE/MAPE/Accuracy/Trend Accuracy, so sánh theo horizon, top/bottom camera theo tên thực tế, snapshot lịch sử và khối giải thích ý nghĩa metric bằng tiếng Việt | `web/web-user/src/pages/analytics.tsx` |
| TSX-P04 | **Settings** - Trang cài đặt | **Input:** User preferences<br>**Output:** Settings form | 🚧 | [TODO] Chưa có UI settings | User preferences, notifications, display options | `web/web-user/src/pages/setting.tsx` |
| TSX-P05 | **ModelsPage** - Quản lý ML Models | **Input:** API models + socket `trainingJob`<br>**Output:** Grid + Sheet + AlertDialog + TrainNewVersionModal | ✅ | [NEW 28/02/26] ⚠️ FIWARE TrainingJob subscription cần register thủ công. server.yaml cần `serviceAccountName: server-sa` | Grid active models/type. Sheet: history table + Kích hoạt (ActivateModelDialog). TrainNewVersionModal 3 bước: radio type → date range → progress bar realtime (TRAINING_JOB_UPDATED socket event) | `web/web-user/src/pages/models.tsx::ModelsPage()` |

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
- **[NEW 26/02/26] Sample Counts Tracking**: Thêm 3 cột vào camera_forecasts (input/lag/sync_sample_count) để verify data quality
- **[NEW 26/02/26] Confidence Scoring**: Service model-performance giờ tính prediction_confidence và error_confidence dựa trên sample counts consistency
- **[NEW 26/02/26] Analytics UI Enhancement**: Frontend analytics.tsx hiển thị confidence scores với badges màu sắc và recommendation tiếng Việt (Giữ lại/Tùy chọn/Loại bỏ)

### 📊 Thống kê Functions
- **Backend API**: 6 endpoints
- **Python ML**: 25 functions (Image Process, Prediction, Query, Model Performance + 2 helpers confidence)
- **Python Backup**: 7 functions (Disaster Recovery)
- **Python App Route**: 3 functions
- **Frontend Services**: 5 API services + 2 Contexts
- **UI Components**: 10 components (Navigation, Dashboard, Table, Charts)
- **Pages**: 4 pages (Dashboard, Lifecycle, Analytics, Settings)
- **Tổng cộng**: **63 functions** được document

### 🎯 Luồng dữ liệu chính
```
Camera(20x) → [image-process YOLO] → PostgreSQL → [image-predict ML] → FIWARE Orion 
                                                                             ↓
                                                                    Socket.io → React Frontend
```