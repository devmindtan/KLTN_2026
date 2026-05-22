/**
 * Decisions Controller - API endpoints for Decision-Making system
 * Handles CRUD operations for recommendations and decision tracking
 * Supports analysis triggering, review workflows, and history queries
 */
import { Request, Response } from "express";
import { z } from "zod";
import { Pool } from "pg";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const analyzeDecisionsSchema = z.object({
  cameras: z.string().optional(),                    // comma-separated camera IDs
  time_window: z.enum(["24h", "48h", "7d"]).default("24h"),
  category: z.enum(["congestion", "predictive", "optimization", "quality", "monitoring"]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

const reviewDecisionSchema = z.object({
  status: z.enum(["reviewed", "implemented", "dismissed"]),
  feedback: z.string().optional(),
});

const listDecisionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),                     // comma-separated: new,reviewed,implemented,dismissed
  category: z.string().optional(),                   // comma-separated
  sort_by: z.enum(["score", "urgency", "created_at"]).default("score"),
  sort_order: z.enum(["desc", "asc"]).default("desc"),
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Tính compound score từ 3 components
 * Score = (Impact × 0.4) + (Confidence × 0.35) + (Urgency × 0.25)
 */
function calculateCompoundScore(impact: number, confidence: number, urgency: number): number {
  const compound = (impact * 0.4) + (confidence * 0.35) + (urgency * 0.25);
  return Math.round(compound * 100) / 100;  // Round to 2 decimals
}

/**
 * Convert time_window to minutes
 */
function getTimeWindowMinutes(timeWindow: string): number {
  const windows: Record<string, number> = {
    "24h": 1440,
    "48h": 2880,
    "7d": 10080,
  };
  return windows[timeWindow] || 1440;
}

function getAuthUserId(req: Request): string | undefined {
  return req.auth?.userId || (req.auth as { sub?: string } | undefined)?.sub;
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

/**
 * GET /api/decisions/analyze
 * Trigger analysis and return current recommendations
 * 
 * Query params:
 *   - cameras: comma-separated camera IDs (optional, all if omitted)
 *   - time_window: 24h|48h|7d (default: 24h)
 *   - category: congestion|predictive|optimization|quality|monitoring (optional)
 *   - limit: max results (default: 20)
 */
export async function analyzeDecisions(req: Request, res: Response) {
  try {
    const query = analyzeDecisionsSchema.parse(req.query);
    const db = req.app.locals.db as Pool;

    // Get current active decisions ordered by compound score
    let sql = `
      SELECT 
        id, category, title, recommendation, rationale,
        score_impact, score_confidence, score_urgency, score_compound,
        camera_ids, route_id, evidence, action_items,
        status, reviewed_by, reviewed_at, feedback,
        generated_at, effective_until, created_by
      FROM decisions
      WHERE status IN ('new', 'reviewed')
        AND (effective_until IS NULL OR effective_until > NOW())
    `;

    const params: unknown[] = [];
    let paramIdx = 1;

    // Filter by cameras
    if (query.cameras) {
      const cameraArray = query.cameras.split(",").map((c) => c.trim());
      sql += ` AND camera_ids::jsonb @> $${paramIdx}::jsonb`;
      params.push(JSON.stringify(cameraArray));
      paramIdx++;
    }

    // Filter by category
    if (query.category) {
      sql += ` AND category = $${paramIdx}`;
      params.push(query.category);
      paramIdx++;
    }

    // Order and limit
    sql += ` ORDER BY score_compound DESC`;
    sql += ` LIMIT $${paramIdx}`;
    params.push(query.limit);

    const result = await db.query(sql, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      time_window: query.time_window,
      query: {
        cameras: query.cameras || "all",
        category: query.category || "all",
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    console.error("[analyzeDecisions] error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze decisions" });
  }
}

/**
 * GET /api/decisions
 * List all decisions with pagination and filters
 */
export async function listDecisions(req: Request, res: Response) {
  try {
    const query = listDecisionsSchema.parse(req.query);
    const db = req.app.locals.db as Pool;

    const offset = (query.page - 1) * query.limit;
    let sql = "SELECT * FROM decisions WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 1;

    // Filter by status
    if (query.status) {
      const statuses = query.status.split(",").map((s) => s.trim());
      const placeholders = statuses.map((_, i) => `$${paramIdx + i}`).join(",");
      sql += ` AND status IN (${placeholders})`;
      params.push(...statuses);
      paramIdx += statuses.length;
    }

    // Filter by category
    if (query.category) {
      const categories = query.category.split(",").map((c) => c.trim());
      const placeholders = categories.map((_, i) => `$${paramIdx + i}`).join(",");
      sql += ` AND category IN (${placeholders})`;
      params.push(...categories);
      paramIdx += categories.length;
    }

    // Count total (filtered) and global status counts (for StatChips)
    const [countResult, statusCountsResult] = await Promise.all([
      db.query(sql.replace("SELECT *", "SELECT COUNT(*) as total"), params),
      db.query("SELECT status, COUNT(*) as count FROM decisions GROUP BY status"),
    ]);
    const total = parseInt(countResult.rows[0].total, 10);
    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult.rows) {
      statusCounts[row.status] = parseInt(row.count, 10);
    }

    // Fetch paginated data
    const sortCol = query.sort_by === "score" ? "compound" : query.sort_by;
    const sortDir = query.sort_order === "desc" ? "DESC" : "ASC";
    // urgency column is score_urgency; created_at sorts by generated_at
    const orderExpr = sortCol === "created_at"
      ? `generated_at ${sortDir}`
      : `score_${sortCol} ${sortDir}`;
    sql += ` ORDER BY ${orderExpr}`;
    sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(query.limit, offset);

    const result = await db.query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      status_counts: statusCounts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    console.error("[listDecisions] error:", error);
    res.status(500).json({ success: false, error: "Failed to list decisions" });
  }
}

/**
 * GET /api/decisions/:id
 * Get single decision details
 */
export async function getDecisionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = req.app.locals.db as Pool;

    const result = await db.query(
      "SELECT * FROM decisions WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Decision not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: unknown) {
    console.error("[getDecisionById] error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch decision" });
  }
}

/**
 * GET /api/decisions/camera/:cameraId
 * Get decision history for specific camera
 */
export async function getDecisionHistory(req: Request, res: Response) {
  try {
    const { cameraId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const db = req.app.locals.db as Pool;

    // Query decisions that affect this camera
    const result = await db.query(
      `SELECT * FROM decisions 
       WHERE camera_ids::jsonb @> $1::jsonb
       ORDER BY generated_at DESC
       LIMIT $2 OFFSET $3`,
      [JSON.stringify([cameraId]), limit, offset]
    );

    res.json({
      success: true,
      camera_id: cameraId,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error: unknown) {
    console.error("[getDecisionHistory] error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch decision history" });
  }
}

/**
 * POST /api/decisions/:id/review
 * Review decision and provide feedback
 * 
 * Body:
 *   - status: reviewed|implemented|dismissed
 *   - feedback: optional comment
 */
export async function reviewDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = reviewDecisionSchema.parse(req.body);
    const db = req.app.locals.db as Pool;
    const userId = getAuthUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Update decision with review
    const result = await db.query(
      `UPDATE decisions 
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), feedback = $3
       WHERE id = $4
       RETURNING *`,
      [body.status, userId, body.feedback || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Decision not found" });
      return;
    }

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address)
       VALUES ($1, 'REVIEW_DECISION', 'decisions', $2, $3, $4)`,
      [userId, id, JSON.stringify({ status: body.status, feedback: body.feedback }), req.ip]
    );

    res.json({
      success: true,
      message: `Decision marked as ${body.status}`,
      data: result.rows[0],
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    console.error("[reviewDecision] error:", error);
    res.status(500).json({ success: false, error: "Failed to review decision" });
  }
}

/**
 * POST /api/decisions/:id/implement
 * Mark decision as implemented
 * 
 * Body:
 *   - implementation_details: description of what was done
 */
export async function implementDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { implementation_details } = req.body;
    const db = req.app.locals.db as Pool;
    const userId = getAuthUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Update decision status
    const result = await db.query(
      `UPDATE decisions 
       SET status = 'implemented', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Decision not found" });
      return;
    }

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address)
       VALUES ($1, 'IMPLEMENT_DECISION', 'decisions', $2, $3, $4)`,
      [userId, id, JSON.stringify({ implementation_details }), req.ip]
    );

    res.json({
      success: true,
      message: "Decision marked as implemented",
      data: result.rows[0],
    });
  } catch (error: unknown) {
    console.error("[implementDecision] error:", error);
    res.status(500).json({ success: false, error: "Failed to implement decision" });
  }
}

/**
 * DELETE /api/decisions/:id
 * Dismiss a decision (soft delete by marking as dismissed)
 */
export async function dismissDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = req.app.locals.db as Pool;
    const userId = getAuthUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const result = await db.query(
      `UPDATE decisions 
       SET status = 'dismissed', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Decision not found" });
      return;
    }

    res.json({
      success: true,
      message: "Decision dismissed",
      data: result.rows[0],
    });
  } catch (error: unknown) {
    console.error("[dismissDecision] error:", error);
    res.status(500).json({ success: false, error: "Failed to dismiss decision" });
  }
}

