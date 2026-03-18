import express from "express";
import {
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from "../controllers/help.controller";
import { requireTechnician } from "../middleware/auth.middleware";

const router = express.Router();

// GET /api/help/articles — danh sách bài viết (viewer lấy published, technician lấy tất cả)
router.get("/articles", getArticles);

// POST /api/help/articles — tạo bài viết mới [technician]
router.post("/articles", requireTechnician, createArticle);

// PUT /api/help/articles/:id — cập nhật nội dung bài viết [technician]
router.put("/articles/:id", requireTechnician, updateArticle);

// DELETE /api/help/articles/:id — xóa bài viết [technician]
router.delete("/articles/:id", requireTechnician, deleteArticle);

export default router;
