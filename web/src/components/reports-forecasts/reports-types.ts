/**
 * Types, interfaces và mock data cho trang Reports & Forecasts
 * Không export JSX – tránh fast-refresh warning
 */

// ─────────────────────────── REPORTS ───────────────────────────

export interface ReportData {
  id: string;
  title: string;
  type: "daily" | "weekly" | "monthly" | "incident";
  dateRange: { from: string; to: string };
  createdAt: string;
  status: "ready" | "processing" | "failed";
  fileSizeKB: number;
  downloadUrl?: string;
  metrics: {
    totalVehicles: number;
    peakHour: string;
    avgDensity: number;
    incidentCount: number;
    camerasIncluded: number;
  };
}

export const REPORT_TYPE_LABEL: Record<ReportData["type"], string> = {
  daily:    "Ngày",
  weekly:   "Tuần",
  monthly:  "Tháng",
  incident: "Sự cố",
};

export const MOCK_REPORTS: ReportData[] = [
  {
    id: "rpt-001",
    title: "Báo cáo lưu lượng ngày 17/05/2025",
    type: "daily",
    dateRange: { from: "2025-05-17", to: "2025-05-17" },
    createdAt: "2025-05-18T06:00:00Z",
    status: "ready",
    fileSizeKB: 284,
    downloadUrl: "/reports/rpt-001.pdf",
    metrics: { totalVehicles: 48320, peakHour: "17:00–18:00", avgDensity: 2013, incidentCount: 2, camerasIncluded: 5 },
  },
  {
    id: "rpt-002",
    title: "Báo cáo lưu lượng tuần 19–25/05/2025",
    type: "weekly",
    dateRange: { from: "2025-05-19", to: "2025-05-25" },
    createdAt: "2025-05-25T22:00:00Z",
    status: "ready",
    fileSizeKB: 1120,
    downloadUrl: "/reports/rpt-002.pdf",
    metrics: { totalVehicles: 312000, peakHour: "Thứ Hai 17:30–18:30", avgDensity: 1857, incidentCount: 8, camerasIncluded: 5 },
  },
  {
    id: "rpt-003",
    title: "Báo cáo tháng 4/2025",
    type: "monthly",
    dateRange: { from: "2025-04-01", to: "2025-04-30" },
    createdAt: "2025-05-01T08:00:00Z",
    status: "ready",
    fileSizeKB: 3840,
    downloadUrl: "/reports/rpt-003.pdf",
    metrics: { totalVehicles: 1430000, peakHour: "Thứ Sáu 17:00–18:00", avgDensity: 1986, incidentCount: 31, camerasIncluded: 5 },
  },
  {
    id: "rpt-004",
    title: "Sự cố ùn tắc – Cầu Sài Gòn 14/05",
    type: "incident",
    dateRange: { from: "2025-05-14T07:15:00Z", to: "2025-05-14T09:45:00Z" },
    createdAt: "2025-05-14T10:00:00Z",
    status: "ready",
    fileSizeKB: 512,
    downloadUrl: "/reports/rpt-004.pdf",
    metrics: { totalVehicles: 4200, peakHour: "07:15–09:45", avgDensity: 1680, incidentCount: 1, camerasIncluded: 1 },
  },
  {
    id: "rpt-005",
    title: "Báo cáo lưu lượng ngày 18/05/2025",
    type: "daily",
    dateRange: { from: "2025-05-18", to: "2025-05-18" },
    createdAt: "2025-05-18T23:55:00Z",
    status: "processing",
    fileSizeKB: 0,
    metrics: { totalVehicles: 0, peakHour: "—", avgDensity: 0, incidentCount: 0, camerasIncluded: 5 },
  },
];

// ─────────────────────────── FORECASTS ───────────────────────────

export interface ForecastSlot {
  id: string;
  timeSlot: string;             // ISO datetime
  duration: 30 | 60;
  camId: string;
  camName: string;
  predictedVehicles: number;
  predictedLos: "free_flow" | "smooth" | "moderate" | "heavy" | "congested";
  confidence: number;           // 0–100
  modelVersion: string;
  actualVehicles: number | null;
  actualLos: string | null;
  errorPct: number | null;
  deltaVsWeekAvg: number | null;
  riskLevel: "low" | "medium" | "high";
}

export interface ForecastSummary {
  date: string;
  avgAccuracy: number;
  mae: number;
  mape: number;
  r2: number;
  totalSlots: number;
  coveredSlots: number;
  networkTrend: "increase" | "stable" | "decrease";
  networkChangePct: number;
  highRiskCount: number;
}

/** Dữ liệu cho timeline chart: tổng hợp per-hour toàn mạng */
export interface TimelinePoint {
  hour: string;         // "06:00"
  predicted: number;
  actual: number | null;
  isFuture: boolean;
}

export const LOS_LABEL: Record<string, string> = {
  free_flow: "Thông thoáng",
  smooth:    "Bình thường",
  moderate:  "Trung bình",
  heavy:     "Nặng",
  congested: "Ùn tắc",
};

