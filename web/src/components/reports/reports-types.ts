/**
 * Types, interfaces và mock data chỉ dành cho trang Báo cáo (reports)
 */

// ─────────────────────────── BÁO CÁO ───────────────────────────

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

// ─────────────────────────── LỊCH SỬ THAO TÁC ───────────────────────────

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
