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
    
    -- Log thời gian
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Khóa chính để xử lý ON CONFLICT (tránh trùng dữ liệu khi chạy lại chu kỳ)
    PRIMARY KEY (camera_id, forecast_for_time, horizon_minutes)
);

-- Tạo các Index tối ưu cho Grafana và Logic Sync
CREATE INDEX idx_forecast_time_desc ON camera_forecasts (forecast_for_time DESC);
CREATE INDEX idx_sync_null_values ON camera_forecasts (camera_id, forecast_for_time) 
WHERE actual_value IS NULL;


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