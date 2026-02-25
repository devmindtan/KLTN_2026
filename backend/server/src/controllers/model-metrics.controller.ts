import { Request, Response } from "express";
import { z } from "zod";
import pool from "../config/database";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  period_days: z.coerce.number().int().min(1).max(365).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Lấy danh sách lịch sử metrics model theo thời gian
 * GET /api/model-metrics/history
 */
export const getModelMetricsHistory = async (req: Request, res: Response) => {
  try {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Query params không hợp lệ",
        errors: parsed.error.issues,
      });
    }

    const { limit, offset, period_days, from, to } = parsed.data;
    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (period_days !== undefined) {
      params.push(period_days);
      whereClauses.push(`period_days = $${params.length}`);
    }

    if (from) {
      params.push(from);
      whereClauses.push(`generated_at >= $${params.length}::timestamptz`);
    }

    if (to) {
      params.push(to);
      whereClauses.push(`generated_at <= $${params.length}::timestamptz`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM model_metrics_history ${whereSql}`,
      params
    );

    params.push(limit);
    params.push(offset);

    const dataResult = await pool.query(
      `
      SELECT
        id,
        generated_at,
        period_days,
        overall,
        by_horizon,
        camera_ranking,
        data_coverage,
        trend_accuracy,
        created_at
      FROM model_metrics_history
      ${whereSql}
      ORDER BY generated_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params
    );

    return res.status(200).json({
      success: true,
      pagination: {
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
      },
      data: dataResult.rows,
    });
  } catch (error) {
    console.error("Error fetching model metrics history:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử metrics model",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy snapshot metrics model mới nhất
 * GET /api/model-metrics/latest
 */
export const getLatestModelMetrics = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        generated_at,
        period_days,
        overall,
        by_horizon,
        camera_ranking,
        data_coverage,
        trend_accuracy,
        created_at
      FROM model_metrics_history
      ORDER BY generated_at DESC
      LIMIT 1
      `
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Chưa có dữ liệu lịch sử metrics model",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching latest model metrics:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy metrics model mới nhất",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
