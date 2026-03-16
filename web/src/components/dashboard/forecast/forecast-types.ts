/**
 * Types, interfaces và mock data dành cho tab Dự báo trong Dashboard
 */
import { LOS_LABEL as _LOS_LABEL } from "@/lib/app-constants";

// ─────────────────────────── FORECAST SLOT ───────────────────────────

/**
 * Ánh xạ từ 1 row camera_forecasts (sau khi server tính thêm LOS/riskLevel/camName).
 * Các trường có dấu ? là server-computed (không lưu trong DB).
 */
export interface ForecastSlot {
  id: string;
  /** forecast_for_time — ISO datetime có timezone */
  timeSlot: string;
  /** horizon_minutes — 5 | 10 | 15 | 30 | 60 */
  duration: 5 | 10 | 15 | 30 | 60;
  /** camera_id (FIWARE entity id) */
  camId: string;
  /** Tên camera — JOIN từ bảng cameras */
  camName: string;
  predictedVehicles: number;
  actualVehicles: number | null;
  /**
   * error_value / actual_value * 100 (null nếu actual chưa có)
   */
  errorPct: number | null;
  /** input_value — giá trị xe thực tế tại thời điểm predict (baseline) */
  inputValue?: number | null;

  predictedLos: "free_flow" | "smooth" | "moderate" | "heavy" | "congested";
  actualLos: string | null;
  vcPct?: number | null;
  riskLevel: "low" | "medium" | "high";

  deltaVsWeekAvg: number | null;
  confidence: number | null;
  modelVersion?: string;
}

export interface ForecastSummary {
  date: string;
  avgAccuracy: number | null;
  mae: number;
  mape: number;
  r2: number | null;
  totalSlots: number;
  coveredSlots: number;
  networkTrend: "increase" | "stable" | "decrease" | null;
  networkChangePct: number | null;
  highRiskCount: number;
}

/** Dữ liệu cho timeline chart: tổng hợp per-hour toàn mạng */
export interface TimelinePoint {
  hour: string;               // "06:00"
  predicted: number;
  actual: number | null;
  isFuture: boolean;
  vcPct?: number | null;
}

/** Re-export từ @/lib/los-config – single source of truth */
export const LOS_LABEL = _LOS_LABEL;

// ─────────────────────────── MOCK DATA ───────────────────────────

