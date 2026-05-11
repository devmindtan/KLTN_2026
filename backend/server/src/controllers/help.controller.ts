import { Request, Response } from "express";
import pool from "../config/database";

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách tất cả bài viết tài liệu hướng dẫn đã publish
 * GET /api/help/articles
 * - Viewer: chỉ lấy is_published = true
 * - Technician: lấy tất cả (kể cả đang ẩn)
 */
export const getArticles = async (req: Request, res: Response) => {
  try {
    const isTechnician = req.auth?.role === "technician";
    const sql = isTechnician
      ? `SELECT id, section_key, parent_key, type, title, summary, content, tech_detail,
                sort_order, is_published, created_at, updated_at
           FROM help_articles
           ORDER BY sort_order ASC, created_at ASC`
      : `SELECT id, section_key, parent_key, type, title, summary, content, tech_detail,
                sort_order, is_published, created_at, updated_at
           FROM help_articles
           WHERE is_published = TRUE
           ORDER BY sort_order ASC, created_at ASC`;

    const result = await pool.query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[help] Error fetching articles:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách bài viết",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Tạo bài viết tài liệu mới
 * POST /api/help/articles
 */
export const createArticle = async (req: Request, res: Response) => {
  try {
    const { section_key, parent_key, type, title, summary, content, tech_detail, sort_order } = req.body;

    if (!section_key || typeof section_key !== "string" || section_key.trim() === "") {
      return res.status(400).json({ success: false, message: "section_key là bắt buộc" });
    }
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ success: false, message: "title là bắt buộc" });
    }

    const articleType = type === "question" ? "question" : "document";

    const result = await pool.query(
      `INSERT INTO help_articles
         (section_key, parent_key, type, title, summary, content, tech_detail, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        section_key.trim(),
        parent_key ?? null,
        articleType,
        title.trim(),
        summary ?? "",
        content ?? "",
        tech_detail ?? null,
        sort_order ?? 0,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: unknown) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as NodeJS.ErrnoException).code === "23505"
    ) {
      return res.status(409).json({ success: false, message: "section_key đã tồn tại" });
    }
    console.error("[help] Error creating article:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo bài viết",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Cập nhật nội dung bài viết
 * PUT /api/help/articles/:id
 */
export const updateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, summary, content, tech_detail, type } = req.body;

    // Chỉ update các trường được gửi lên (partial update)
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined)       { fields.push(`title = $${idx++}`);       values.push(title); }
    if (summary !== undefined)     { fields.push(`summary = $${idx++}`);     values.push(summary); }
    if (content !== undefined)     { fields.push(`content = $${idx++}`);     values.push(content); }
    if (tech_detail !== undefined) { fields.push(`tech_detail = $${idx++}`); values.push(tech_detail); }
    if (type !== undefined) {
      const t = type === "question" ? "question" : "document";
      fields.push(`type = $${idx++}`);
      values.push(t);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "Không có trường nào để cập nhật" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE help_articles SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[help] Error updating article:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật bài viết",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Xóa bài viết tài liệu
 * DELETE /api/help/articles/:id
 */
export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM help_articles WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    res.status(200).json({ success: true, message: "Đã xóa bài viết" });
  } catch (error) {
    console.error("[help] Error deleting article:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa bài viết",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