/**
 * POST /api/decisions/create
 * Manually create a decision (for technicians)
 * 
 * Body: Full Decision object
 */
export async function createDecision(req: Request, res: Response) {
  try {
    const db = req.app.locals.db as Pool;
    const userId = getAuthUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const {
      category, title, recommendation, rationale,
      score_impact, score_confidence, score_urgency,
      camera_ids = [],
      evidence = {},
      action_items = [],
      effective_until,
    } = req.body;

    // Validate required fields
    if (!category || !title || !recommendation || !rationale) {
      res.status(400).json({ success: false, error: "Missing required fields" });
      return;
    }

    // Calculate compound score
    const score_compound = calculateCompoundScore(
      score_impact || 0,
      score_confidence || 0,
      score_urgency || 0
    );

    // Insert decision
    const result = await db.query(
      `INSERT INTO decisions (
        category, title, recommendation, rationale,
        score_impact, score_confidence, score_urgency, score_compound,
        camera_ids, evidence, action_items, effective_until, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        category, title, recommendation, rationale,
        score_impact || 0, score_confidence || 0, score_urgency || 0, score_compound,
        JSON.stringify(camera_ids), JSON.stringify(evidence),
        JSON.stringify(action_items), effective_until, userId,
      ]
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address)
       VALUES ($1, 'CREATE_DECISION', 'decisions', $2, $3, $4)`,
      [userId, result.rows[0].id, JSON.stringify({ category, title }), req.ip]
    );

    res.status(201).json({
      success: true,
      message: "Decision created successfully",
      data: result.rows[0],
    });
  } catch (error: unknown) {
    console.error("[createDecision] error:", error);
    res.status(500).json({ success: false, error: "Failed to create decision" });
  }
}
