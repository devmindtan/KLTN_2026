import { Request, Response } from "express";
import pool from "../config/database";

/** Parse query param date, trả về null nếu không hợp lệ */
function parseDateParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tổng hợp chỉ số độ chính xác dự báo trong ngày: MAE, MAPE, R², coverage, highRiskCount
 * GET /api/forecast/summary?date=YYYY-MM-DD
 */
export const getForecastSummary = async (req: Request, res: Response) => {
  const date = parseDateParam(req.query.date) ?? new Date().toISOString().slice(0, 10);

  try {
    const [statsResult, riskResult] = await Promise.all([
      pool.query(
        `SELECT *
         FROM mv_forecast_daily_stats
         WHERE slot_date = $1::date`,
        [date]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT camera_id)::int AS high_risk_count
         FROM mv_forecast_slots_recent
         WHERE actual_vehicles IS NULL
           AND horizon_minutes = 5
           AND forecast_for_time >= NOW() - INTERVAL '5 minutes'
           AND forecast_for_time <= NOW() + INTERVAL '10 minutes'
           AND vc_pct >= 90`
      ),
    ]);

    const row  = statsResult.rows[0];
    const mape = row ? parseFloat(row.mape ?? "0") : 0;
    const mae  = row ? parseFloat(row.mae  ?? "0") : 0;
    const r2   = row?.r2 != null ? parseFloat(row.r2) : null;

    return res.json({
      success: true,
      data: {
        date,
        avgAccuracy:    mape > 0 ? Math.max(0, Math.round((100 - mape) * 10) / 10) : null,
        mae:            Math.round(mae * 10) / 10,
        mape:           Math.round(mape * 10) / 10,
        r2,
        totalSlots:     row ? parseInt(row.total_slots,   10) : 0,
        coveredSlots:   row ? parseInt(row.covered_slots, 10) : 0,
        networkTrend:   null,  // computed on client via socket
        networkChangePct: null,
        highRiskCount:  riskResult.rows[0]?.high_risk_count ?? 0,
      },
    });
  } catch (err) {
    console.error("[forecast/summary]", err);
    return res.status(500).json({ success: false, message: "Lỗi server", error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuỗi thời gian dự báo vs thực tế theo từng giờ (aggregate toàn mạng hoặc per-camera)
 * GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all
 */
export const getForecastTimeline = async (req: Request, res: Response) => {
  const date  = parseDateParam(req.query.date) ?? new Date().toISOString().slice(0, 10);
  const camId = typeof req.query.camId === "string" ? req.query.camId : "all";

  try {
    const isAll = camId === "all";
    const baseSql = `
      SELECT
        hour,
        SUM(predicted)::int  AS predicted,
        CASE WHEN bool_and(actual IS NULL)
             THEN NULL
             ELSE SUM(actual)::int END                                   AS actual,
        ROUND(LEAST(100, SUM(predicted)::numeric / NULLIF(SUM(capacity), 0) * 100))::int AS vc_pct,
        bool_and(actual IS NULL)                                         AS is_future
      FROM mv_forecast_hourly
      WHERE slot_date = $1::date
      ${isAll ? "" : "AND camera_id = $2"}
      GROUP BY hour
      ORDER BY hour ASC`;

    const params = isAll ? [date] : [date, camId];
    const result = await pool.query(baseSql, params);

    const data = result.rows.map((row) => ({
      hour:      String(row.hour).padStart(2, "0") + ":00",
      predicted: row.predicted ?? 0,
      actual:    row.actual    ?? null,
      isFuture:  row.is_future as boolean,
      vcPct:     row.vc_pct   ?? null,
    }));

    return res.json({ success: true, date, camId, data });
  } catch (err) {
    console.error("[forecast/timeline]", err);
    return res.status(500).json({ success: false, message: "Lỗi server", error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Danh sách slot dự báo per-camera: predicted, actual, LOS, riskLevel
 * GET /api/forecast/slots?date=YYYY-MM-DD&horizon=5&limit=100
 */
export const getForecastSlots = async (req: Request, res: Response) => {
  const date    = parseDateParam(req.query.date) ?? new Date().toISOString().slice(0, 10);
  const horizon = Number(req.query.horizon) || 5;
  const limit   = Math.min(Number(req.query.limit) || 100, 500);

  if (![5, 10, 15, 30, 60].includes(horizon)) {
    return res.status(400).json({ success: false, message: "horizon phải là 5|10|15|30|60" });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM mv_forecast_slots_recent
       WHERE slot_date = $1::date
         AND horizon_minutes = $2
       ORDER BY forecast_for_time DESC, camera_id
       LIMIT $3`,
      [date, horizon, limit]
    );

    const data = result.rows.map((row) => ({
      id:                `${row.camera_id}-${row.horizon_minutes}m-${new Date(row.forecast_for_time).getTime()}`,
      timeSlot:          new Date(row.forecast_for_time).toISOString(),
      duration:          row.horizon_minutes as 5 | 10 | 15 | 30 | 60,
      camId:             row.camera_id,
      camName:           row.cam_name,
      predictedVehicles: row.predicted_vehicles,
      actualVehicles:    row.actual_vehicles ?? null,
      errorPct:          row.error_pct   != null ? parseFloat(row.error_pct)   : null,
      inputValue:        row.input_value != null ? parseFloat(row.input_value) : null,
      predictedLos:      row.predicted_los,
      actualLos:         row.actual_los  ?? null,
      vcPct:             row.vc_pct,
      riskLevel:         row.risk_level as "low" | "medium" | "high",
      deltaVsWeekAvg:    null,
      confidence:        null,
      modelVersion:      undefined,
    }));

    return res.json({ success: true, date, horizon, count: data.length, data });
  } catch (err) {
    console.error("[forecast/slots]", err);
    return res.status(500).json({ success: false, message: "Lỗi server", error: String(err) });
  }
};


