/**
 * Forecast Service - Lấy dữ liệu dự báo lưu lượng giao thông từ bảng camera_forecasts
 * Cung cấp 3 endpoint: tổng hợp độ chính xác, chuỗi thời gian, và chi tiết slot per-camera
 */
import { apiFetch } from "@/lib/apiFetch";
import logger from "@/lib/logger";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastSummaryResponse {
  date: string;
  /** Null khi chưa có actual_value nào để tính */
  avgAccuracy: number | null;
  mae: number;
  mape: number;
  r2: number | null;
  totalSlots: number;
  coveredSlots: number;
  highRiskCount: number;
  networkTrend: "increase" | "decrease" | "stable" | null;
  networkChangePct: number | null;
}

export interface ForecastTimelinePoint {
  hour: number;
  predicted: number | null;
  actual: number | null;
  vcPct: number | null;
}

export interface ForecastTimelineResponse {
  success: boolean;
  date: string;
  camId: string;
  data: ForecastTimelinePoint[];
}

export type LosLevel = "free_flow" | "smooth" | "moderate" | "heavy" | "congested";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type HorizonMinutes = 5 | 10 | 15 | 30 | 60;

export interface ForecastSlotItem {
  id: string;
  timeSlot: string;
  duration: HorizonMinutes;
  camId: string;
  camName: string;
  predictedVehicles: number;
  actualVehicles: number | null;
  errorPct: number | null;
  inputValue: number | null;
  predictedLos: LosLevel;
  actualLos: LosLevel | null;
  vcPct: number | null;
  riskLevel: RiskLevel;
  deltaVsWeekAvg: number | null;
  confidence: number | null;
  modelVersion?: string;
}

export interface ForecastSlotsResponse {
  success: boolean;
  total: number;
  data: ForecastSlotItem[];
}

export interface ForecastRollingSlot {
  t: string;
  actual: number | null;
  actualRef: number | null;
  currentRatio: number | null;
  /** true nếu slot này ở tương lai (t >= nowTime từ server) */
  isFuture: boolean;
  /** Mức dịch vụ LOS: A–F hoặc "—" khi chưa có V/C */
  los: string;
  /** Nhãn LOS tiếng Việt: "Thông thoáng" … "Tắc nghẽn" */
  losLabel: string;
  f5m: number | null;
  f10m: number | null;
  f15m: number | null;
  f30m: number | null;
  f60m: number | null;
}

/** Dữ liệu forecast của một camera bao gồm capacity và slot array */
export interface CameraForecast {
  /** Capacity camera (xe/5min) — đã tích hợp vào đây thay vì tách ra `capacities` map */
  capacity: number;
  slots: ForecastRollingSlot[];
}

export interface ForecastRollingResponse {
  success: boolean;
  metadata: {
    nowIndex: number;
    totalSlots: number;
    /** Thời gian hiện tại HH:MM theo giờ HCM (server-side) */
    nowTime: string;
    /** ISO timestamp khi API response được tạo */
    generatedAt: string;
    timeRange: { start: string; end: string };
    description: string;
  };
  /** backward-compat: capacity từng camera (xem cameras[id].capacity để dùng cùng nguồn) */
  capacities: Record<string, number>;
  cameras: Record<string, CameraForecast>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Lấy tổng hợp độ chính xác dự báo trong ngày (MAE, MAPE, R², coverage, highRiskCount)
 * GET /api/forecast/summary?date=YYYY-MM-DD
 */
export async function getForecastSummary(
  date: string
): Promise<ForecastSummaryResponse> {
  const params = new URLSearchParams({ date });
  const response = await apiFetch(
    `${BACKEND_API_URL}/api/forecast/summary?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(`[forecast] summary HTTP ${response.status} for date=${date}`);
    throw new Error(`HTTP ${response.status}`);
  }

  // Controller trả { success: true, data: { ... } } — unwrap data
  const json = await response.json();
  return json.data as ForecastSummaryResponse;
}

/**
 * Lấy chuỗi thời gian predicted vs actual theo từng giờ trong ngày
 * GET /api/forecast/timeline?date=YYYY-MM-DD&camId=all
 *
 * @param date  - Ngày cần lấy (YYYY-MM-DD)
 * @param camId - Camera ID cụ thể hoặc "all" để tổng hợp toàn mạng
 */
export async function getForecastTimeline(
  date: string,
  camId = "all"
): Promise<ForecastTimelineResponse> {
  const params = new URLSearchParams({ date, camId });
  const response = await apiFetch(
    `${BACKEND_API_URL}/api/forecast/timeline?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(`[forecast] timeline HTTP ${response.status} for date=${date} camId=${camId}`);
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Lấy danh sách slot dự báo per-camera với LOS và mức rủi ro
 * GET /api/forecast/slots?date=YYYY-MM-DD&horizon=5&limit=200
 *
 * @param date    - Ngày cần lấy slot
 * @param horizon - Horizon dự báo (phút): 5 | 10 | 15 | 30 | 60
 * @param limit   - Số slot tối đa trả về (default 200)
 */
export async function getForecastSlots(
  date: string,
  horizon: HorizonMinutes = 5,
  limit = 200
): Promise<ForecastSlotsResponse> {
  const params = new URLSearchParams({
    date,
    horizon: String(horizon),
    limit: String(limit),
  });
  const response = await apiFetch(
    `${BACKEND_API_URL}/api/forecast/slots?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(`[forecast] slots HTTP ${response.status} for date=${date} horizon=${horizon}`);
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Lấy dữ liệu rolling forecast cho Dashboard (ngày hiện tại, 5 horizons)
 * GET /api/forecast/rolling?cameraId=all
 *
 * @param cameraId - Camera ID cụ thể hoặc "all" để tổng hợp toàn mạng
 */
export async function getForecastRolling(
  cameraId = "all"
): Promise<ForecastRollingResponse> {
  const params = new URLSearchParams({ cameraId });
  const response = await apiFetch(
    `${BACKEND_API_URL}/api/forecast/rolling?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    logger.error(
      `[forecast] rolling HTTP ${response.status} for cameraId=${cameraId}`
    );
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
