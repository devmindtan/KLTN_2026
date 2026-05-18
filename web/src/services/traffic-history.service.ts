/**
 * Traffic History Service - Lấy dữ liệu lưu lượng giao thông theo ngày cụ thể (VN timezone)
 * Dùng để vẽ biểu đồ lịch sử kiểu stock-chart: so sánh nhiều ngày trên cùng trục giờ
 */
import { apiFetch } from "@/lib/apiFetch";
import logger from "@/lib/logger";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Một slot 5 phút (03:00–23:55) trong ngày với dữ liệu thực đo + dự báo */
export interface TrafficHistorySlot {
  /** Phút trong ngày VN (180–1435, bước 5) */
  minuteOfDay: number;
  /** Nhãn hiển thị "HH:MM" */
  label: string;
  /** Trung bình số xe thực đo (camera_detections) — null nếu không có data */
  actual: number | null;
  /** Trung bình số xe dự báo horizon-5m (camera_forecasts) — null nếu không có */
  forecast: number | null;
  sample_count: number;
}

export interface TrafficHistoryResponse {
  success: boolean;
  /** Ngày VN "YYYY-MM-DD" */
  date: string;
  camera_id: string;
  data: TrafficHistorySlot[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Phút trong ngày (0–1439) → nhãn "HH:MM" */
export function minuteToLabel(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Tính minute-of-day hiện tại theo VN timezone (UTC+7), làm tròn xuống 5 phút.
 * Dùng cho ReferenceLine "Hiện tại" trên chart.
 */
export function getCurrentVnMinute(): number {
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
  const raw = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
  return Math.floor(raw / 5) * 5;
}

/**
 * Tính ngày VN (UTC+7) theo offset tính từ hôm nay.
 * offset=0 → hôm nay, offset=-1 → hôm qua, offset=-7 → 7 ngày trước
 */
export function vnDateOffset(offset: number): string {
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
  vnNow.setUTCDate(vnNow.getUTCDate() + offset);
  return `${vnNow.getUTCFullYear()}-${String(vnNow.getUTCMonth() + 1).padStart(2, "0")}-${String(vnNow.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Chuyển chuỗi "YYYY-MM-DD" sang nhãn hiển thị tiếng Việt tương đối so với hôm nay.
 * Ví dụ: hôm nay → "Hôm nay", -1 → "Hôm qua", -7 → "7 ngày trước"
 */
export function dateToRelativeLabel(date: string): string {
  const today = vnDateOffset(0);
  const yesterday = vnDateOffset(-1);
  if (date === today) return "Hôm nay";
  if (date === yesterday) return "Hôm qua";

  // tính số ngày chênh lệch
  const a = new Date(date + "T00:00:00Z");
  const b = new Date(today + "T00:00:00Z");
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diffDays > 0 && diffDays <= 30) return `${diffDays} ngày trước`;

  // fallback: DD/MM
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Predefined comparison series ─────────────────────────────────────────────

/** Danh sách các series mặc định: hôm nay, hôm qua, 7 ngày trước, 14 ngày trước */
export const DEFAULT_HISTORY_SERIES = [
  { key: "today",      offset: 0,   label: "Hôm nay",       color: "hsl(var(--chart-1))" },
  { key: "yesterday",  offset: -1,  label: "Hôm qua",       color: "hsl(var(--chart-2))" },
  { key: "week1",      offset: -7,  label: "7 ngày trước",  color: "hsl(var(--chart-3))" },
  { key: "week2",      offset: -14, label: "14 ngày trước", color: "hsl(var(--chart-4))" },
] as const;

export type SeriesKey = (typeof DEFAULT_HISTORY_SERIES)[number]["key"];

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Lấy dữ liệu lưu lượng giao thông theo giờ cho một ngày VN cụ thể
 * GET /api/traffic/history?date=YYYY-MM-DD&camera_id=all
 */
export async function getTrafficHistory(
  date: string,
  cameraId = "all"
): Promise<TrafficHistoryResponse> {
  const params = new URLSearchParams({ date, camera_id: cameraId });

  const response = await apiFetch(
    `${BACKEND_API_URL}/api/traffic/history?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(`[traffic-history] HTTP ${response.status} date=${date}`);
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<TrafficHistoryResponse>;
}
