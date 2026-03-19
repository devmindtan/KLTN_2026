/**
 * Reports Legacy Types & Mock Data | Updated 22/12/24
 * @deprecated - Use services/reports.service.ts for new Smart Reports
 */

// ══════════════ LỊCH SỬ ONLY ══════════════

export interface HistoryEntry {
  id: string;
  timestamp: string;  
  user: string;
  action: string;
  target: string;
  details: string;
  status: "success" | "warning" | "error";
  ip?: string;
}

export const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: "h001",
    timestamp: "2024-12-21T14:30:15Z",
    user: "adminuser", 
    action: "Tạo báo cáo",
    target: "Báo cáo lưu lượng ngày 21/12/2024",
    details: "Báo cáo hàng ngày cho camera C001-C005",
    status: "success",
    ip: "192.168.1.150"
  },
  {
    id: "h002",
    timestamp: "2024-12-21T12:15:30Z",
    user: "operator",
    action: "Xóa báo cáo", 
    target: "Báo cáo tuần 09-15/12/2024",
    details: "Xóa do dữ liệu không chính xác",
    status: "warning",
    ip: "192.168.1.142"
  },
  {
    id: "h003",
    timestamp: "2024-12-21T09:45:22Z",
    user: "adminuser",
    action: "Download",
    target: "Báo cáo tháng 11/2024.pdf", 
    details: "Export PDF executive summary",
    status: "success",
    ip: "192.168.1.150"
  },
  {
    id: "h004",
    timestamp: "2024-12-21T08:20:10Z",
    user: "analyst",
    action: "Tạo báo cáo",
    target: "Báo cáo sự cố ùn tắc",
    details: "Phân tích sự cố giao lộ Nguyễn Huệ x Lê Lợi", 
    status: "error",
    ip: "192.168.1.135"
  },
  {
    id: "h005",
    timestamp: "2024-12-20T17:30:00Z",
    user: "operator",
    action: "Download",
    target: "Weekly_Traffic_Analysis.xlsx",
    details: "Export raw data cho machine learning",
    status: "success",
    ip: "192.168.1.142"
  }
];

// ══════════════ LEGACY TYPES ══════════════

/** @deprecated Use SmartReport from services */
export interface ReportData {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly" | "incident";
  period: { from: string; to: string; };
  status: "ready" | "processing" | "failed";
  createdAt: string;
  fileSize: number; 
  downloadUrl?: string;
  description?: string;
  author: string;
}

/** @deprecated Legacy type labels */
export const REPORT_TYPE_LABEL = {
  daily: "Hàng ngày",
  weekly: "Hàng tuần", 
  monthly: "Hàng tháng",
  incident: "Sự cố"
} as const;

/** @deprecated Mock data for legacy components */
export const MOCK_REPORTS: ReportData[] = [];