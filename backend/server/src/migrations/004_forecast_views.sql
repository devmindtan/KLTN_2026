-- ─────────────────────────────────────────────────────────────────────────────
-- Forecast Materialized Views
-- Mục tiêu: tách phần nặng (CAPACITY_CTE scan 7 ngày camera_detections + LOS calc)
--           ra khỏi request path → refresh định kỳ 5 phút qua Node.js timer.
--
-- Thứ tự CREATE bắt buộc:
--   1. mv_forecast_capacity        (không phụ thuộc MV khác)
--   2. mv_forecast_daily_stats     (chỉ đọc camera_forecasts)
--   3. mv_forecast_hourly          (JOIN mv_forecast_capacity)
--   4. mv_forecast_slots_recent    (JOIN mv_forecast_capacity + camera_data)
--
-- REFRESH order (Node.js timer): capacity → [daily_stats, hourly, slots_recent] parallel
-- ─────────────────────────────────────────────────────────────────────────────

-- ── MV 1: Capacity per-camera (MAX avg 5-min window, last 7 days) ────────────
-- Đây là phần nặng nhất — scan toàn bộ camera_detections 7 ngày
-- Được JOIN bởi mv_forecast_hourly và mv_forecast_slots_recent
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_capacity AS
SELECT
  camera_id,
  COALESCE(MAX(avg_5m), 100) AS capacity
FROM (
  SELECT
    camera_id,
    AVG(total_objects) AS avg_5m
  FROM camera_detections
  WHERE total_objects > 5
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY
    camera_id,
    to_timestamp(floor(extract(epoch FROM created_at) / 300) * 300)
) sub
GROUP BY camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_forecast_capacity
  ON mv_forecast_capacity (camera_id);

REFRESH MATERIALIZED VIEW mv_forecast_capacity;