export const MOCK_FORECAST_SLOTS: ForecastSlot[] = [
  {
    id: "662b86c4-5m-2026031307",
    timeSlot: "2026-03-13T07:00:00+07:00", duration: 5,
    camId: "662b86c4673a1c20a7d8e621", camName: "Camera Cầu Sài Gòn - Hướng Q.Bình Thạnh",
    predictedVehicles: 28, inputValue: 26,
    predictedLos: "free_flow", actualVehicles: 27, actualLos: "free_flow",
    errorPct: 3.7, vcPct: 37, riskLevel: "low", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "7f3a19b2-5m-2026031307",
    timeSlot: "2026-03-13T07:00:00+07:00", duration: 5,
    camId: "7f3a19b2408c3e51b9d20f44", camName: "Camera Ngã tư Hàng Xanh - Hướng Bình Thạnh",
    predictedVehicles: 41, inputValue: 38,
    predictedLos: "free_flow", actualVehicles: 44, actualLos: "free_flow",
    errorPct: 6.8, vcPct: 54, riskLevel: "low", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "662b86c4-5m-2026031316",
    timeSlot: "2026-03-13T16:00:00+07:00", duration: 5,
    camId: "662b86c4673a1c20a7d8e621", camName: "Camera Cầu Sài Gòn - Hướng Q.Bình Thạnh",
    predictedVehicles: 68, inputValue: 62,
    predictedLos: "heavy", actualVehicles: 73, actualLos: "heavy",
    errorPct: 6.8, vcPct: 91, riskLevel: "high", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "7f3a19b2-5m-2026031316",
    timeSlot: "2026-03-13T16:00:00+07:00", duration: 5,
    camId: "7f3a19b2408c3e51b9d20f44", camName: "Camera Ngã tư Hàng Xanh - Hướng Bình Thạnh",
    predictedVehicles: 55, inputValue: 51,
    predictedLos: "smooth", actualVehicles: 58, actualLos: "moderate",
    errorPct: 5.2, vcPct: 72, riskLevel: "medium", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "662b86c4-5m-2026031317",
    timeSlot: "2026-03-13T17:00:00+07:00", duration: 5,
    camId: "662b86c4673a1c20a7d8e621", camName: "Camera Cầu Sài Gòn - Hướng Q.Bình Thạnh",
    predictedVehicles: 74, inputValue: 68,
    predictedLos: "heavy", actualVehicles: null, actualLos: null,
    errorPct: null, vcPct: 99, riskLevel: "high", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "7f3a19b2-5m-2026031317",
    timeSlot: "2026-03-13T17:00:00+07:00", duration: 5,
    camId: "7f3a19b2408c3e51b9d20f44", camName: "Camera Ngã tư Hàng Xanh - Hướng Bình Thạnh",
    predictedVehicles: 58, inputValue: 55,
    predictedLos: "moderate", actualVehicles: null, actualLos: null,
    errorPct: null, vcPct: 76, riskLevel: "medium", deltaVsWeekAvg: null, confidence: null,
  },
  {
    id: "662b86c4-5m-2026031318",
    timeSlot: "2026-03-13T18:00:00+07:00", duration: 5,
    camId: "662b86c4673a1c20a7d8e621", camName: "Camera Cầu Sài Gòn - Hướng Q.Bình Thạnh",
    predictedVehicles: 61, inputValue: 68,
    predictedLos: "moderate", actualVehicles: null, actualLos: null,
    errorPct: null, vcPct: 81, riskLevel: "medium", deltaVsWeekAvg: null, confidence: null,
  },
];

export const MOCK_FORECAST_SUMMARY: ForecastSummary = {
  date: "2026-03-13",
  avgAccuracy: 93.5,
  mae: 3.1,
  mape: 6.5,
  r2: 0.921,
  totalSlots: 32,
  coveredSlots: 24,
  networkTrend: "increase",
  networkChangePct: 8,
  highRiskCount: 2,
};

export const MOCK_TIMELINE: TimelinePoint[] = [
  { hour: "06:00", predicted: 42,  actual: 39,  isFuture: false, vcPct: 28 },
  { hour: "07:00", predicted: 71,  actual: 76,  isFuture: false, vcPct: 47 },
  { hour: "08:00", predicted: 88,  actual: 85,  isFuture: false, vcPct: 59 },
  { hour: "09:00", predicted: 79,  actual: 82,  isFuture: false, vcPct: 53 },
  { hour: "10:00", predicted: 63,  actual: 61,  isFuture: false, vcPct: 42 },
  { hour: "11:00", predicted: 58,  actual: 62,  isFuture: false, vcPct: 39 },
  { hour: "12:00", predicted: 69,  actual: 65,  isFuture: false, vcPct: 46 },
  { hour: "13:00", predicted: 61,  actual: 58,  isFuture: false, vcPct: 41 },
  { hour: "14:00", predicted: 57,  actual: 55,  isFuture: false, vcPct: 38 },
  { hour: "15:00", predicted: 68,  actual: 71,  isFuture: false, vcPct: 45 },
  { hour: "16:00", predicted: 95,  actual: 102, isFuture: false, vcPct: 63 },
  { hour: "17:00", predicted: 127, actual: null, isFuture: true,  vcPct: 85 },
  { hour: "18:00", predicted: 108, actual: null, isFuture: true,  vcPct: 72 },
  { hour: "19:00", predicted:  81, actual: null, isFuture: true,  vcPct: 54 },
  { hour: "20:00", predicted:  55, actual: null, isFuture: true,  vcPct: 37 },
  { hour: "21:00", predicted:  38, actual: null, isFuture: true,  vcPct: 25 },
  { hour: "22:00", predicted:  24, actual: null, isFuture: true,  vcPct: 16 },
  { hour: "23:00", predicted:  14, actual: null, isFuture: true,  vcPct:  9 },
];
