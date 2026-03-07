import { Request, Response } from "express";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import pool from "../config/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatternType = "hour" | "dow" | "week_of_month" | "month";

// ─── MV Map ───────────────────────────────────────────────────────────────────

const VIEW_MAP: Record<PatternType, string> = {
  hour:          "mv_traffic_by_hour",
  dow:           "mv_traffic_by_dow",
  week_of_month: "mv_traffic_by_week_of_month",
  month:         "mv_traffic_by_month",
};

const MV_NAMES = Object.values(VIEW_MAP) as string[];

// ─── Label Maps ───────────────────────────────────────────────────────────────

const DOW_LABELS   = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const WEEK_LABELS  = ["", "Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4", "Tuần 5"];
const MONTH_LABELS = ["", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

/** Map dimension_value sang label hiển thị (dimension đã tính theo UTC+7) */
function buildDimLabel(dimValue: number, type: PatternType): string {
  if (type === "hour")          return `${String(dimValue).padStart(2, "0")}:00`;
  if (type === "dow")           return DOW_LABELS[dimValue]   || String(dimValue);
  if (type === "week_of_month") return WEEK_LABELS[dimValue]  || String(dimValue);
  if (type === "month")         return MONTH_LABELS[dimValue] || String(dimValue);
  return String(dimValue);
}

// ─── Timezone / Label Helpers ─────────────────────────────────────────────────

/** Format UTC Date → chuỗi local "HH:mm DD/MM/YYYY" */
function fmtLocal(utcDate: Date, tzMs: number): string {
  const local = new Date(utcDate.getTime() + tzMs);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mn = String(local.getUTCMinutes()).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  return `${hh}:${mn} ${dd}/${mo}/${local.getUTCFullYear()}`;
}

/** Format bound kết thúc: nếu là nửa đêm (00:00) → hiển thị "24:00 DD-1" */
function fmtToLabel(utcDate: Date, tzMs: number): string {
  const local = new Date(utcDate.getTime() + tzMs);
  if (local.getUTCHours() === 0 && local.getUTCMinutes() === 0) {
    const prev = new Date(local.getTime() - 24 * 60 * 60 * 1000);
    const dd = String(prev.getUTCDate()).padStart(2, "0");
    const mo = String(prev.getUTCMonth() + 1).padStart(2, "0");
    return `24:00 ${dd}/${mo}/${prev.getUTCFullYear()}`;
  }
  return fmtLocal(utcDate, tzMs);
}

/**
 * Tính time_range label cho từng tab theo chu kỳ hiện tại (chỉ dùng để hiển thị UI)
 * tzMinutes = new Date().getTimezoneOffset() từ frontend (vd: -420 = UTC+7)
 */
function getTimeRange(type: PatternType, tzMinutes: number): { from: string; to: string } {
  const tzMs     = -tzMinutes * 60 * 1000;
  const now      = new Date();
  const localNow = new Date(now.getTime() + tzMs);

  const Y = localNow.getUTCFullYear();
  const M = localNow.getUTCMonth();
  const D = localNow.getUTCDate();
  const H = localNow.getUTCHours();

  let fromUtc: Date;
  let toUtc: Date;

  if (type === "hour") {
    fromUtc = new Date(Date.UTC(Y, M, D, 6, 0, 0) - tzMs);
    toUtc   = new Date(Date.UTC(Y, M, D, H, 0, 0) - tzMs);
  } else if (type === "dow") {
    const dow         = localNow.getUTCDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    fromUtc = new Date(Date.UTC(Y, M, D - daysFromMon, 6, 0, 0) - tzMs);
    toUtc   = new Date(Date.UTC(Y, M, D, 0, 0, 0)               - tzMs);
  } else if (type === "week_of_month") {
    fromUtc = new Date(Date.UTC(Y, M, 1, 6, 0, 0) - tzMs);
    toUtc   = new Date(Date.UTC(Y, M, D, 0, 0, 0) - tzMs);
  } else {
    fromUtc = new Date(Date.UTC(Y, 0, 1, 6, 0, 0) - tzMs);
    toUtc   = new Date(Date.UTC(Y, M, 1, 0, 0, 0) - tzMs);
  }

  return {
    from: fmtLocal(fromUtc, tzMs),
    to:   fmtToLabel(toUtc, tzMs),
  };
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * Lấy dữ liệu phân bố mật độ giao thông theo chiều thời gian (query từ Materialized View)
 * GET /api/traffic/patterns?type=hour&camera_id=all&tz=-420
 */
export const getTrafficPatterns = async (req: Request, res: Response) => {
  try {
    const {
      type,
      camera_id = "all",
      tz = "0",
    } = req.query as { type?: string; camera_id?: string; tz?: string };

    const VALID_TYPES: PatternType[] = ["hour", "dow", "week_of_month", "month"];
    if (!type || !VALID_TYPES.includes(type as PatternType)) {
      return res.status(400).json({
        success: false,
        message: `type không hợp lệ. Phải là một trong: ${VALID_TYPES.join(", ")}`,
      });
    }

    const patternType = type as PatternType;
    const tzMinutes   = parseInt(tz, 10) || 0;
    const viewName    = VIEW_MAP[patternType];
    const timeRange   = getTimeRange(patternType, tzMinutes);

    type RawRow = {
      dimension_value: string;
      avg_vehicles:    string;
      max_vehicles:    string;
      sample_count:    string;
    };

    let rawRows: RawRow[];
    let totalCameras = 1;

    if (camera_id === "all") {
      const result = await pool.query<RawRow>(`
        SELECT dimension_value,
               ROUND(AVG(avg_vehicles)::NUMERIC, 1) AS avg_vehicles,
               MAX(max_vehicles)                    AS max_vehicles,
               SUM(sample_count)::INT               AS sample_count
        FROM ${viewName}
        GROUP BY dimension_value
        ORDER BY dimension_value
      `);
      rawRows = result.rows;

      const countResult = await pool.query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT camera_id)::INT AS cnt FROM ${viewName}`
      );
      totalCameras = parseInt(countResult.rows[0]?.cnt ?? "0", 10);
    } else {
      const result = await pool.query<RawRow>(`
        SELECT dimension_value, avg_vehicles, max_vehicles, sample_count
        FROM ${viewName}
        WHERE camera_id = $1
        ORDER BY dimension_value
      `, [camera_id]);
      rawRows = result.rows;
    }

    const data = rawRows.map((row) => ({
      label:        buildDimLabel(Number(row.dimension_value), patternType),
      avg_vehicles: parseFloat(row.avg_vehicles),
      max_vehicles: parseInt(row.max_vehicles, 10),
      sample_count: parseInt(row.sample_count, 10),
    }));

    return res.status(200).json({
      success: true,
      type,
      camera_id,
      time_range: timeRange,
      data,
      meta: { total_cameras: totalCameras },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[traffic-pattern] Error fetching patterns: ${msg}`);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu mật độ giao thông",
      error: msg,
    });
  }
};

