import express from "express";
import {
  getAllCameras,
  getCameraById,
  getNearbyCamera,
} from "../controllers/camera.controller";

const router = express.Router();

// GET /api/cameras - Lấy tất cả camera
router.get("/", getAllCameras);

// GET /api/cameras/nearby - Tìm camera gần (phải đặt trước /:cam_id)
router.get("/nearby", getNearbyCamera);

// GET /api/cameras/:cam_id - Lấy chi tiết camera
router.get("/:cam_id", getCameraById);

export default router;
