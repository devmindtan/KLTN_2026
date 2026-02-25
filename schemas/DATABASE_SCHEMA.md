-- Tạo bảng lưu trữ kết quả phân tích từ camera
CREATE TABLE IF NOT EXISTS camera_detections (
    id SERIAL PRIMARY KEY,                    -- Khóa chính tự tăng
    camera_id VARCHAR(50) NOT NULL,           -- ID của camera (ví dụ: 662b86c4...)
    minio_key VARCHAR(255) NOT NULL,          -- Đường dẫn file ảnh trên MinIO
    total_objects INTEGER DEFAULT 0,          -- Tổng số phương tiện đếm được
    detections JSONB NOT NULL,                -- Lưu chi tiết đếm (ví dụ: {"car": 5, "motorcycle": 10})
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Thời gian lưu
);

-- Tạo index để truy vấn nhanh hơn khi làm Dashboard
CREATE INDEX idx_camera_id ON camera_detections(camera_id);
CREATE INDEX idx_created_at ON camera_detections(created_at);



-- Tạo bảng với đầy đủ các cột cho Model AI và Đánh giá hiệu năng
CREATE TABLE camera_forecasts (
    -- Các cột định danh (Phục vụ Logic dự báo)
    camera_id           VARCHAR(100) NOT NULL,
    forecast_for_time   TIMESTAMPTZ NOT NULL,
    horizon_minutes     INTEGER NOT NULL,
    predicted_value     DOUBLE PRECISION NOT NULL,
    
    -- 2 cột bổ sung (Phục vụ Logic đồng bộ thực tế & đo lỗi AI)
    actual_value        DOUBLE PRECISION DEFAULT NULL,
    error_value         DOUBLE PRECISION DEFAULT NULL,
    
    -- Data Quality Metadata (Số lượng hình ảnh dùng để tính)
    input_value         DOUBLE PRECISION DEFAULT NULL, -- Giá trị thực tế tại thời điểm predict (avg_objects)
    input_sample_count  INTEGER DEFAULT NULL,          -- Số hình ảnh trong current time bucket
    lag_sample_count    INTEGER DEFAULT NULL,          -- Số hình ảnh trong LAG window (tùy horizon)
    sync_sample_count   INTEGER DEFAULT NULL,          -- Số hình ảnh khi sync actual value
    
    -- Log thời gian
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Khóa chính để xử lý ON CONFLICT (tránh trùng dữ liệu khi chạy lại chu kỳ)
    PRIMARY KEY (camera_id, forecast_for_time, horizon_minutes)
);

-- Tạo các Index tối ưu cho Grafana và Logic Sync
CREATE INDEX idx_forecast_time_desc ON camera_forecasts (forecast_for_time DESC);
CREATE INDEX idx_sync_null_values ON camera_forecasts (camera_id, forecast_for_time) 
WHERE actual_value IS NULL;

-- ============================================
-- DATA QUALITY VERIFICATION NOTES
-- ============================================
-- BUCKET SELECTION LOGIC (query_from_db_realtime):
-- - CHỈ lấy bucket ĐÃ HOÀN THÀNH: time_bucket <= NOW() - 5 minutes
-- - VD: Predict chạy lúc 10:01 (có delay) → Lấy bucket 9:55-10:00 làm input
-- - KHÔNG lấy bucket 10:00-10:05 (chưa đủ 5 phút data do service delay)
-- - Đảm bảo input_sample_count và lag_sample_count đều từ FULL 5-minute buckets
--
-- Value Snapshots:
-- - input_value: Giá trị thực tế (avg_objects) từ bucket ĐÃ HOÀN THÀNH
--   VD: Predict lúc 10:01 từ bucket 9:55-10:00 có avg=10.5 xe → input_value=10.5
--   Purpose: Phân tích trend (input → predicted → actual) mà không cần query lại
--
-- Sample Count Tracking:
-- - input_sample_count: Số hình ảnh trong bucket ĐÃ HOÀN THÀNH (5 phút đầy đủ)
--   VD: Bucket 9:55-10:00 có 29 hình ảnh → input_sample_count=29
-- 
-- - lag_sample_count: Số hình ảnh trong bucket LAG tương ứng horizon
--   VD: Horizon 5m → bucket 9:50-9:55 (lag_5m_count)
--   VD: Horizon 60m → bucket 9:00-9:05 (lag_60m_count)
-- 
-- - sync_sample_count: Số hình ảnh khi sync actual_value
--   Lý tưởng: sync_sample_count ≈ input_sample_count (cùng 5-minute window)
-- 
-- Data Quality Rules:
-- 1. input_sample_count và lag_sample_count đều từ FULL buckets → có thể so sánh công bằng
-- 2. Nếu sample_count < 10 → Low confidence (cảnh báo trong analytics)
-- 3. Nếu |sync_sample_count - input_sample_count| > 5 → Data mismatch
-- 4. Best practice: sample_count >= 30 cho 5-min window (6 FPS × 5 min)
--
-- Value Analysis Examples:
-- - Trend check: predicted_value - input_value (model dự đoán tăng/giảm bao nhiêu)
-- - Error check: predicted_value - actual_value (độ chính xác dự đoán)
-- - Full flow: input_value=10.5 → predicted=15.2 (+4.7) → actual=16.1 (error=-0.9)


