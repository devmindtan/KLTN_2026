import express from "express";
import {
  getForecastSummary,
  getForecastTimeline,
  getForecastSlots,
} from "../controllers/forecast.controller";

const router = express.Router();

/**
 * GET /api/forecast/summary?date=YYYY-MM-DD
 * Tổng hợp độ chính xác dự báo trong ngày: MAE, MAPE, R², coverage, highRiskCount
 */
router.get("/summary", getForecastSummary);

/**
 * GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all
 * Chuỗi thời gian predicted vs actual per-hour. camId="all" → tổng toàn mạng
 */
router.get("/timeline", getForecastTimeline);

/**
 * GET /api/forecast/slots?date=YYYY-MM-DD&horizon=5&limit=100
 * Danh sách slot dự báo per-camera có tính LOS, riskLevel từ capacity động
 */
router.get("/slots", getForecastSlots);

export default router;
