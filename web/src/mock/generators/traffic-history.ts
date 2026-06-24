/**
 * Mock cho traffic-history.service.ts — lưu lượng theo từng slot 5 phút trong ngày
 * VN cụ thể (03:00-23:55), dùng để so sánh nhiều ngày trên cùng trục giờ.
 */
import type { TrafficHistoryResponse, TrafficHistorySlot } from "@/services/traffic-history.service";
import { CAMERA_SEEDS } from "./cameras";
import { combinedLoadFactor, minuteToLabel, vnNow } from "../engine/time-curve";
import { clamp, jitter, randInt } from "../engine/utils";

const START = 3 * 60; // 03:00
const END = 23 * 60 + 55; // 23:55
const STEP = 5;

function capacityFor(cameraId: string): number {
  if (cameraId === "all") return CAMERA_SEEDS.reduce((sum, c) => sum + c.capacity, 0);
  return CAMERA_SEEDS.find((c) => c.cam_id === cameraId)?.capacity ?? 150;
}

function loadFactorForDateMinute(dateStr: string, minuteOfDay: number): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  dt.setUTCMinutes(minuteOfDay);
  return combinedLoadFactor(dt);
}

export function buildTrafficHistory(date: string, cameraId: string): TrafficHistoryResponse {
  const capacity = capacityFor(cameraId);
  const today = vnNow().toISOString().slice(0, 10);
  const isToday = date === today;
  const todayMinuteNow = vnNow().getUTCHours() * 60 + vnNow().getUTCMinutes();

  const data: TrafficHistorySlot[] = [];
  for (let m = START; m <= END; m += STEP) {
    const factor = loadFactorForDateMinute(date, m);
    const trueVal = clamp(capacity * factor, 0, capacity * 1.3);
    const isFuture = isToday && m > todayMinuteNow;

    data.push({
      minuteOfDay: m,
      label: minuteToLabel(m),
      actual: isFuture ? null : Math.round(trueVal * jitter(1, 0.12)),
      forecast: Math.round(clamp(trueVal * jitter(1, 0.18), 0, capacity * 1.35)),
      sample_count: isFuture ? 0 : randInt(20, 200),
    });
  }

  return { success: true, date, camera_id: cameraId, data };
}
