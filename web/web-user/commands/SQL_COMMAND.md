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
('6623f4df6f998a001b2528eb', '[10.8361932799182, 106.713809967041]', 'Quốc Lộ 13 - cầu ông Dầu'),
('662b7ce71afb9c00172dc676', '[10.7516310243765, 106.674996328704]', 'Nguyễn Tri Phương - Trần Phú'),
('649da77ea6068200171a6dd4', '[10.817027376644, 106.643336713314]', 'Cộng Hòa - Quách Văn Tuấn'),
('662b857b1afb9c00172dd106', '[10.7600888944512, 106.680073280599]', 'Trần Hưng Đạo - Nguyễn Biểu'),
('5d9ddd49766c880017188c94', '[10.7538947672205, 106.653457134962]', 'Hồng Bàng - Ngô Quyền'),
('5d9ddec9766c880017188c9c', '[10.7533810452656, 106.65792286396]', 'Hồng Bàng - Lý Thường Kiệt'),
('5a8256315058170011f6eac9', '[10.7548028889392, 106.651703623315]', 'Hồng Bàng - Học Lạc'),
('58b5510817139d0010f35d4e', '[10.7554897287957, 106.649320870638]', 'Hồng Bàng - Tản Đà'),
('5d8cd653766c88001718894c', '[10.7562624328606, 106.646549226157]', 'Hồng Bàng - Châu Văn Liêm'),
('5d9ddf0f766c880017188c9e', '[10.758064985227, 106.638522446155]', 'Hồng Bàng - Nguyễn Thị Nhỏ'),
('5d9dde1f766c880017188c98', '[10.7618218104557, 106.633900254965]', 'Hồng Bàng - Hoàng Lê Kha'),
('587ee0ecb807da0011e33d50', '[10.7634293026775, 106.62934422493]', 'Hồng Bàng - Minh Phụng'),
('5a8253615058170011f6eabf', '[10.7508493134608, 106.671317517757]', 'Ba Tháng Hai - Lê Hồng Phong'),
('6623df636f998a001b251e92', '[10.7661131154569, 106.659992337227]', 'Ba Tháng Hai - Lý Thường Kiệt'),
('58e49e3dd9d6200011e0b9d1', '[10.7712399990861, 106.653457134962]', 'Ba Tháng Hai - Nguyễn Tri Phương'),
('5a8241105058170011f6eaa6', '[10.7744383115291, 106.647754311562]', 'Ba Tháng Hai - Lê Đại Hành'),
('662b7f9f1afb9c00172dca50', '[10.7570806489816, 106.688178777695]', 'Dương Bá Trạc - Đường số 9'),
('587ed91db807da0011e33d4e', '[10.7548239108342, 106.696344211152]', 'Cầu Ông Lãnh - Hoàng Diệu');