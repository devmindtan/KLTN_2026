import { Request, Response } from "express";
import pool from "../config/database";

// ─── LOS (Level of Service) Config ───────────────────────────────────────────
// Ngưỡng V/C ratio (%) → mức dịch vụ giao thông
const LOS_THRESHOLDS: { max: number; level: string; label: string }[] = [
  { max: 40, level: "A", label: "Thông thoáng" },
  { max: 60, level: "B", label: "Ổn định" },
  { max: 75, level: "C", label: "Bão hòa nhẹ" },
  { max: 90, level: "D", label: "Bão hòa" },
  { max: 100, level: "E", label: "Tắc nghẽn nhẹ" },
  { max: Infinity, level: "F", label: "Tắc nghẽn" },
];

/**
 * Phân loại mức dịch vụ giao thông (LOS) từ V/C ratio (%)
 */
function getLOS(vcRatio: number | null): { level: string; label: string } {
  if (vcRatio == null) return { level: "—", label: "—" };
  const entry = LOS_THRESHOLDS.find((t) => vcRatio <= t.max);
  return entry
    ? { level: entry.level, label: entry.label }
    : { level: "F", label: "Tắc nghẽn" };
}

/**
 * Chuyển timestamp DB sang chuỗi HH:MM theo Asia/Ho_Chi_Minh (UTC+7)
 * Dùng explicit offset thay vì toLocaleTimeString để tránh lỗi "6:00" vs "06:00"
 */
