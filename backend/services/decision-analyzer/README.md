# Decision Analyzer Service

Service này tổng hợp dữ liệu giao thông từ PostgreSQL, chạy nhiều analyzer song song và tạo ra các quyết định hỗ trợ điều phối giao thông đô thị.

## Mục đích

- Phát hiện ùn tắc hiện tại.
- Dự báo ùn tắc trong 10-60 phút tới.
- Gợi ý tối ưu hoá chu kỳ đèn theo lịch sử 7 ngày.
- Theo dõi chất lượng mô hình dự báo.
- Cảnh báo camera mất tín hiệu hoặc mất dữ liệu.

## Luồng xử lý

1. `main.py` khởi tạo orchestrator.
2. `db_client.py` nạp biến môi trường từ file `.env` ở thư mục gốc của service.
3. 5 analyzer chạy song song.
4. Kết quả được lọc theo `score_compound >= 30` trước khi lưu vào bảng `decisions`.
5. Khi có quyết định mới, service có thể bắn webhook sang `app-route` để cập nhật realtime.

## Nguồn dữ liệu

| Nguồn | Dùng cho | Khoảng thời gian / ngưỡng |
| --- | --- | --- |
| `camera_detections` | Congestion, Optimization, Monitoring | 7 ngày gần nhất để tính capacity p90 và lịch sử; 10 phút gần nhất để lấy số mẫu hiện tại; tối thiểu 10 mẫu cho p90; tối thiểu 3 mẫu gần nhất cho cảnh báo ùn tắc |
| `camera_forecasts` | Predictive, Quality | 60 phút tới cho dự báo; 24 giờ gần nhất cho MAPE; tối thiểu 5 mẫu đầu vào để xét dự báo; tối thiểu 3 bản ghi thực tế để đánh giá chất lượng |
| `camera_data` | Nhãn camera, vị trí | Metadata hiển thị và ghép nối camera |
| `decisions` | Khử trùng lặp khi lưu | Kiểm tra quyết định trong 24 giờ gần nhất theo `(category, primary_camera_id, title_prefix)` |

## Các analyzer

### 1. CongestionAnalyzer

- Đọc từ `camera_detections`.
- Tính sức chứa bằng `PERCENTILE_CONT(0.90)` trên 7 ngày dữ liệu.
- Chỉ lấy camera có `recent_sample_count >= 3`.
- Chỉ tạo quyết định khi V/C `>= 0.75`.
- Phân loại:
	- `>= 1.0`: `congested`
	- `0.85 - 0.999`: `heavy`
	- `0.75 - 0.849`: vẫn vào luồng xử lý tùy mức tải.

### 2. PredictiveAnalyzer

- Đọc từ `camera_forecasts`.
- Chỉ xét dự báo trong khoảng 10-60 phút tới.
- Chỉ lấy forecast có `input_sample_count >= 5`.
- Chỉ lấy forecast có V/C dự báo `>= 0.75`.
- Có thêm `model_mape` 24 giờ để giảm confidence nếu mô hình gần đây kém chính xác.

### 3. OptimizationAnalyzer

- Đọc lịch sử 7 ngày từ `camera_detections`.
- Gom theo giờ trong ngày.
- Chỉ xét khung giờ 06:00-20:00.
- Chỉ lấy nhóm có ít nhất 10 mẫu.
- Chỉ tạo quyết định khi V/C trung bình `>= 0.40`.

### 4. QualityAnalyzer

- Đọc từ `camera_forecasts` có `actual_value`.
- Xét dữ liệu 24 giờ gần nhất.
- Cảnh báo khi:
	- `MAPE > 25%`, hoặc
	- `avg_input_samples < 10`.
- Có cảnh báo mạnh hơn khi `MAPE >= 40%`.

### 5. MonitoringAnalyzer

- Đọc từ `camera_detections`.
- Tìm camera không có dữ liệu trong hơn 30 phút.
- Dùng lịch sử 7 ngày để phân biệt camera mới với camera từng hoạt động.

## Chỉ số và ngưỡng quan trọng

- `score_compound` = `(impact × 0.4) + (confidence × 0.35) + (urgency × 0.25)`.
- Chỉ lưu quyết định nếu `score_compound >= 30`.
- Chỉ emit quyết định nếu `score_confidence` không thấp hơn ngưỡng nội bộ của analyzer.
- Confidence được xây từ:
	- số mẫu,
	- độ tươi của dữ liệu,
	- horizon dự báo,
	- MAPE gần đây.

## Biến môi trường

File `.env` của service nằm tại `backend/services/decision-analyzer/.env`.

Các biến chính:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DBS`
- `POSTGRES_USERNAME`
- `POSTGRES_PASSWORD`
- `APP_ROUTE_WEBHOOK_URL`

## Chạy service

Từ thư mục `backend/services/decision-analyzer/app`:

```bash
python main.py
```

Chế độ test không ghi DB:

```bash
python main.py --test
```

## Ghi chú vận hành

- Nếu chạy port-forward ở máy khác trong LAN, `POSTGRES_HOST` phải trỏ tới IP của máy đó, không dùng `localhost` trên máy đang chạy Python.
- Nếu `APP_ROUTE_WEBHOOK_URL` không có, service vẫn chạy bình thường, chỉ bỏ qua bước notify.
