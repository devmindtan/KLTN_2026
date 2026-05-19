import { Request, Response } from "express";
import pool from "../config/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MinuteSlot {
  /** Phút trong ngày VN (180–1435, bước 5 — từ 03:00 đến 23:55) */
  minuteOfDay: number;
  /** Nhãn hiển thị "HH:MM" */
  label: string;
  /** Trung bình số xe thực đo (camera_detections), null nếu không có data */
  actual: number | null;
  /** Trung bình số xe dự báo horizon-5m (camera_forecasts), null nếu không có */
  forecast: number | null;
  sample_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Chuyển ngày VN "YYYY-MM-DD" sang cặp UTC bounds.
 * VN midnight 00:00 = UTC 17:00 ngày trước.
 */
function vnDateToUtcBounds(vnDate: string): { startUtc: string; endUtc: string } {
  const [year, month, day] = vnDate.split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day, -7, 0, 0));
  const endUtc   = new Date(startUtc.getTime() + 24 * 3600 * 1000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
  return { startUtc: fmt(startUtc), endUtc: fmt(endUtc) };
}

/** Phút trong ngày VN → nhãn "HH:MM" */
function minuteToLabel(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Tạo mảng 252 slot 5 phút từ 03:00 (180) đến 23:55 (1435).
 * Gán actual từ camera_detections và forecast từ camera_forecasts.
 */
function buildMinuteSlots(
  actualRows:   Array<{ minute_vn: number; avg_actual: string;   sample_count: string }>,
  forecastRows: Array<{ minute_vn: number; avg_forecast: string }>
): MinuteSlot[] {
  const aMap = new Map(actualRows.map((r)   => [Number(r.minute_vn), r]));
  const fMap = new Map(forecastRows.map((r) => [Number(r.minute_vn), r]));
  const slots: MinuteSlot[] = [];
  for (let m = 180; m < 1440; m += 5) {
    const a = aMap.get(m);
    const f = fMap.get(m);
    slots.push({
      minuteOfDay: m,
      label:       minuteToLabel(m),
      actual:      a ? Math.round(parseFloat(a.avg_actual)   * 10) / 10 : null,
      forecast:    f ? Math.round(parseFloat(f.avg_forecast) * 10) / 10 : null,
      sample_count: a ? parseInt(a.sample_count) : 0,
    });
  }
  return slots;
}

// ─── SQL fragments ────────────────────────────────────────────────────────────

/** Biểu thức tính minute-of-day (bước 5) từ created_at UTC → VN time */
const DET_MIN_EXPR =
  `(EXTRACT(HOUR   FROM (created_at + INTERVAL '7 hours'))::int * 60 +
    (EXTRACT(MINUTE FROM (created_at + INTERVAL '7 hours'))::int / 5) * 5)`;

/** Biểu thức tính minute-of-day (bước 5) từ forecast_for_time TIMESTAMPTZ → VN time */
const FCST_MIN_EXPR =
  `(EXTRACT(HOUR   FROM (forecast_for_time AT TIME ZONE 'UTC' + INTERVAL '7 hours'))::int * 60 +
    (EXTRACT(MINUTE FROM (forecast_for_time AT TIME ZONE 'UTC' + INTERVAL '7 hours'))::int / 5) * 5)`;

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * Lấy dữ liệu lưu lượng giao thông theo 5 phút (từ 03:00 VN) cho một ngày cụ thể.
 * Trả về 252 slot kèm cả actual (camera_detections) và forecast (camera_forecasts horizon=5m).
 * GET /api/traffic/history?date=YYYY-MM-DD&camera_id=all
 */
export async function getTrafficHistory(req: Request, res: Response): Promise<void> {
  const dateParam = req.query.date as string | undefined;
  const cameraId  = (req.query.camera_id as string | undefined) || "all";

  let targetDate = dateParam;
  if (!targetDate) {
    const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
    vnNow.setUTCDate(vnNow.getUTCDate() - 1);
    targetDate = `${vnNow.getUTCFullYear()}-${String(vnNow.getUTCMonth() + 1).padStart(2, "0")}-${String(vnNow.getUTCDate()).padStart(2, "0")}`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    res.status(400).json({ success: false, error: "date phải có định dạng YYYY-MM-DD" });
    return;
  }

  const { startUtc, endUtc } = vnDateToUtcBounds(targetDate);
  const startTz = `${startUtc} UTC`; // dùng cho TIMESTAMPTZ comparison
  const endTz   = `${endUtc} UTC`;

  try {
    // ── Actual: camera_detections (5-min buckets, bắt đầu 03:00 VN) ──────────
    let actualRows: Array<{ minute_vn: number; avg_actual: string; sample_count: string }>;
    if (cameraId === "all") {
      const r = await pool.query<typeof actualRows[0]>(
        `SELECT minute_vn,
                AVG(total_objects) AS avg_actual,
                COUNT(*)           AS sample_count
         FROM (
           SELECT total_objects, ${DET_MIN_EXPR}::int AS minute_vn
           FROM camera_detections
           WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
         ) sub
         WHERE minute_vn >= 180
         GROUP BY minute_vn ORDER BY minute_vn`,
        [startUtc, endUtc]
      );
      actualRows = r.rows;
    } else {
      const r = await pool.query<typeof actualRows[0]>(
        `SELECT minute_vn,
                AVG(total_objects) AS avg_actual,
                COUNT(*)           AS sample_count
         FROM (
           SELECT total_objects, ${DET_MIN_EXPR}::int AS minute_vn
           FROM camera_detections
           WHERE camera_id = $1
             AND created_at >= $2::timestamp AND created_at < $3::timestamp
         ) sub
         WHERE minute_vn >= 180
         GROUP BY minute_vn ORDER BY minute_vn`,
        [cameraId, startUtc, endUtc]
      );
      actualRows = r.rows;
    }

    // ── Forecast: camera_forecasts horizon=5m (5-min buckets, từ 03:00 VN) ───
    let forecastRows: Array<{ minute_vn: number; avg_forecast: string }>;
    if (cameraId === "all") {
      const r = await pool.query<typeof forecastRows[0]>(
        `SELECT minute_vn,
                AVG(predicted_value) AS avg_forecast
         FROM (
           SELECT predicted_value, ${FCST_MIN_EXPR}::int AS minute_vn
           FROM camera_forecasts
           WHERE forecast_for_time >= $1::timestamptz
             AND forecast_for_time <  $2::timestamptz
             AND horizon_minutes = 5
         ) sub
         WHERE minute_vn >= 180
         GROUP BY minute_vn ORDER BY minute_vn`,
        [startTz, endTz]
      );
      forecastRows = r.rows;
    } else {
      const r = await pool.query<typeof forecastRows[0]>(
        `SELECT minute_vn,
                AVG(predicted_value) AS avg_forecast
         FROM (
           SELECT predicted_value, ${FCST_MIN_EXPR}::int AS minute_vn
           FROM camera_forecasts
           WHERE camera_id = $1
             AND forecast_for_time >= $2::timestamptz
             AND forecast_for_time <  $3::timestamptz
             AND horizon_minutes = 5
         ) sub
         WHERE minute_vn >= 180
         GROUP BY minute_vn ORDER BY minute_vn`,
        [cameraId, startTz, endTz]
      );
      forecastRows = r.rows;
    }

    const slots = buildMinuteSlots(actualRows, forecastRows);

    res.json({
      success: true,
      date: targetDate,
      camera_id: cameraId,
      data: slots,
    });
  } catch (err) {
    console.error("[traffic-history] query error:", err);
    res.status(500).json({ success: false, error: "Lỗi truy vấn dữ liệu lịch sử giao thông" });
  }
}
