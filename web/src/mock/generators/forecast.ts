/**
 * Mock cho forecast.service.ts — trọng tâm là GET /api/forecast/rolling vì đây là
 * endpoint thực sự được Dashboard / Search sử dụng. Summary/Timeline/Slots cũng được
 * hỗ trợ đầy đủ để các trang khác (nếu dùng tới) không bị vỡ.
 */
import type {
  ForecastRollingResponse,
  ForecastRollingSlot,
  ForecastSlotItem,
  ForecastSlotsResponse,
  ForecastSummaryResponse,
  ForecastTimelinePoint,
  ForecastTimelineResponse,
  HorizonMinutes,
} from "@/services/forecast.service";
import { CAMERA_SEEDS } from "./cameras";
import { combinedLoadFactor, currentVnMinuteOfDay, minuteToLabel, vnNow } from "../engine/time-curve";
import { clamp, jitter, round1 } from "../engine/utils";
import { losFromVc, losLabelVi, losLetterFromVc, riskFromLos, vcRatio } from "../engine/camera-engine";

const START_MINUTE = 7 * 60; // 07:00
const END_MINUTE = 23 * 60 + 55; // 23:55
const STEP = 5;
const TOTAL_SLOTS = (END_MINUTE - START_MINUTE) / STEP + 1; // 204

function loadFactorAtMinuteOfDay(minuteOfDay: number): number {
  const base = vnNow();
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMinutes(minuteOfDay);
  return combinedLoadFactor(d);
}

function buildSlotsForCamera(capacity: number, nowMinute: number): ForecastRollingSlot[] {
  const slots: ForecastRollingSlot[] = [];
  for (let m = START_MINUTE; m <= END_MINUTE; m += STEP) {
    const idx = (m - START_MINUTE) / STEP;
    const isFuture = m > nowMinute;
    const trueVolume = clamp(capacity * loadFactorAtMinuteOfDay(m), 0, capacity * 1.3);

    const actual = isFuture ? null : Math.round(clamp(trueVolume * jitter(1, 0.12), 0, capacity * 1.3));
    const actualRef = Math.round(clamp(trueVolume * jitter(1, 0.06), 0, capacity * 1.3));

    const baseline = actual ?? actualRef;
    const vc = vcRatio(baseline, capacity);

    const horizonNoise: Record<string, number> = { f5m: 0.08, f10m: 0.14, f15m: 0.2, f30m: 0.3, f60m: 0.42 };
    const horizonOffsets: Record<string, number> = { f5m: 5, f10m: 10, f15m: 15, f30m: 30, f60m: 60 };

    const forecastVals: Record<string, number | null> = {};
    (["f5m", "f10m", "f15m", "f30m", "f60m"] as const).forEach((key) => {
      // Dự báo được "sinh ra" ở thời điểm (target - horizon); chỉ tồn tại nếu thời điểm sinh đã qua
      const generatedAtMinute = m - horizonOffsets[key];
      if (generatedAtMinute < START_MINUTE - 60) {
        forecastVals[key] = null;
        return;
      }
      const targetTrue = clamp(capacity * loadFactorAtMinuteOfDay(m), 0, capacity * 1.3);
      forecastVals[key] = Math.round(clamp(targetTrue * jitter(1, horizonNoise[key]), 0, capacity * 1.35));
    });

    void idx;
    slots.push({
      t: minuteToLabel(m),
      actual,
      actualRef,
      currentRatio: round1(vc * 100),
      isFuture,
      los: losLetterFromVc(vc),
      losLabel: losLabelVi(losFromVc(vc)),
      f5m: forecastVals.f5m,
      f10m: forecastVals.f10m,
      f15m: forecastVals.f15m,
      f30m: forecastVals.f30m,
      f60m: forecastVals.f60m,
    });
  }
  return slots;
}

