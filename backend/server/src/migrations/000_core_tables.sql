-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 000: Core tables (camera_data, detections, forecasts, model metadata, backup)
-- Tất cả dùng IF NOT EXISTS — idempotent, an toàn khi chạy lại nhiều lần
-- KHÔNG chứa INSERT / seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ camera_data — Danh sách camera trong hệ thống                           │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS camera_data (
    cam_id       VARCHAR(50) PRIMARY KEY,
    location     TEXT,          -- Chuỗi '[lat, lng]' hoặc PostGIS POINT
    display_name TEXT
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ camera_detections — Kết quả nhận diện YOLO từng khung hình              │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS camera_detections (
    id            SERIAL PRIMARY KEY,
    camera_id     VARCHAR(50)  NOT NULL,
    minio_key     VARCHAR(255) NOT NULL,    -- images/{camera_id}/{YYYYMMDD_HHMMSS}.jpg
    total_objects INTEGER      DEFAULT 0,
    detections    JSONB        NOT NULL,    -- {"car": 5, "motorcycle": 10, ...}
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camera_id
    ON camera_detections(camera_id);

CREATE INDEX IF NOT EXISTS idx_created_at
    ON camera_detections(created_at);

-- Composite indexes cho Traffic Pattern API (tránh full-scan)
CREATE INDEX IF NOT EXISTS idx_cam_det_cam_time
    ON camera_detections(camera_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cam_det_time
    ON camera_detections(created_at DESC);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ camera_forecasts — Kết quả dự báo lưu lượng từng horizon               │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS camera_forecasts (
    camera_id           VARCHAR(100)       NOT NULL,
    forecast_for_time   TIMESTAMPTZ        NOT NULL,
    horizon_minutes     INTEGER            NOT NULL,
    predicted_value     DOUBLE PRECISION   NOT NULL,
    actual_value        DOUBLE PRECISION   DEFAULT NULL,
    error_value         DOUBLE PRECISION   DEFAULT NULL,
    input_value         DOUBLE PRECISION   DEFAULT NULL,
    input_sample_count  INTEGER            DEFAULT NULL,
    lag_sample_count    INTEGER            DEFAULT NULL,
    sync_sample_count   INTEGER            DEFAULT NULL,
    created_at          TIMESTAMPTZ        DEFAULT NOW(),
    PRIMARY KEY (camera_id, forecast_for_time, horizon_minutes)
);

CREATE INDEX IF NOT EXISTS idx_forecast_time_desc
    ON camera_forecasts(forecast_for_time DESC);

CREATE INDEX IF NOT EXISTS idx_sync_null_values
    ON camera_forecasts(camera_id, forecast_for_time)
    WHERE actual_value IS NULL;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ model_metrics_history — Lịch sử snapshot đánh giá hiệu năng model      │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS model_metrics_history (
    id                      BIGSERIAL    PRIMARY KEY,
    generated_at            TIMESTAMPTZ  NOT NULL,
    period_days             INTEGER      NOT NULL,
    overall                 JSONB        NOT NULL,
    by_horizon              JSONB        NOT NULL,
    camera_ranking          JSONB        NOT NULL,
    data_coverage           JSONB        NOT NULL,
    trend_accuracy          JSONB        NOT NULL,
    confidence_distribution JSONB        DEFAULT NULL,
    created_at              TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_history_generated_at
    ON model_metrics_history(generated_at DESC);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ml_model_metadata — Quản lý version và trạng thái active của từng model │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS ml_model_metadata (
    id                     SERIAL        PRIMARY KEY,
    model_type             VARCHAR(50)   NOT NULL,
    model_version          VARCHAR(50)   NOT NULL,
    minio_key              VARCHAR(255)  NOT NULL,
    base_model             VARCHAR(100),
    training_samples       INTEGER,
    training_duration_hours FLOAT,
    metrics                JSONB,
    is_active              BOOLEAN       DEFAULT FALSE,
    activated_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(model_type, model_version)
);

CREATE INDEX IF NOT EXISTS idx_model_active
    ON ml_model_metadata(model_type, is_active)
    WHERE is_active = TRUE;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ backup_logs — Lịch sử backup database lên Google Drive                  │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS backup_logs (
    id               BIGSERIAL     PRIMARY KEY,
    backup_type      VARCHAR(50)   NOT NULL,
    started_at       TIMESTAMPTZ   NOT NULL,
    completed_at     TIMESTAMPTZ,
    duration_seconds INTEGER,
    status           VARCHAR(20)   NOT NULL,
    storage_location VARCHAR(500),
    file_size_mb     DECIMAL(10,2),
    compressed       BOOLEAN       DEFAULT TRUE,
    error_message    TEXT,
    metadata         JSONB,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_started
    ON backup_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_logs_status
    ON backup_logs(status)
    WHERE status != 'success';
