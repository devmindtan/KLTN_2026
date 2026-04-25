## Các sơ đồ phân rã chức năng cho từng service (theo SVG đã thiết kế)

---

### 1) app-route

**Hình**

![app-route diagram](../assets/images/app-route-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                 | Mô tả                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `Webhook (POST /webhook)` | Điểm nhận notification từ FIWARE Orion khi entity thay đổi.                                 |
| `Validate Payload`        | Kiểm tra payload hợp lệ trước khi xử lý.                                                    |
| `Parse Entity Type`       | Phân loại entity theo type để điều hướng event phù hợp.                                     |
| `CAMERA_UPDATED`          | Phát sự kiện realtime cho thay đổi dữ liệu camera.                                          |
| `METRICS_UPDATED`         | Phát sự kiện realtime khi dữ liệu model metrics đổi.                                        |
| `FORECAST_UPDATED`        | Phát sự kiện cập nhật dự báo mới cho frontend.                                              |
| `get_ip()`                | Tiện ích lấy IP nội bộ service/container.                                                   |
| `show_all_ips()`          | Hiển thị các IP/endpoint phục vụ debug và cấu hình.                                         |
| `Entity Types`            | Nhóm loại entity được xử lý: Camera, ModelMetrics, TrainingJob, ModelReload, ForecastReady. |

---

### 2) backup-postgres

**Hình**

![backup-postgres diagram](../assets/images/backup-postgres-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                | Mô tả                                                     |
| ------------------------ | --------------------------------------------------------- |
| `log_backup_start()`     | Ghi nhận phiên backup bắt đầu (trạng thái running).       |
| `run_pg_dump()`          | Tạo dump PostgreSQL bằng định dạng custom `-Fc`.          |
| `Built-in compression`   | Dùng nén tích hợp của `pg_dump` để giảm dung lượng/I/O.   |
| `upload_to_gdrive()`     | Upload file backup lên Google Drive qua `rclone`.         |
| `cleanup_local_backup()` | Xóa file tạm sau khi upload để giải phóng dung lượng.     |
| `log_backup_complete()`  | Cập nhật trạng thái hoàn tất/thất bại và metadata backup. |

---

### 3) data-export

**Hình**

![data-export diagram](../assets/images/data-export-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                   | Mô tả                                          |
| --------------------------- | ---------------------------------------------- |
| `Validate date range (D-1)` | Xác định khoảng dữ liệu ngày hôm qua theo UTC. |
| `query_detections()`        | Truy vấn dữ liệu phát hiện phương tiện từ DB.  |
| `query_forecasts()`         | Truy vấn dữ liệu dự báo từ DB.                 |
| `export_detections()`       | Xuất detections lên MinIO.                     |
| `export_forecasts()`        | Xuất forecasts lên MinIO.                      |
| `export_summary()`          | Xuất file tổng hợp summary lên MinIO.          |
| `upsert_collection()`       | Tạo/cập nhật metadata collection trong DB.     |
| `insert_entry()`            | Thêm bản ghi metadata cho snapshot export.     |

---

### 4) image-process

**Hình**

![image-process diagram](../assets/images/image-process-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                | Mô tả                                                  |
| ------------------------ | ------------------------------------------------------ |
| `Load YOLO model`        | Nạp model YOLO dùng cho nhận diện ảnh.                 |
| `Init S3 Client`         | Khởi tạo client kết nối MinIO/S3 để lấy ảnh.           |
| `Init DB Pool`           | Khởi tạo pool kết nối DB phục vụ ghi dữ liệu liên tục. |
| `refresh_capacity_map()` | Làm mới capacity map định kỳ cho tính toán LOS.        |
| `20 cameras`             | Vòng lặp xử lý theo danh sách camera đang theo dõi.    |
| `Fetch image`            | Lấy frame mới nhất từ nguồn lưu trữ/stream.            |
| `YOLO detect`            | Chạy inference YOLO để nhận diện phương tiện.          |
| `Count objects`          | Đếm tổng số đối tượng theo frame.                      |
| `Save to DB`             | Lưu kết quả detection vào cơ sở dữ liệu.               |
| `LOS = objects/capacity` | Tính mức tải/LOS dựa trên tỷ lệ volume-capacity.       |
| `Update FIWARE`          | Đồng bộ trạng thái realtime lên FIWARE Orion.          |

---

### 5) image-predict

**Hình**

![image-predict diagram](../assets/images/image-predict-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                       | Mô tả                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `load_models_into_cache()`      | Nạp sẵn bộ RF models (5m–60m) vào bộ nhớ để dự báo nhanh.       |
| `query_from_db_realtime()`      | Lấy dữ liệu gần thời gian thực để tạo input dự báo.             |
| `Feature engineering`           | Tạo feature phục vụ mô hình dự báo.                             |
| `Predict 5 horizons`            | Dự báo 5 mốc thời gian và lưu bằng `forecast_and_save_to_db()`. |
| `calculate_los()`               | Tính mức tải dự báo theo capacity.                              |
| `calculate_trend()`             | Tính xu hướng tăng/giảm/ổn định từ dữ liệu dự báo.              |
| `POST /reload-model`            | API reload model động không cần restart service.                |
| `train.py`                      | Pipeline huấn luyện/cập nhật model dự báo.                      |
| `Update FIWARE (ForecastReady)` | Phát tín hiệu forecast mới sẵn sàng lên FIWARE.                 |

---

### 6) model-performance

**Hình**

![model-performance diagram](../assets/images/model-performance.svg)

**Giải thích từng chức năng**

| Chức năng                                  | Mô tả                                              |
| ------------------------------------------ | -------------------------------------------------- |
| `Query camera_forecasts with actual_value` | Lấy dữ liệu dự báo đã có ground-truth để đánh giá. |
| `Overall: MAE, MAPE`                       | Tính các chỉ số lỗi tổng thể của mô hình.          |
| `By Horizon (5m–60m)`                      | Đánh giá chất lượng theo từng mốc dự báo.          |
| `By Camera`                                | Đánh giá sai số theo từng camera.                  |
| `Input sample count`                       | Đo độ tin cậy đầu vào theo số mẫu.                 |
| `LAG sample count`                         | Đo độ đầy đủ dữ liệu lịch sử dùng cho dự báo.      |
| `save_metrics_to_db()`                     | Lưu snapshot metrics vào DB.                       |
| `Update FIWARE`                            | Đẩy metrics mới lên FIWARE phục vụ realtime UI.    |

---

### 7) report-generator

**Hình**

![report-generator diagram](../assets/images/report-generator-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                             | Mô tả                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| `Load report config`                  | Nạp cấu hình báo cáo (tham số thời gian, template, tuỳ chọn).  |
| `Duration > 1 day?`                   | Quyết định chiến lược query chuẩn hoặc chia chunk.             |
| `_collect_traffic_data()`             | Thu thập dữ liệu trực tiếp cho khoảng thời gian ngắn.          |
| `_generate_chunked()`                 | Thu thập dữ liệu theo từng phần cho khoảng thời gian dài.      |
| `analyze_traffic_data()`              | Phân tích dữ liệu, tạo các chỉ số thống kê chính.              |
| `LOS breakdown`                       | Tổng hợp phân bố mức LOS trong kỳ báo cáo.                     |
| `Forecast vs actual`                  | So sánh dự báo và thực tế để đánh giá chất lượng.              |
| `create_executive_pdf()`              | Xuất báo cáo PDF dạng executive summary.                       |
| `create_data_xlsx()`                  | Xuất báo cáo dữ liệu chi tiết dạng XLSX.                       |
| `Upload MinIO → Update report status` | Upload file lên MinIO và cập nhật trạng thái báo cáo trong DB. |

---

### 8) sync-actual

**Hình**

![sync-actual diagram](../assets/images/sync-actual-diagram.svg)

**Giải thích từng chức năng**

| Chức năng                    | Mô tả                                                    |
| ---------------------------- | -------------------------------------------------------- |
| `Define window: 5h lookback` | Xác định cửa sổ đồng bộ dữ liệu 5 giờ gần nhất.          |
| `sync_actual_values()`       | Hàm đồng bộ actual vào bảng forecast.                    |
| `Query camera_detections`    | Lấy dữ liệu detections làm nguồn actual.                 |
| `Per 5-min bucket`           | Gom dữ liệu theo bucket 5 phút.                          |
| `Calc real_avg`              | Tính giá trị thực tế trung bình của bucket.              |
| `Calc sample_count`          | Đếm số mẫu trong bucket để kiểm soát chất lượng.         |
| `Bucket complete?`           | Kiểm tra bucket đã đủ điều kiện thời gian để sync chưa.  |
| `actual_value`               | Ghi actual_value vào bản ghi dự báo tương ứng.           |
| `sample_count`               | Ghi số lượng mẫu dùng cho lần sync.                      |
| `error_value`                | Tính sai số giữa dự báo và thực tế.                      |
| `Skip bucket`                | Bỏ qua bucket chưa hoàn thành để tránh sai lệch dữ liệu. |
