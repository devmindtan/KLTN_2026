import express from "express";
import {
  getActiveModels,
  getAllModelVersions,
  getModelById,
  getModelHistory,
  activateModel,
  trainModel,
  getDataRange,
} from "../controllers/model.controller";

const router = express.Router();

// GET /api/models        — tất cả active models (1/type)
router.get("/", getActiveModels);

// GET /api/models/all    — tất cả versions, grouped by model_type
router.get("/all", getAllModelVersions);

// GET /api/models/data-range — phạm vi ngày có dữ liệu trong camera_detections
router.get("/data-range", getDataRange);

// POST /api/models/train — tạo k8s Job huấn luyện phiên bản mới
router.post("/train", trainModel);

// POST /api/models/:id/activate — kích hoạt version mới (phải đặt trước /:id để tránh conflict)
router.post("/:id/activate", activateModel);

// GET /api/models/:id    — chi tiết 1 model
router.get("/:id", getModelById);

// GET /api/models/:id/history — lịch sử versions cùng loại
router.get("/:id/history", getModelHistory);

export default router;
