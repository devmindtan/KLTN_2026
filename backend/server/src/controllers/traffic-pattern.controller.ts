import { Request, Response } from "express";
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

// ─── Label Maps ───────────────────────────────────────────────────────────────

const DOW_LABELS   = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const MONTH_LABELS = ["", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

/** Tính ngày Thứ 2 của ISO week W năm Y, trả về đối tượng Date */
function isoWeekMondayDate(week: number, year: number): Date {
  const jan4    = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4.getTime() - (jan4Dow - 1) * 86400000);
  return new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000);
}

/** Map dimension_value sang label hiển thị */
function buildDimLabel(dimValue: number, type: PatternType, year?: number): string {
  if (type === "hour")          return `${String(dimValue).padStart(2, "0")}:00`;
  if (type === "dow")           return DOW_LABELS[dimValue]   || String(dimValue);
  if (type === "week_of_month") {
    if (!year) return `Tuần ${dimValue}`;
    const monday = isoWeekMondayDate(dimValue, year);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const strip = (d: number) => String(d); // bỏ 0 đứng đầu
    const monStr = `${strip(monday.getUTCDate())}/${strip(monday.getUTCMonth() + 1)}`;
    const sunStr = `${strip(sunday.getUTCDate())}/${strip(sunday.getUTCMonth() + 1)}`;
    return `${monStr}-${sunStr}`;
  }
  if (type === "month")         return MONTH_LABELS[dimValue] || String(dimValue);
  return String(dimValue);
}

// ─── Timezone / Label Helpers ─────────────────────────────────────────────────

/** Format UTC Date → chuỗi UTC "HH:mm DD/MM/YYYY" */
function fmtUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mn = String(date.getUTCMinutes()).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${hh}:${mn} ${dd}/${mo}/${date.getUTCFullYear()}`;
}

/** Format bound kết thúc: nếu nửa đêm UTC (00:00) → hiển thị "24:00 DD-1" */
function fmtToUtc(date: Date): string {
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    const prev = new Date(date.getTime() - 86400000);
    const dd = String(prev.getUTCDate()).padStart(2, "0");
    const mo = String(prev.getUTCMonth() + 1).padStart(2, "0");
    return `24:00 ${dd}/${mo}/${prev.getUTCFullYear()}`;
  }
  return fmtUtc(date);
}

/**
 * Tính time_range label cho tab hour/dow theo chu kỳ hiện tại.
 * dimension_value trong MV là giờ/ngày VN (UTC+7), nên time_range cũng phải theo VN local.
 */
function getTimeRange(type: PatternType): { from: string; to: string } {
  const now = new Date();
  // Chuyển sang giờ VN (UTC+7) để căn chỉnh với dimension_value trong MV
  const vnNow = new Date(now.getTime() + 7 * 3600 * 1000);
  const Y = vnNow.getUTCFullYear();
  const M = vnNow.getUTCMonth();
  const D = vnNow.getUTCDate();
  const H = vnNow.getUTCHours(); // giờ VN hiện tại

  let fromUtc: Date;
  let toUtc: Date;

  if (type === "hour") {
    // từ 06:00 VN hôm nay → giờ VN hiện tại (exclusive = giờ cuối đã hoàn thành)
    fromUtc = new Date(Date.UTC(Y, M, D, 6, 0, 0));
    toUtc   = new Date(Date.UTC(Y, M, D, H, 0, 0));
  } else if (type === "dow") {
    const dow         = vnNow.getUTCDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    fromUtc = new Date(Date.UTC(Y, M, D - daysFromMon, 6, 0, 0));
    toUtc   = new Date(Date.UTC(Y, M, D, 0, 0, 0));
  } else {
    fromUtc = new Date(Date.UTC(Y, 0, 1, 6, 0, 0));
    toUtc   = new Date(Date.UTC(Y, M, 1, 0, 0, 0));
  }

  return { from: fmtUtc(fromUtc), to: fmtToUtc(toUtc) };
}

/**
 * Tính label time_range từ data thực tế cho tab week và month (UTC, không cộng offset)
 */
function buildDataRangeLabel(
  type: PatternType,
  dimValues: number[]
): { from: string; to: string } | undefined {
  if (dimValues.length === 0) return undefined;

  const now  = new Date();
  const Y    = now.getUTCFullYear();
  const minDim = Math.min(...dimValues);
  const maxDim = Math.max(...dimValues);

  if (type === "week_of_month") {
    // Monday của tuần đầu tiên có data → 24:00 hôm qua UTC
    const fromDate = isoWeekMondayDate(minDim, Y);
    const fdd = String(fromDate.getUTCDate()).padStart(2, "0");
    const fmo = String(fromDate.getUTCMonth() + 1).padStart(2, "0");
    const fyr = fromDate.getUTCFullYear();
    const todayMidnight = new Date(Date.UTC(Y, now.getUTCMonth(), now.getUTCDate()));
    const prevDay = new Date(todayMidnight.getTime() - 86400000);
    const pdd = String(prevDay.getUTCDate()).padStart(2, "0");
    const pmo = String(prevDay.getUTCMonth() + 1).padStart(2, "0");
    const pyr = prevDay.getUTCFullYear();
    return {
      from: `06:00 ${fdd}/${fmo}/${fyr}`,
      to:   `24:00 ${pdd}/${pmo}/${pyr}`,
    };
  }
  if (type === "month") {
    const fromLbl = MONTH_LABELS[minDim] ?? `T${minDim}`;
    const toLbl   = MONTH_LABELS[maxDim] ?? `T${maxDim}`;
    return { from: fromLbl, to: `${toLbl} · ${Y}` };
  }
  return undefined;
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
    // MV hardcoded UTC+7 — luôn dùng năm VN (không phụ thuộc vào tz param)
    const localYear   = new Date(new Date().getTime() + 7 * 3600 * 1000).getUTCFullYear();

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
      label:        buildDimLabel(Number(row.dimension_value), patternType, localYear),
      avg_vehicles: parseFloat(row.avg_vehicles),
      max_vehicles: parseInt(row.max_vehicles, 10),
      sample_count: parseInt(row.sample_count, 10),
    }));

    // month + week: label từ data thực tế (tránh hiển thị 1/1 khi data bắt đầu muộn hơn)
    // hour/dow: label từ getTimeRange() (chu kỳ lý thuyết hiện tại)
    let timeRange: { from: string; to: string } | undefined;
    if (patternType === "month" || patternType === "week_of_month") {
      timeRange = buildDataRangeLabel(
        patternType,
        rawRows.map((r) => Number(r.dimension_value))
      );
    } else {
      timeRange = getTimeRange(patternType);
    }

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

// ─── Startup: xem migrations/runner.ts ───────────────────────────────────────
// Kiểm tra + tạo Materialized Views được quản lý tập trung bởi runMigrations()
// Controller chỉ đảm nhiệm query — không có logic startup ở đây
