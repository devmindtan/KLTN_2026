-- ─────────────────────────────────────────────────────────────────────────────
-- Forecast Rolling Today Materialized View
-- Mục tiêu: Filter camera_forecasts chỉ lấy ngày hôm nay (giờ HCM 06:00–23:59)
--           Giữ nguyên structure gốc của camera_forecasts — không PIVOT, không JOIN
--
-- Lý do: PIVOT + capacity join thực hiện trong API controller (rõ ràng, dễ test)
-- Scope: horizon IN (5, 10, 15, 30, 60), predicted_value NOT NULL
-- Dependencies: camera_forecasts
-- Refresh: mỗi 5 phút qua Node.js timer
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_rolling_today AS
SELECT
  camera_id,
  forecast_for_time,
  horizon_minutes,
  predicted_value,
  actual_value,
  error_value,
  input_value,
  created_at
FROM camera_forecasts
WHERE
  -- Chỉ ngày hôm nay theo giờ HCM
  (forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  -- Giờ dự báo 06:00–23:59
  AND EXTRACT(HOUR FROM (forecast_for_time AT TIME ZONE 'Asia/Ho_Chi_Minh')) BETWEEN 6 AND 23
  -- Chỉ 5 horizons cần thiết
  AND horizon_minutes IN (5, 10, 15, 30, 60)
  -- Loại bỏ rows lỗi inference (predicted_value NULL)
  AND predicted_value IS NOT NULL;

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_forecast_rolling_today
  ON mv_forecast_rolling_today (camera_id, forecast_for_time, horizon_minutes);

-- Initial refresh
REFRESH MATERIALIZED VIEW mv_forecast_rolling_today;
