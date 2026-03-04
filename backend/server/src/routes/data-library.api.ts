import express from "express";
import {
  getCollections,
  getCollectionById,
  createCollection,
  deleteCollection,
  downloadEntry,
  importEntry,
  deleteEntry,
  upload,
} from "../controllers/data-library.controller";
import { requireTechnician } from "../middleware/auth.middleware";

const router = express.Router();

// ---- Collections ----

// GET /api/data-library/collections — danh sách (viewer OK)
router.get("/collections", getCollections);

// GET /api/data-library/collections/:id — chi tiết + entries (viewer OK)
router.get("/collections/:id", getCollectionById);

// POST /api/data-library/collections — tạo collection mới [technician]
router.post("/collections", requireTechnician, createCollection);

// DELETE /api/data-library/collections/:id — xóa collection [technician]
router.delete("/collections/:id", requireTechnician, deleteCollection);

// ---- Entries ----

// GET /api/data-library/entries/:id/download?file={key|all} — tải file (viewer OK)
router.get("/entries/:id/download", downloadEntry);

// POST /api/data-library/entries — import file vào collection [technician]
router.post("/entries", requireTechnician, upload.single("file"), importEntry);

// DELETE /api/data-library/entries/:id — xóa snapshot [technician]
router.delete("/entries/:id", requireTechnician, deleteEntry);

export default router;