export const MOCK_FORECAST_SLOTS: ForecastSlot[] = [
  {
    id: "fs-001", timeSlot: "2025-05-18T09:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 210, predictedLos: "moderate", confidence: 88, modelVersion: "LSTM_v2.3",
    actualVehicles: 203, actualLos: "smooth", errorPct: 3.3, deltaVsWeekAvg: 5, riskLevel: "low",
  },
  {
    id: "fs-002", timeSlot: "2025-05-18T10:00:00+07:00", duration: 60,
    camId: "cam-02", camName: "Ngã tư Đinh Tiên Hoàng",
    predictedVehicles: 185, predictedLos: "smooth", confidence: 90, modelVersion: "LSTM_v2.3",
    actualVehicles: 190, actualLos: "smooth", errorPct: 2.7, deltaVsWeekAvg: 2, riskLevel: "low",
  },
  {
    id: "fs-003", timeSlot: "2025-05-18T16:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 390, predictedLos: "heavy", confidence: 85, modelVersion: "LSTM_v2.3",
    actualVehicles: 412, actualLos: "congested", errorPct: 5.6, deltaVsWeekAvg: 18, riskLevel: "medium",
  },
  {
    id: "fs-004", timeSlot: "2025-05-18T16:00:00+07:00", duration: 60,
    camId: "cam-02", camName: "Ngã tư Đinh Tiên Hoàng",
    predictedVehicles: 260, predictedLos: "moderate", confidence: 82, modelVersion: "LSTM_v2.3",
    actualVehicles: 271, actualLos: "heavy", errorPct: 4.2, deltaVsWeekAvg: 12, riskLevel: "medium",
  },
  {
    id: "fs-005", timeSlot: "2025-05-18T17:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 480, predictedLos: "congested", confidence: 91, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null, errorPct: null, deltaVsWeekAvg: 23, riskLevel: "high",
  },
  {
    id: "fs-006", timeSlot: "2025-05-18T17:00:00+07:00", duration: 60,
    camId: "cam-02", camName: "Ngã tư Đinh Tiên Hoàng",
    predictedVehicles: 310, predictedLos: "heavy", confidence: 87, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null, errorPct: null, deltaVsWeekAvg: 15, riskLevel: "high",
  },
  {
    id: "fs-007", timeSlot: "2025-05-18T18:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 395, predictedLos: "heavy", confidence: 83, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null, errorPct: null, deltaVsWeekAvg: 10, riskLevel: "medium",
  },
  {
    id: "fs-008", timeSlot: "2025-05-18T19:00:00+07:00", duration: 60,
    camId: "cam-01", camName: "Cầu Sài Gòn",
    predictedVehicles: 290, predictedLos: "moderate", confidence: 80, modelVersion: "LSTM_v2.3",
    actualVehicles: null, actualLos: null, errorPct: null, deltaVsWeekAvg: 4, riskLevel: "low",
  },
];

export const MOCK_FORECAST_SUMMARY: ForecastSummary = {
  date: "2025-05-18",
  avgAccuracy: 94.2,
  mae: 8.3,
  mape: 4.2,
  r2: 0.934,
  totalSlots: 48,
  coveredSlots: 36,
  networkTrend: "increase",
  networkChangePct: 12,
  highRiskCount: 2,
};

export const MOCK_TIMELINE: TimelinePoint[] = [
  { hour: "06:00", predicted: 320,  actual: 305,  isFuture: false },
  { hour: "07:00", predicted: 510,  actual: 523,  isFuture: false },
  { hour: "08:00", predicted: 640,  actual: 618,  isFuture: false },
  { hour: "09:00", predicted: 580,  actual: 595,  isFuture: false },
  { hour: "10:00", predicted: 490,  actual: 480,  isFuture: false },
  { hour: "11:00", predicted: 450,  actual: 460,  isFuture: false },
  { hour: "12:00", predicted: 530,  actual: 510,  isFuture: false },
  { hour: "13:00", predicted: 480,  actual: 492,  isFuture: false },
  { hour: "14:00", predicted: 460,  actual: 448,  isFuture: false },
  { hour: "15:00", predicted: 520,  actual: 535,  isFuture: false },
  { hour: "16:00", predicted: 720,  actual: 745,  isFuture: false },
  { hour: "17:00", predicted: 890,  actual: null, isFuture: true },
  { hour: "18:00", predicted: 760,  actual: null, isFuture: true },
  { hour: "19:00", predicted: 580,  actual: null, isFuture: true },
  { hour: "20:00", predicted: 420,  actual: null, isFuture: true },
  { hour: "21:00", predicted: 310,  actual: null, isFuture: true },
  { hour: "22:00", predicted: 210,  actual: null, isFuture: true },
  { hour: "23:00", predicted: 140,  actual: null, isFuture: true },
];

// ─────────────────────────── HISTORY ───────────────────────────

export interface HistoryEntry {
  id: string;
  action: "generate" | "download" | "delete";
  reportId: string;
  reportTitle: string;
  performedAt: string;
  performedBy: string;
  detail?: string;
}

export const MOCK_HISTORY: HistoryEntry[] = [
  { id: "h-001", action: "download", reportId: "rpt-001", reportTitle: "Báo cáo lưu lượng ngày 17/05/2025", performedAt: "2025-05-18T08:32:00Z", performedBy: "admin" },
  { id: "h-002", action: "generate", reportId: "rpt-002", reportTitle: "Báo cáo tuần 19–25/05/2025",        performedAt: "2025-05-25T22:01:00Z", performedBy: "system" },
  { id: "h-003", action: "download", reportId: "rpt-002", reportTitle: "Báo cáo tuần 19–25/05/2025",        performedAt: "2025-05-26T07:15:00Z", performedBy: "admin" },
  { id: "h-004", action: "generate", reportId: "rpt-003", reportTitle: "Báo cáo tháng 4/2025",              performedAt: "2025-05-01T08:00:00Z", performedBy: "system" },
  { id: "h-005", action: "delete",   reportId: "rpt-000", reportTitle: "Báo cáo cũ 01/2025",                performedAt: "2025-05-26T09:14:00Z", performedBy: "admin" },
  { id: "h-006", action: "generate", reportId: "rpt-004", reportTitle: "Sự cố ùn tắc – Cầu Sài Gòn 14/05", performedAt: "2025-05-14T10:00:00Z", performedBy: "system" },
];