-- Bảng lưu lịch sử metrics đánh giá model để hiển thị biểu đồ quá khứ
CREATE TABLE IF NOT EXISTS model_metrics_history (
    id BIGSERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL,
    period_days INTEGER NOT NULL,
    overall JSONB NOT NULL,
    by_horizon JSONB NOT NULL,
    camera_ranking JSONB NOT NULL,
    data_coverage JSONB NOT NULL,
    trend_accuracy JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_metrics_history_generated_at
ON model_metrics_history (generated_at DESC);


-- ============================================
-- TRAFFIC CAPACITY & LEVEL OF SERVICE (LOS)
-- ============================================
-- CAPACITY ĐỘNG (Dynamic Capacity Calculation):
-- - Realtime (status.current): MAX(total_objects) trong 7 ngày (peak value)
-- - Prediction (status.forecast): MAX(AVG 5p) trong 7 ngày (sustainable level)
-- - Fallback: DEFAULT_CAPACITY = 100 vehicles/5min nếu không có dữ liệu
--
-- Đơn vị: vehicles/5minutes (đặc điểm giao thông đô thị VN)
--
-- Level of Service (LOS) Classification (V/C Ratio):
-- +-------+------------+--------------+
-- | LOS   | V/C Ratio  | Status       |
-- +-------+------------+--------------+
-- | A     | < 0.60     | free_flow    |
-- | B-C   | 0.60-0.75  | smooth       |
-- | D     | 0.75-0.85  | moderate     |
-- | E     | 0.85-1.00  | heavy        |
-- | F     | >= 1.00    | congested    |
-- +-------+------------+--------------+
--
-- Trend (% change threshold = 10%):
-- - "stable": |%change| < 10%
-- - "increasing": %change >= 10%
-- - "decreasing": %change <= -10%


CREATE TABLE camera_data (
    cam_id VARCHAR(50) PRIMARY KEY,
    location TEXT, -- Lưu dưới dạng chuỗi '[lat, long]' hoặc sử dụng PostGIS POINT
    display_name TEXT
);

INSERT INTO camera_data (cam_id, location, display_name) VALUES
('662b86c41afb9c00172dd31c', '[10.7918902432446, 106.691054105759]', 'Trần Quang Khải - Trần Khắc Chân'),
('5a6065c58576340017d06615', '[10.8797100979598, 106.677986383438]', 'Tô Ngọc Vân – TX25'),
('6623f4df6f998a001b2528eb', '[10.8361932799182, 106.713809967041]', 'Quốc Lộ 13 - cầu Ông Dầu'),
('662b7ce71afb9c00172dc676', '[10.7726452614037, 106.691064834595]', 'Cách Mạng Tháng Tám - Bùi Thị Xuân'),
('649da77ea6068200171a6dd4', '[10.775301268578, 106.70676112175]', 'Tôn Đức Thắng - Công trường Mê Linh'),
('662b857b1afb9c00172dd106', '[10.7920852162229, 106.699739098549]', 'Điện Biên Phủ - Nguyễn Bỉnh Khiêm'),
('5d9ddd49766c880017188c94', '[10.8016545453012, 106.71106338501]', 'Nút giao Hàng Xanh 1 (Viện Máy tính)'),
('5d9ddec9766c880017188c9c', '[10.8021551350728, 106.711503267288]', 'Nút giao Hàng Xanh 5 (Hàng Xanh - Bạch Đằng)'),
('5a8256315058170011f6eac9', '[10.8133575888573, 106.709566712379]', 'Đinh Bộ Lĩnh - Nguyễn Xí'),
('58b5510817139d0010f35d4e', '[10.8254711543978, 106.71435713768]', 'Phạm Văn Đồng - Quốc Lộ 13 (2)'),
('5d8cd653766c88001718894c', '[10.8509770648006, 106.75500869751]', 'Kha Vạn Cân - Võ Văn Ngân'),
('5d9ddf0f766c880017188c9e', '[10.8007429428369, 106.709132194519]', 'Nút giao Hàng Xanh 6 (Cầu Điện Biên Phủ - Hàng Xanh)'),
('5d9dde1f766c880017188c98', '[10.8001422321862, 106.711294054985]', 'Nút giao Hàng Xanh 3 (Cầu Thị Nghè - Hàng Xanh)'),
('587ee0ecb807da0011e33d50', '[10.8019970541825, 106.696482896805]', 'Phan Đăng Lưu - Lê Văn Duyệt'),
('5a8253615058170011f6eabf', '[10.8030720025958, 106.710022687912]', 'Đinh Bộ Lĩnh - Bạch Đằng 1'),
('6623df636f998a001b251e92', '[10.7839015119534, 106.69704079628]', 'Hai Bà Trưng - Trần Cao Vân'),
('58e49e3dd9d6200011e0b9d1', '[10.7886020312638, 106.6847884655]', 'Nam Kỳ Khởi Nghĩa - Lý Chính Thắng'),
('5a8241105058170011f6eaa6', '[10.7919218604929, 106.695785522461]', 'Đinh Tiên Hoàng - Võ Thị Sáu 2'),
('662b7f9f1afb9c00172dca50', '[10.7904674636287, 106.701471805573]', 'Nguyễn Đình Chiểu - Nguyễn Bỉnh Khiêm'),
('587ed91db807da0011e33d4e', '[10.8024818353159, 106.697963476181]', 'Phan Đăng Lưu - Đinh Tiên Hoàng 2');