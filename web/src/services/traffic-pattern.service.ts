/**
 * Traffic Pattern Service - Lấy dữ liệu phân bố mật độ giao thông (direct query, chu kỳ hiện tại)
 * Tương tác với /api/traffic/patterns, luôn dùng UTC (tz=0) để thống nhất với dữ liệu lưu trữ
 */
import { apiFetch } from "@/lib/apiFetch";
import logger from "@/lib/logger";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatternType = "hour" | "dow" | "week_of_month" | "month";

export interface TrafficPatternPoint {
  label: string;
  avg_vehicles: number;
  max_vehicles: number;
  sample_count: number;
}

export interface TrafficPatternResponse {
  success: boolean;
  type: PatternType;
  camera_id: string;
  time_range?: { from: string; to: string };
  data: TrafficPatternPoint[];
  meta: {
    total_cameras: number;
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Lấy dữ liệu phân bố mật độ giao thông theo chiều thời gian
 * GET /api/traffic/patterns?type=&camera_id=&tz=
 *
 * @param type   - Chiều thời gian: hour | dow | week_of_month | month
 * @param cameraId - Short ID của camera, hoặc "all" để aggregate tất cả
 */
export async function getTrafficPattern(
  type: PatternType,
  cameraId = "all"
): Promise<TrafficPatternResponse> {
  const params = new URLSearchParams({ type, camera_id: cameraId, tz: "0" });

  const response = await apiFetch(
    `${BACKEND_API_URL}/api/traffic/patterns?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(`[traffic-pattern] HTTP ${response.status} for type=${type}`);
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<TrafficPatternResponse>;
}
