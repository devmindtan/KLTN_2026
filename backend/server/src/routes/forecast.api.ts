import express from "express";
import {
  // getForecastSummary,    // DEPRECATED: MVs không còn tồn tại
  // getForecastTimeline,   // DEPRECATED: MVs không còn tồn tại
  // getForecastSlots,      // DEPRECATED: MVs không còn tồn tại
  getForecastRolling,
} from "../controllers/forecast.controller";

const router = express.Router();

// NOTE: Deprecated routes (/summary, /timeline, /slots) đã bị xóa
// MVs không còn tồn tại (mv_forecast_daily_stats, mv_forecast_hourly, mv_forecast_slots_recent)
// Sử dụng /api/forecast/rolling thay thế

/**
 * GET /api/forecast/rolling?cameraId=all
 * Dữ liệu rolling forecast cho dashboard (ngày hiện tại, 5 horizons, 06:00-23:55)
 */
router.get("/rolling", getForecastRolling);

export default router;