// ─── Startup + Refresh ────────────────────────────────────────────────────────

/**
 * Kiểm tra MV tồn tại, tạo mới nếu chưa có (bao gồm initial REFRESH)
 * Gọi tại server startup — không crash server nếu lỗi, chỉ log
 */
export async function ensureTrafficPatternMV(dbPool: Pool): Promise<void> {
  try {
    const { rows } = await dbPool.query(
      `SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_traffic_by_hour'`
    );
    if (rows.length === 0) {
      const sqlPath = path.join(__dirname, "..", "migrations", "002_traffic_pattern_views.sql");
      const sql     = fs.readFileSync(sqlPath, "utf8");
      await dbPool.query(sql);
      console.log("[traffic-pattern] Materialized views created + initial refresh done ✅");
    } else {
      console.log("[traffic-pattern] Materialized views already exist ✅");
    }
  } catch (err) {
    console.error("[traffic-pattern] Failed to ensure MV:", err);
  }
}

/**
 * Bắt đầu Node.js timer tự động REFRESH MV mỗi 30 phút (thay thế k8s CronJob)
 * Dùng CONCURRENTLY để không block read queries trong lúc refresh
 */
export function startTrafficPatternRefresh(dbPool: Pool): void {
  const INTERVAL_MS = 30 * 60 * 1000;

  setInterval(async () => {
    const start = Date.now();
    try {
      for (const mv of MV_NAMES) {
        await dbPool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`);
      }
      console.log(`[traffic-pattern] Views refreshed in ${Date.now() - start}ms`);
    } catch (err) {
      console.error("[traffic-pattern] Refresh failed:", err);
    }
  }, INTERVAL_MS);

  console.log("[traffic-pattern] Auto-refresh every 30 min started ⏱️");
}