export function buildForecastRolling(): ForecastRollingResponse {
  const nowMinuteRaw = currentVnMinuteOfDay();
  const nowMinute = clamp(nowMinuteRaw, START_MINUTE, END_MINUTE);
  const nowIndex = Math.round((nowMinute - START_MINUTE) / STEP);

  const capacities: Record<string, number> = {};
  const cameras: ForecastRollingResponse["cameras"] = {};

  let totalCapacity = 0;
  const aggregateSlots: ForecastRollingSlot[] | null = null;
  void aggregateSlots;

  CAMERA_SEEDS.forEach((seed) => {
    capacities[seed.cam_id] = seed.capacity;
    cameras[seed.cam_id] = { capacity: seed.capacity, slots: buildSlotsForCamera(seed.capacity, nowMinute) };
    totalCapacity += seed.capacity;
  });

  // Pseudo-camera "all" — tổng hợp toàn mạng, dùng khi UI mặc định cameraId="all"
  const allSlots: ForecastRollingSlot[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    let actualSum = 0;
    let actualRefSum = 0;
    let hasActual = false;
    let f5 = 0, f10 = 0, f15 = 0, f30 = 0, f60 = 0;
    let anyF5 = false, anyF10 = false, anyF15 = false, anyF30 = false, anyF60 = false;
    let t = "";
    let isFuture = true;

    Object.values(cameras).forEach((cam) => {
      const slot = cam.slots[i];
      t = slot.t;
      isFuture = slot.isFuture;
      if (slot.actual != null) { actualSum += slot.actual; hasActual = true; }
      actualRefSum += slot.actualRef ?? 0;
      if (slot.f5m != null) { f5 += slot.f5m; anyF5 = true; }
      if (slot.f10m != null) { f10 += slot.f10m; anyF10 = true; }
      if (slot.f15m != null) { f15 += slot.f15m; anyF15 = true; }
      if (slot.f30m != null) { f30 += slot.f30m; anyF30 = true; }
      if (slot.f60m != null) { f60 += slot.f60m; anyF60 = true; }
    });

    const vc = vcRatio(hasActual ? actualSum : actualRefSum, totalCapacity);
    allSlots.push({
      t,
      actual: hasActual ? actualSum : null,
      actualRef: actualRefSum,
      currentRatio: round1(vc * 100),
      isFuture,
      los: losLetterFromVc(vc),
      losLabel: losLabelVi(losFromVc(vc)),
      f5m: anyF5 ? f5 : null,
      f10m: anyF10 ? f10 : null,
      f15m: anyF15 ? f15 : null,
      f30m: anyF30 ? f30 : null,
      f60m: anyF60 ? f60 : null,
    });
  }
  capacities["all"] = totalCapacity;
  cameras["all"] = { capacity: totalCapacity, slots: allSlots };

  return {
    success: true,
    metadata: {
      nowIndex,
      totalSlots: TOTAL_SLOTS,
      nowTime: minuteToLabel(nowMinute),
      generatedAt: new Date().toISOString(),
      timeRange: { start: minuteToLabel(START_MINUTE), end: minuteToLabel(END_MINUTE) },
      description: "Dự báo cuốn chiếu mô phỏng (Mock Mode) — 5 horizon: 5/10/15/30/60 phút",
    },
    capacities,
    cameras,
  };
}

export function buildForecastSummary(date: string): ForecastSummaryResponse {
  const mae = round1(2 + Math.random() * 3);
  const mape = round1(8 + Math.random() * 10);
  return {
    date,
    avgAccuracy: round1(100 - mape),
    mae,
    mape,
    r2: round1(0.8 + Math.random() * 0.15),
    totalSlots: TOTAL_SLOTS * CAMERA_SEEDS.length,
    coveredSlots: Math.round(TOTAL_SLOTS * CAMERA_SEEDS.length * 0.92),
    highRiskCount: Math.round(jitter(6, 6)),
    networkTrend: Math.random() > 0.5 ? "increase" : Math.random() > 0.5 ? "decrease" : "stable",
    networkChangePct: round1(jitter(0, 12)),
  };
}

export function buildForecastTimeline(date: string, camId: string): ForecastTimelineResponse {
  const data: ForecastTimelinePoint[] = [];
  for (let h = 0; h < 24; h++) {
    const factor = loadFactorAtMinuteOfDay(h * 60);
    const capacity = camId === "all" ? 3200 : CAMERA_SEEDS.find((c) => c.cam_id === camId)?.capacity ?? 150;
    const predicted = Math.round(clamp(capacity * factor * jitter(1, 0.15), 0, capacity * 1.3));
    const actual = Math.round(clamp(capacity * factor * jitter(1, 0.1), 0, capacity * 1.3));
    data.push({ hour: h, predicted, actual, vcPct: round1((actual / capacity) * 100) });
  }
  return { success: true, date, camId, data };
}

export function buildForecastSlots(date: string, horizon: HorizonMinutes, limit: number): ForecastSlotsResponse {
  const data: ForecastSlotItem[] = [];
  CAMERA_SEEDS.forEach((seed) => {
    const factor = loadFactorAtMinuteOfDay(currentVnMinuteOfDay());
    const predicted = Math.round(clamp(seed.capacity * factor * jitter(1, 0.15), 0, seed.capacity * 1.3));
    const actual = Math.round(clamp(predicted * jitter(1, 0.1), 0, seed.capacity * 1.35));
    const vc = vcRatio(actual, seed.capacity);
    const los = losFromVc(vc);
    data.push({
      id: `${seed.cam_id}_${date}_${horizon}`,
      timeSlot: `${date}T${minuteToLabel(currentVnMinuteOfDay())}:00`,
      duration: horizon,
      camId: seed.cam_id,
      camName: seed.display_name,
      predictedVehicles: predicted,
      actualVehicles: actual,
      errorPct: round1((Math.abs(predicted - actual) / Math.max(actual, 1)) * 100),
      inputValue: Math.round(actual * jitter(1, 0.1)),
      predictedLos: los,
      actualLos: los,
      vcPct: round1(vc * 100),
      riskLevel: riskFromLos(los),
      deltaVsWeekAvg: round1(jitter(0, 10)),
      confidence: round1(70 + Math.random() * 25),
      modelVersion: "mock_v1",
    });
  });
  return { success: true, total: data.length, data: data.slice(0, limit) };
}