-- ── MV 2: Daily accuracy stats (last 30 days, horizon=5m) ───────────────────
-- Dùng cho GET /api/forecast/summary?date=YYYY-MM-DD
-- Chỉ chứa các ngày có actual_value đã được sync-actual điền
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_daily_stats AS
SELECT
  (f.forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS slot_date,
  COUNT(*)                                                      AS total_slots,
  COUNT(*) FILTER (WHERE f.actual_value IS NOT NULL)            AS covered_slots,
  COALESCE(
    AVG(f.error_value) FILTER (WHERE f.actual_value IS NOT NULL),
    0
  )                                                             AS mae,
  COALESCE(
    AVG(f.error_value / NULLIF(f.actual_value, 0) * 100)
    FILTER (WHERE f.actual_value IS NOT NULL AND f.actual_value > 0),
    0
  )                                                             AS mape,
  CASE
    WHEN VAR_POP(f.actual_value) FILTER (WHERE f.actual_value IS NOT NULL) > 0
    THEN ROUND(CAST(
      1.0 - (
        SUM(POWER(f.actual_value - f.predicted_value, 2))
          FILTER (WHERE f.actual_value IS NOT NULL)
        / NULLIF(
            COUNT(*) FILTER (WHERE f.actual_value IS NOT NULL)
            * VAR_POP(f.actual_value) FILTER (WHERE f.actual_value IS NOT NULL),
          0)
      ) AS numeric
    ), 3)
    ELSE NULL
  END                                                           AS r2
FROM camera_forecasts f
WHERE f.horizon_minutes = 5
  AND f.forecast_for_time >= NOW() - INTERVAL '30 days'
GROUP BY slot_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_forecast_daily_stats
  ON mv_forecast_daily_stats (slot_date);

REFRESH MATERIALIZED VIEW mv_forecast_daily_stats;

-- ── MV 3: Hourly aggregates per-camera (last 7 days, horizon=5m) ─────────────
-- Dùng cho GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all|<id>
-- camId="all" → controller SUM tất cả camera theo hour
-- camId=<id>  → controller lọc WHERE camera_id = <id>
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_hourly AS
SELECT
  (f.forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS slot_date,
  EXTRACT(HOUR FROM (f.forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int AS hour,
  f.camera_id,
  ROUND(SUM(f.predicted_value))::int                           AS predicted,
  CASE
    WHEN bool_and(f.actual_value IS NULL) THEN NULL
    ELSE ROUND(SUM(f.actual_value))::int
  END                                                          AS actual,
  -- capacity nhân COUNT(*) để đơn vị khớp với predicted/actual (cả 2 đều là tổng giờ)
  -- COUNT(*) = số slot 5-phút thực tế trong giờ đó (thường 12, partial hour có thể ít hơn)
  ROUND(COALESCE(cap.capacity, 100) * COUNT(*))::int           AS capacity
FROM camera_forecasts f
LEFT JOIN mv_forecast_capacity cap ON cap.camera_id = f.camera_id
WHERE f.horizon_minutes = 5
  AND f.forecast_for_time >= NOW() - INTERVAL '7 days'
GROUP BY slot_date, hour, f.camera_id, cap.capacity;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_forecast_hourly
  ON mv_forecast_hourly (slot_date, hour, camera_id);

REFRESH MATERIALIZED VIEW mv_forecast_hourly;

-- ── MV 4: Slot detail per-camera (last 7 days, all horizons) ─────────────────
-- Dùng cho GET /api/forecast/slots?date=YYYY-MM-DD&horizon=5&limit=200
-- Pre-compute LOS, riskLevel, error_pct để controller chỉ cần SELECT + filter
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_slots_recent AS
SELECT
  f.camera_id,
  COALESCE(cd.display_name, f.camera_id)                       AS cam_name,
  (f.forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date  AS slot_date,
  f.forecast_for_time,
  f.horizon_minutes,
  ROUND(f.predicted_value)::int                                 AS predicted_vehicles,
  CASE WHEN f.actual_value IS NOT NULL
    THEN ROUND(f.actual_value)::int
    ELSE NULL
  END                                                           AS actual_vehicles,
  f.error_value,
  CASE
    WHEN f.actual_value IS NOT NULL AND f.actual_value > 0
    THEN ROUND((f.error_value / f.actual_value * 100)::numeric, 1)::float
    ELSE NULL
  END                                                           AS error_pct,
  f.input_value,
  COALESCE(cap.capacity, 100)                                   AS capacity,
  -- predicted_los
  CASE
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.60 THEN 'free_flow'
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.75 THEN 'smooth'
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.85 THEN 'moderate'
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 1.00 THEN 'heavy'
    ELSE 'congested'
  END                                                           AS predicted_los,
  -- actual_los
  CASE
    WHEN f.actual_value IS NULL THEN NULL
    WHEN f.actual_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.60 THEN 'free_flow'
    WHEN f.actual_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.75 THEN 'smooth'
    WHEN f.actual_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 0.85 THEN 'moderate'
    WHEN f.actual_value / NULLIF(COALESCE(cap.capacity, 100), 0) < 1.00 THEN 'heavy'
    ELSE 'congested'
  END                                                           AS actual_los,
  -- vc_pct ( 0–100 )
  ROUND(
    LEAST(100, f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) * 100)
  )::int                                                        AS vc_pct,
  -- risk_level (V/C >= 0.90 → high, >= 0.70 → medium, else low)
  -- Không dùng "critical": frontend type chỉ biết low|medium|high
  CASE
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) >= 0.90 THEN 'high'
    WHEN f.predicted_value / NULLIF(COALESCE(cap.capacity, 100), 0) >= 0.70 THEN 'medium'
    ELSE 'low'
  END                                                           AS risk_level
FROM camera_forecasts f
LEFT JOIN camera_data  cd  ON cd.cam_id      = f.camera_id
LEFT JOIN mv_forecast_capacity cap ON cap.camera_id = f.camera_id
WHERE f.forecast_for_time >= NOW() - INTERVAL '7 days';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_forecast_slots
  ON mv_forecast_slots_recent (camera_id, forecast_for_time, horizon_minutes);

-- Index bổ sung để tăng tốc filter by (slot_date, horizon_minutes)
CREATE INDEX IF NOT EXISTS idx_mv_forecast_slots_date_horizon
  ON mv_forecast_slots_recent (slot_date, horizon_minutes, forecast_for_time DESC);

REFRESH MATERIALIZED VIEW mv_forecast_slots_recent;
