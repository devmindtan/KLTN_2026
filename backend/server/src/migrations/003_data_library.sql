-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Data Library — collections và entries
-- Tất cả dùng IF NOT EXISTS — idempotent, an toàn khi chạy lại nhiều lần
-- KHÔNG chứa INSERT / seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ data_library_collections — Nhóm dữ liệu (traffic_data, forecast, ...)   │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS data_library_collections (
    collection_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    data_type          VARCHAR(50),              -- 'traffic_data', 'forecast', 'external', ...
    source             VARCHAR(50)  NOT NULL,    -- 'internal' (CronJob) | 'external' (user import)
    entry_count        INTEGER      DEFAULT 0,   -- Denormalized: cập nhật khi insert/delete entry
    last_snapshot_date DATE,
    created_at         TIMESTAMPTZ  DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  DEFAULT NOW()
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ data_library_entries — Snapshot theo ngày của 1 collection              │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS data_library_entries (
    entry_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID        REFERENCES data_library_collections(collection_id) ON DELETE CASCADE,
    snapshot_date   DATE        NOT NULL,
    minio_keys      JSONB       NOT NULL DEFAULT '{}',   -- {"detections": "data-library/...", ...}
    row_count       INTEGER,
    file_size_bytes BIGINT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_entries_collection
    ON data_library_entries(collection_id, snapshot_date DESC);
