/**
 * Smart Reports API Service - API calls for reports management
 */
import { apiFetch } from "@/lib/apiFetch";
import type { HistoryEntry } from "@/components/reports/reports-types";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

export interface SmartReport {
  id: string;
  title: string;
  type: "daily" | "weekly" | "monthly" | "quarterly" | "custom" | "incident";
  period_from: string;
  period_to: string;
  status: "pending" | "generating" | "ready" | "failed";
  files_json: {
    pdf?: { path: string; sizeMB: number; url: string; };
    xlsx?: { path: string; sizeMB: number; url: string; };
  } | null;
  summary_json: AnalyzedSummary | null;
  settings_json: ReportSettings | null;
  created_by: string | null;
  created_at: string;
  generated_at: string | null;
  error_message: string | null;
}

export interface AnalyzedSummary {
  overview: {
    totalVehicles: number;
    avgDensityScore: number;
    peakHours: { hour: string; volume: number; severity: "low"|"medium"|"high" }[];
    incidentCount: number;
    weatherImpact: "none" | "low" | "medium" | "high";
  };
  performance: {
    modelAccuracy: number;
    predictionConfidence: number;
    dataQuality: "poor" | "fair" | "good" | "excellent";
    coveragePercentage: number;
  };
  insights: {
    trends: string[];
    anomalies: string[];
    recommendations: string[];
  };
  camerasAnalysis: {
    cameraId: string;
    name: string;
    totalVehicles: number;
    avgVehiclePerHour: number;
    peakDensity: number;
    incidentCount: number;
    reliability: number;
    riskLevel: "low" | "medium" | "high";
  }[];
}

export interface ReportSettings {
  includeCharts?: boolean;
  includeRawData?: boolean;
  emailNotifications?: boolean;
  /** Giờ bắt đầu lọc dữ liệu (0-23). null = lấy tất cả giờ */
  hour_from?: number | null;
  /** Giờ kết thúc lọc dữ liệu (1-24). null = lấy tất cả giờ */
  hour_to?: number | null;
  [key: string]: unknown;
}

export interface CreateReportRequest {
  title: string;
  type: SmartReport["type"];
  period_from: string;
  period_to: string;
  settings?: ReportSettings;
}

export interface ReportsListResponse {
  success: boolean;
  data: SmartReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Lấy danh sách báo cáo với pagination và filters
 */
export async function getReports(params: {
  page?: number;
  limit?: number;
  type?: SmartReport["type"];
  status?: SmartReport["status"];
  search?: string;
} = {}): Promise<ReportsListResponse> {
  const query = new URLSearchParams();
  
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.type) query.append("type", params.type);
  if (params.status) query.append("status", params.status);
  if (params.search) query.append("search", params.search);
  
  const res = await apiFetch(`${BACKEND_API_URL}/api/reports?${query.toString()}`);
  if (!res.ok) throw new Error("Lỗi khi lấy danh sách báo cáo");
  
  return res.json();
}

/**
 * Lấy chi tiết báo cáo theo ID
 */
export async function getReportById(id: string): Promise<{ success: boolean; data: SmartReport }> {
  const res = await apiFetch(`${BACKEND_API_URL}/api/reports/${id}`);
  if (!res.ok) throw new Error("Lỗi khi lấy chi tiết báo cáo");
  
  return res.json();
}

/**
 * Tạo báo cáo mới (async)
 */
export async function createReport(request: CreateReportRequest): Promise<{ success: boolean; data: { id: string; status: "pending"; message: string } }> {
  const res = await apiFetch(`${BACKEND_API_URL}/api/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Lỗi khi tạo báo cáo");
  }
  
  return res.json();
}

/**
 * Xóa báo cáo
 */
export async function deleteReport(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`${BACKEND_API_URL}/api/reports/${id}`, {
    method: "DELETE"
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Lỗi khi xóa báo cáo");
  }
  
  return res.json();
}

/**
 * URL tải 1 file báo cáo (PDF hoặc XLSX)
 */
export function getDownloadUrl(id: string, format: "pdf" | "xlsx"): string {
  return `${BACKEND_API_URL}/api/reports/${id}/download/${format}`;
}

/**
 * URL tải cả 2 file (PDF + XLSX) nén thành .zip
 */
export function getDownloadBothUrl(id: string): string {
  return `${BACKEND_API_URL}/api/reports/${id}/download/both`;
}

/**
 * Lấy lịch sử hoạt động báo cáo (audit logs)
 */
export async function getReportHistory(params?: {
  limit?: number;
  offset?: number;
  action?: string;
}): Promise<{ success: boolean; data: HistoryEntry[]; pagination: { limit: number; offset: number; total: number } }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.offset) searchParams.append("offset", params.offset.toString());
  if (params?.action) searchParams.append("action", params.action);

  const url = `${BACKEND_API_URL}/api/reports/history${searchParams.toString() ? `?${searchParams}` : ""}`;
  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch report history: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Poll report status - check trạng thái báo cáo định kỳ
 */
export async function pollReportStatus(
  id: string, 
  onStatusChange: (report: SmartReport) => void,
  intervalMs: number = 2000
): Promise<() => void> {
  let isPolling = true;
  
  async function poll() {
    if (!isPolling) return;
    
    try {
      const result = await getReportById(id);
      onStatusChange(result.data);
      
      // Dừng poll nếu status final
      if (["ready", "failed"].includes(result.data.status)) {
        isPolling = false;
        return;
      }
      
      // Continue polling
      setTimeout(poll, intervalMs);
      
    } catch (error) {
      console.error("Poll error:", error);
      setTimeout(poll, intervalMs * 2); // Backoff on error
    }
  }
  
  // Start polling
  poll();
  
  // Return cleanup function
  return () => {
    isPolling = false;
  };
}