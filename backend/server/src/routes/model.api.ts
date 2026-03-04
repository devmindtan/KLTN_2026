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
import { requireTechnician, logActivity } from "../middleware/auth.middleware";

const router = express.Router();

// GET /api/models        — tất cả active models (1/type) [viewer OK]
router.get("/", getActiveModels);

// GET /api/models/all    — tất cả versions, grouped by model_type [viewer OK]
router.get("/all", getAllModelVersions);

// GET /api/models/data-range — phạm vi ngày có dữ liệu [viewer OK]
router.get("/data-range", getDataRange);

// POST /api/models/train — tạo k8s Job huấn luyện [technician only]
router.post("/train", requireTechnician, logActivity("TRAIN_MODEL", "model"), trainModel);

// POST /api/models/:id/activate — kích hoạt version mới [technician only]
router.post("/:id/activate", requireTechnician, logActivity("ACTIVATE_MODEL", "model"), activateModel);

// GET /api/models/:id    — chi tiết 1 model [viewer OK]
router.get("/:id", getModelById);

// GET /api/models/:id/history — lịch sử versions cùng loại
router.get("/:id/history", getModelHistory);

export default router;