function toHCMTime(ts: Date): string {
  const hcm = new Date(ts.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(hcm.getUTCHours()).padStart(2, "0");
  const mm = String(hcm.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Parse query param date, trả về null nếu không hợp lệ */
function parseDateParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Deprecated controllers (getForecastSummary, getForecastTimeline, getForecastSlots)
// đã bị xóa do MVs không còn tồn tại (mv_forecast_daily_stats, mv_forecast_hourly, mv_forecast_slots_recent)
// Sử dụng getForecastRolling thay thế
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dữ liệu rolling forecast cho Dashboard (ngày hiện tại, 5 horizons)
 * GET /api/forecast/rolling?cameraId=all
 *
 * Source: mv_forecast_rolling_today (filtered camera_forecasts ngày hôm nay)
 * Logic:
 *   1. PIVOT 5 horizons thành columns (GROUP BY camera_id, forecast_for_time)
 *   2. JOIN mv_forecast_capacity để lấy capacity
 *   3. Tính vc_ratio: actual / capacity nếu có actual, else f5m / capacity
 *      → NULL nếu cả hai đều NULL (future slots chưa có prediction tại slot đó)
 *   4. Aggregate "all" = trung bình các cameras theo từng time_slot
 */
export const getForecastRolling = async (req: Request, res: Response) => {
  // parseDateParam declared but reserved for future date-range support
  void parseDateParam;

  try {
    // ── Step 1: PIVOT từ MV + capacity JOIN ──────────────────────────────────
    const result = await pool.query(`
      SELECT
        m.camera_id,
        m.forecast_for_time                                               AS time_slot,
        -- Actual value: từ horizon=5 (sync-actual service điền vào)
        MAX(CASE WHEN m.horizon_minutes = 5  THEN m.actual_value    END)  AS actual_value,
        -- Predicted values theo từng horizon
        MAX(CASE WHEN m.horizon_minutes = 5  THEN m.predicted_value END)  AS f5m,
        MAX(CASE WHEN m.horizon_minutes = 10 THEN m.predicted_value END)  AS f10m,
        MAX(CASE WHEN m.horizon_minutes = 15 THEN m.predicted_value END)  AS f15m,
        MAX(CASE WHEN m.horizon_minutes = 30 THEN m.predicted_value END)  AS f30m,
        MAX(CASE WHEN m.horizon_minutes = 60 THEN m.predicted_value END)  AS f60m,
        -- Capacity từ MV riêng
        COALESCE(cap.capacity, 100)                                       AS capacity,
        -- V/C ratio: NULL nếu không có actual và không có f5m (slot tương lai chưa predict)
        -- KHÔNG dùng COALESCE(..., 0) để tránh trả về 0% cho future slots
        CASE
          WHEN MAX(CASE WHEN m.horizon_minutes = 5 THEN m.actual_value    END) IS NOT NULL
            THEN ROUND(LEAST(100,
              MAX(CASE WHEN m.horizon_minutes = 5 THEN m.actual_value END)
              / NULLIF(COALESCE(cap.capacity, 100), 0) * 100
            ))::int
          WHEN MAX(CASE WHEN m.horizon_minutes = 5 THEN m.predicted_value END) IS NOT NULL
            THEN ROUND(LEAST(100,
              MAX(CASE WHEN m.horizon_minutes = 5 THEN m.predicted_value END)
              / NULLIF(COALESCE(cap.capacity, 100), 0) * 100
            ))::int
          ELSE NULL
        END                                                               AS vc_ratio
      FROM mv_forecast_rolling_today m
      LEFT JOIN mv_forecast_capacity cap ON cap.camera_id = m.camera_id
      GROUP BY m.camera_id, m.forecast_for_time, cap.capacity
      ORDER BY m.camera_id, m.forecast_for_time ASC
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        metadata: {
          nowIndex: 0,
          totalSlots: 0,
          nowTime: toHCMTime(new Date()),
          generatedAt: new Date().toISOString(),
          timeRange: { start: "07:00", end: "23:55" },
          description: "Không có dữ liệu dự báo cho ngày hôm nay",
        },
        cameras: {},
        capacities: {},
      });
    }

    /** Làm tròn 1 chữ số thập phân, trả null nếu null */
    const r1 = (v: number | null | undefined): number | null =>
      v == null ? null : Math.round(v * 10) / 10;

    // ── Step 2: Tính nowTime từ created_at mới nhất trong DB ─────────────────
    // Dùng timestamp bản ghi mới nhất thay vì server clock → "now" khớp với data
    // thực tế có trong DB, tránh chỉ thị "Hiện tại" đi trước dữ liệu thực sự tới
    const latestRes = await pool.query<{ latest_at: Date | null }>(
      `SELECT MAX(created_at) AS latest_at
       FROM camera_forecasts
       WHERE created_at::date = CURRENT_DATE`,
    );
    const latestAt = latestRes.rows[0]?.latest_at;
    const now = latestAt ? new Date(latestAt) : new Date();
    const nowTime = toHCMTime(now);

    // ── Step 3: Group rows theo camera_id ────────────────────────────────────
    type PivotRow = {
      camera_id: string;
      time_slot: Date;
      actual_value: number | null;
      f5m: number | null;
      f10m: number | null;
      f15m: number | null;
      f30m: number | null;
      f60m: number | null;
      capacity: number;
      vc_ratio: number | null;
    };

    const cameraMap = new Map<string, PivotRow[]>();
    for (const row of result.rows as PivotRow[]) {
      if (!cameraMap.has(row.camera_id)) cameraMap.set(row.camera_id, []);
      cameraMap.get(row.camera_id)!.push(row);
    }

    // ── Step 4: Build slot array chuẩn cho 1 camera ──────────────────────────
    type SlotOut = {
      t: string;
      actual: number | null;
      actualRef: number | null;
      currentRatio: number | null;
      isFuture: boolean;
      los: string;
      losLabel: string;
      f5m: number | null;
      f10m: number | null;
      f15m: number | null;
      f30m: number | null;
      f60m: number | null;
    };

    const buildSlots = (rows: PivotRow[]): SlotOut[] => {
      const slots: SlotOut[] = rows
        .map((row) => {
          const t = toHCMTime(new Date(row.time_slot));
          const vcRatio = row.vc_ratio ?? null;
          const { level: los, label: losLabel } = getLOS(vcRatio);
          return {
            t,
            actual: r1(row.actual_value),
            actualRef: null as number | null,
            currentRatio: vcRatio,
            isFuture: t >= nowTime,
            los,
            losLabel,
            f5m: r1(row.f5m),
            f10m: r1(row.f10m),
            f15m: r1(row.f15m),
            f30m: r1(row.f30m),
            f60m: r1(row.f60m),
          };
        })
        .sort((a, b) => a.t.localeCompare(b.t));

      // Set actualRef cho future slots (đường baseline tham chiếu trong chart)
      // Tìm backward: actual cuối cùng có data; fallback f5m nếu sync chưa kịp
      const camNowIdx = slots.findIndex((s) => s.t >= nowTime);
      let baselineVal: number | null = null;
      for (let i = camNowIdx; i >= 0; i--) {
        const v = slots[i]?.actual ?? slots[i]?.f5m;
        if (v != null) {
          baselineVal = v;
          break;
        }
      }
      if (baselineVal != null) {
        for (let i = camNowIdx + 1; i < slots.length; i++) {
          slots[i].actualRef = baselineVal;
        }
      }
      return slots;
    };

    // ── Step 5: Aggregate "all" = trung bình cameras theo từng time_slot ─────
    type AccSlot = {
      t: string;
      sums: Record<string, number>;
      cnts: Record<string, number>;
    };
    const FIELDS = [
      "actual",
      "f5m",
      "f10m",
      "f15m",
      "f30m",
      "f60m",
      "currentRatio",
    ] as const;

    const allAcc = new Map<string, AccSlot>();
    for (const row of result.rows as PivotRow[]) {
      const t = toHCMTime(new Date(row.time_slot));
      if (!allAcc.has(t)) {
        allAcc.set(t, { t, sums: {}, cnts: {} });
      }
      const s = allAcc.get(t)!;
      const vals: Record<string, number | null> = {
        actual: row.actual_value,
        f5m: row.f5m,
        f10m: row.f10m,
        f15m: row.f15m,
        f30m: row.f30m,
        f60m: row.f60m,
        currentRatio: row.vc_ratio,
      };
      for (const f of FIELDS) {
        const v = vals[f];
        if (v != null) {
          s.sums[f] = (s.sums[f] ?? 0) + v;
          s.cnts[f] = (s.cnts[f] ?? 0) + 1;
        }
      }
    }

    const allSlotsArray: SlotOut[] = Array.from(allAcc.values())
      .map(({ t, sums, cnts }) => {
        const currentRatio =
          cnts.currentRatio > 0
            ? r1(sums.currentRatio / cnts.currentRatio)
            : null;
        const { level: los, label: losLabel } = getLOS(currentRatio);
        return {
          t,
          actual: cnts.actual > 0 ? r1(sums.actual / cnts.actual) : null,
          actualRef: null as number | null,
          currentRatio,
          isFuture: t >= nowTime,
          los,
          losLabel,
          f5m: cnts.f5m > 0 ? r1(sums.f5m / cnts.f5m) : null,
          f10m: cnts.f10m > 0 ? r1(sums.f10m / cnts.f10m) : null,
          f15m: cnts.f15m > 0 ? r1(sums.f15m / cnts.f15m) : null,
          f30m: cnts.f30m > 0 ? r1(sums.f30m / cnts.f30m) : null,
          f60m: cnts.f60m > 0 ? r1(sums.f60m / cnts.f60m) : null,
        };
      })
      .sort((a, b) => a.t.localeCompare(b.t));

    // Set actualRef cho "all" slots
    const allNowIdx = allSlotsArray.findIndex((s) => s.t >= nowTime);
    let allBaseline: number | null = null;
    for (let i = allNowIdx; i >= 0; i--) {
      const v = allSlotsArray[i]?.actual ?? allSlotsArray[i]?.f5m;
      if (v != null) {
        allBaseline = v;
        break;
      }
    }
    if (allBaseline != null) {
      for (let i = allNowIdx + 1; i < allSlotsArray.length; i++) {
        allSlotsArray[i].actualRef = allBaseline;
      }
    }

    // ── Step 6: Build cameras object ─────────────────────────────────────────
    const cameras: Record<string, { capacity: number; slots: SlotOut[] }> = {
      all: { capacity: 100, slots: allSlotsArray }, // capacity["all"] cập nhật ở Step 7
    };
    for (const [camId, rows] of cameraMap) {
      cameras[camId] = {
        capacity: Number(rows[0]?.capacity ?? 100),
        slots: buildSlots(rows),
      };
    }

    // ── Step 7: Capacity per camera ───────────────────────────────────────────
    const capRows = await pool.query(
      `SELECT camera_id, COALESCE(capacity, 100) AS capacity FROM mv_forecast_capacity`,
    );
    const capacities: Record<string, number> = {};
    let capSum = 0,
      capCount = 0;
    for (const row of capRows.rows) {
      capacities[row.camera_id] = Number(row.capacity);
      capSum += Number(row.capacity);
      capCount++;
    }
    capacities["all"] = capCount > 0 ? Math.round(capSum / capCount) : 100;
    cameras["all"].capacity = capacities["all"]; // Cập nhật capacity "all" sau khi tính xong

    return res.json({
      success: true,
      metadata: {
        nowIndex: allNowIdx >= 0 ? allNowIdx : allSlotsArray.length - 1,
        totalSlots: allSlotsArray.length,
        nowTime,
        generatedAt: new Date().toISOString(),
        timeRange: {
          start: allSlotsArray[0]?.t ?? "07:00",
          end: allSlotsArray[allSlotsArray.length - 1]?.t ?? "23:55",
        },
        description: "Rolling forecast data cho ngày hiện tại",
      },
      capacities, // backward-compat: giữ lại, nhưng capacity cũng có trong cameras[id].capacity
      cameras,
    });
  } catch (err) {
    console.error("[forecast/rolling]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: String(err),
    });
  }
};
