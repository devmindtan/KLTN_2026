/**
 * Mock cho traffic-pattern.service.ts — phân bố mật độ giao thông theo các chiều
 * thời gian khác nhau, dùng đường cong tải chung (time-curve.ts) để số liệu nhất
 * quán với camera-engine và forecast.
 */
import type { PatternType, TrafficPatternPoint, TrafficPatternResponse } from "@/services/traffic-pattern.service";
import { CAMERA_SEEDS } from "./cameras";
import { DOW_LOAD, HOURLY_LOAD, MONTH_LOAD, WEEK_OF_MONTH_LOAD } from "../engine/time-curve";
import { jitter, randInt, round1 } from "../engine/utils";

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const DOW_LABELS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const WEEK_LABELS = ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4", "Tuần 5"];
const MONTH_LABELS = Array.from({ length: 12 }, (_, m) => `Tháng ${m + 1}`);

function capacityFor(cameraId: string): number {
  if (cameraId === "all") return CAMERA_SEEDS.reduce((sum, c) => sum + c.capacity, 0);
  return CAMERA_SEEDS.find((c) => c.cam_id === cameraId)?.capacity ?? 150;
}

function buildPoints(labels: string[], curve: number[], capacity: number): TrafficPatternPoint[] {
  return labels.map((label, i) => {
    const factor = curve[i % curve.length];
    const avg = capacity * factor * jitter(1, 0.1);
    return {
      label,
      avg_vehicles: Math.round(Math.max(0, avg)),
      max_vehicles: Math.round(Math.max(0, avg * jitter(1.45, 0.2))),
      sample_count: randInt(50, 800),
    };
  });
}

export function buildTrafficPattern(type: PatternType, cameraId: string): TrafficPatternResponse {
  const capacity = capacityFor(cameraId);
  let data: TrafficPatternPoint[];

  switch (type) {
    case "hour":
      data = buildPoints(HOUR_LABELS, HOURLY_LOAD, capacity);
      break;
    case "dow":
      data = buildPoints(DOW_LABELS, DOW_LOAD, capacity);
      break;
    case "week_of_month":
      data = buildPoints(WEEK_LABELS, WEEK_OF_MONTH_LOAD, capacity);
      break;
    case "month":
      data = buildPoints(MONTH_LABELS, MONTH_LOAD, capacity);
      break;
    default:
      data = [];
  }

  return {
    success: true,
    type,
    camera_id: cameraId,
    data: data.map((d) => ({ ...d, avg_vehicles: round1(d.avg_vehicles) })),
    meta: { total_cameras: cameraId === "all" ? CAMERA_SEEDS.length : 1 },
  };
}
