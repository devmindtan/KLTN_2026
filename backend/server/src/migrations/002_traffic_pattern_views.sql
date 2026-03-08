-- ─────────────────────────────────────────────────────────────────────────────
-- Traffic Pattern Materialized Views (Phương án C)
-- Timezone hardcoded UTC+7 (Vietnam)
-- REFRESH order: CREATE MV (empty) → CREATE UNIQUE INDEX → REFRESH (initial, NOT CONCURRENTLY)
-- Subsequent refreshes use CONCURRENTLY (handled by Node.js setInterval)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- UTC+7 math helpers:
--   today VN 6:00 in UTC   = DATE_TRUNC('day',  NOW() + '7h') - '1h'
--   today VN midnight UTC  = DATE_TRUNC('day',  NOW() + '7h') - '7h'
--   week  VN Mon 6:00 UTC  = DATE_TRUNC('week', NOW() + '7h') - '1h'
--   month VN 1st  6:00 UTC = DATE_TRUNC('month',NOW() + '7h') - '1h'
--   year  VN Jan1 6:00 UTC = DATE_TRUNC('year', NOW() + '7h') - '1h'
-- ─────────────────────────────────────────────────────────────────────────────

-- MV 1: Theo GIỜ — scope: hôm nay 6:00 VN → đầu giờ hiện tại VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_hour AS
SELECT
  EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours'))::INT  AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('day',  NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('hour', NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hour ON mv_traffic_by_hour (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_hour;

-- MV 2: Theo NGÀY trong tuần — scope: tuần này T2 6:00 VN → hôm qua 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_dow AS
SELECT
  EXTRACT(ISODOW FROM (created_at + INTERVAL '7 hours'))::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('week', NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('day',  NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dow ON mv_traffic_by_dow (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_dow;

-- MV 3: Theo TUẦN ISO — scope: đầu năm 6:00 VN → hôm qua 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_week_of_month AS
SELECT
  EXTRACT(WEEK FROM (created_at + INTERVAL '7 hours'))::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('year', NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('day',  NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_week ON mv_traffic_by_week_of_month (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_week_of_month;

-- MV 4: Theo THÁNG trong năm — scope: đầu năm 6:00 VN → cuối tháng trước 24:00 VN
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traffic_by_month AS
SELECT
  EXTRACT(MONTH FROM (created_at + INTERVAL '7 hours'))::INT AS dimension_value,
  camera_id,
  ROUND(AVG(total_objects)::NUMERIC, 2) AS avg_vehicles,
  MAX(total_objects)::INT               AS max_vehicles,
  COUNT(*)::INT                         AS sample_count
FROM camera_detections
WHERE created_at >= DATE_TRUNC('year',  NOW() + INTERVAL '7 hours') - INTERVAL '1 hour'
  AND created_at <  DATE_TRUNC('month', NOW() + INTERVAL '7 hours') - INTERVAL '7 hours'
  AND EXTRACT(HOUR FROM (created_at + INTERVAL '7 hours')) BETWEEN 6 AND 23
GROUP BY dimension_value, camera_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_month ON mv_traffic_by_month (dimension_value, camera_id);
REFRESH MATERIALIZED VIEW mv_traffic_by_month;
