import express from "express";
import {
  getLatestModelMetrics,
  getModelMetricsHistory,
} from "../controllers/model-metrics.controller";

const router = express.Router();

// GET /api/model-metrics/latest - Lấy snapshot metrics mới nhất
router.get("/latest", getLatestModelMetrics);

// GET /api/model-metrics/history - Lấy lịch sử metrics model
router.get("/history", getModelMetricsHistory);

export default router;
