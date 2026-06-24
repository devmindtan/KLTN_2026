/**
 * Mock cho reports.service.ts — Báo cáo thông minh: danh sách, tạo mới (mô phỏng
 * pending → generating → ready bất đồng bộ giống hệ thống thật, được poll qua
 * pollReportStatus), lịch sử thao tác và nội dung phân tích (AnalyzedSummary).
 */
import type { AnalyzedSummary, SmartReport } from "@/services/reports.service";
import type { HistoryEntry } from "@/components/reports/reports-types";
import { CAMERA_SEEDS } from "./cameras";
import { getOrSeed, setCollection } from "../engine/store";
import { genId, randInt, round1 } from "../engine/utils";

const REPORTS_KEY = "reports";
const HISTORY_KEY = "reports_history";

const TYPES: SmartReport["type"][] = ["daily", "weekly", "monthly", "quarterly", "custom", "incident"];
const TITLES: Record<SmartReport["type"], string> = {
  daily: "Báo cáo lưu lượng hàng ngày",
  weekly: "Báo cáo lưu lượng hàng tuần",
  monthly: "Báo cáo tổng hợp hàng tháng",
  quarterly: "Báo cáo quý",
  custom: "Báo cáo tuỳ chỉnh",
  incident: "Báo cáo sự cố ùn tắc",
};

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

function buildSummary(periodFrom: string, periodTo: string): AnalyzedSummary {
  const cams = CAMERA_SEEDS;
  const peakHours = [7, 8, 17, 18].map((h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    volume: randInt(800, 2200),
    severity: (h === 8 || h === 18 ? "high" : "medium") as "low" | "medium" | "high",
  }));
  return {
    overview: {
      totalVehicles: randInt(800_000, 3_500_000),
      avgDensityScore: round1(randInt(40, 78)),
      peakHours,
      incidentCount: randInt(0, 12),
      weatherImpact: (["none", "low", "medium", "high"] as const)[randInt(0, 3)],
    },
    performance: {
      modelAccuracy: round1(82 + Math.random() * 12),
      predictionConfidence: round1(70 + Math.random() * 20),
      dataQuality: (["good", "excellent", "fair"] as const)[randInt(0, 2)],
      coveragePercentage: round1(85 + Math.random() * 13),
    },
    insights: {
      trends: [
        `Lưu lượng trung bình giai đoạn ${periodFrom} - ${periodTo} tăng nhẹ so với kỳ trước`,
        "Khung giờ cao điểm chiều có xu hướng kéo dài thêm 15-20 phút",
      ],
      anomalies: randInt(0, 1) === 1 ? ["Phát hiện tăng đột biến bất thường tại 1 camera vào cuối tuần"] : [],
      recommendations: [
        "Cân nhắc điều chỉnh chu kỳ đèn tín hiệu tại các giao lộ có mật độ cao",
        "Theo dõi sát các camera có độ tin cậy dưới 80% trong kỳ báo cáo tiếp theo",
      ],
    },
    camerasAnalysis: cams.slice(0, 8).map((c) => {
      const total = randInt(20_000, 120_000);
      const reliability = round1(75 + Math.random() * 23);
      return {
        cameraId: c.cam_id,
        name: c.display_name,
        totalVehicles: total,
        avgVehiclePerHour: Math.round(total / 24),
        peakDensity: round1(60 + Math.random() * 38),
        incidentCount: randInt(0, 4),
        reliability,
        riskLevel: (reliability > 90 ? "low" : reliability > 78 ? "medium" : "high") as "low" | "medium" | "high",
      };
    }),
  };
}

function seedReports(): SmartReport[] {
  const reports: SmartReport[] = [];
  for (let i = 0; i < 10; i++) {
    const type = TYPES[i % TYPES.length];
    const createdAt = isoDaysAgo(i * 2 + 1);
    const periodFrom = new Date(Date.now() - (i * 2 + 8) * 86_400_000).toISOString().slice(0, 10);
    const periodTo = new Date(Date.now() - (i * 2 + 1) * 86_400_000).toISOString().slice(0, 10);
    reports.push({
      id: genId("rpt"),
      title: `${TITLES[type]} ${periodTo}`,
      type,
      period_from: periodFrom,
      period_to: periodTo,
      status: "ready",
      files_json: {
        pdf: { path: `reports/${periodTo}.pdf`, sizeMB: round1(0.5 + Math.random() * 4), url: "" },
        xlsx: { path: `reports/${periodTo}.xlsx`, sizeMB: round1(0.3 + Math.random() * 2), url: "" },
      },
      summary_json: buildSummary(periodFrom, periodTo),
      settings_json: { includeCharts: true, includeRawData: i % 2 === 0, emailNotifications: false, hour_from: null, hour_to: null },
      created_by: "ky-thuat-vien",
      created_at: createdAt,
      generated_at: createdAt,
      error_message: null,
    });
  }
  return reports;
}

function seedHistory(): HistoryEntry[] {
  const actions = ["Tạo báo cáo", "Download", "Xóa báo cáo"];
  const entries: HistoryEntry[] = [];
  for (let i = 0; i < 12; i++) {
    entries.push({
      id: genId("h"),
      timestamp: isoDaysAgo(i),
      user: i % 3 === 0 ? "ky-thuat-vien" : "vienkhach",
      action: actions[i % actions.length],
      target: `Báo cáo lưu lượng ${new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)}`,
      details: "Thao tác mô phỏng trong Mock Mode",
      status: "success",
      ip: `192.168.1.${100 + i}`,
    });
  }
  return entries;
}

function getReportsStore(): SmartReport[] {
  return getOrSeed(REPORTS_KEY, seedReports);
}
function saveReportsStore(r: SmartReport[]): void {
  setCollection(REPORTS_KEY, r);
}
function getHistoryStore(): HistoryEntry[] {
  return getOrSeed(HISTORY_KEY, seedHistory);
}
function saveHistoryStore(h: HistoryEntry[]): void {
  setCollection(HISTORY_KEY, h);
}

function pushHistory(action: string, target: string): void {
  const entry: HistoryEntry = {
    id: genId("h"),
    timestamp: new Date().toISOString(),
    user: "ky-thuat-vien",
    action,
    target,
    details: "Thao tác trong Mock Mode",
    status: "success",
  };
  saveHistoryStore([entry, ...getHistoryStore()]);
}

export function listReports(params: { page?: number; limit?: number; type?: string; status?: string; search?: string }): {
  success: boolean;
  data: SmartReport[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
} {
  let reports = getReportsStore();
  if (params.type) reports = reports.filter((r) => r.type === params.type);
  if (params.status) reports = reports.filter((r) => r.status === params.status);
  if (params.search) {
    const q = params.search.toLowerCase();
    reports = reports.filter((r) => r.title.toLowerCase().includes(q));
  }
  reports = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const start = (page - 1) * limit;
  const data = reports.slice(start, start + limit);
  return { success: true, data, pagination: { page, limit, total: reports.length, totalPages: Math.ceil(reports.length / limit) || 1 } };
}

export function getReportById(id: string): { success: boolean; data: SmartReport } | null {
  const report = getReportsStore().find((r) => r.id === id);
  if (!report) return null;
  return { success: true, data: report };
}

export function createReport(payload: {
  title: string;
  type: SmartReport["type"];
  period_from: string;
  period_to: string;
  settings?: SmartReport["settings_json"];
}): { success: boolean; data: { id: string; status: "pending"; message: string } } {
  const id = genId("rpt");
  const now = new Date().toISOString();
  const newReport: SmartReport = {
    id,
    title: payload.title,
    type: payload.type,
    period_from: payload.period_from,
    period_to: payload.period_to,
    status: "pending",
    files_json: null,
    summary_json: null,
    settings_json: payload.settings ?? null,
    created_by: "ky-thuat-vien",
    created_at: now,
    generated_at: null,
    error_message: null,
  };
  saveReportsStore([newReport, ...getReportsStore()]);
  pushHistory("Tạo báo cáo", newReport.title);
  simulateReportGeneration(id, payload.period_from, payload.period_to);
  return { success: true, data: { id, status: "pending", message: "Đang tạo báo cáo..." } };
}

export function deleteReport(id: string): { success: boolean; message: string } {
  const report = getReportsStore().find((r) => r.id === id);
  saveReportsStore(getReportsStore().filter((r) => r.id !== id));
  if (report) pushHistory("Xóa báo cáo", report.title);
  return { success: true, message: "Đã xóa báo cáo" };
}

export function getReportHistory(params: { limit?: number; offset?: number; action?: string }): {
  success: boolean;
  data: HistoryEntry[];
  pagination: { limit: number; offset: number; total: number };
} {
  let history = getHistoryStore();
  if (params.action) history = history.filter((h) => h.action === params.action);
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  return { success: true, data: history.slice(offset, offset + limit), pagination: { limit, offset, total: history.length } };
}

export function buildFakeFileBlob(format: "pdf" | "xlsx" | "zip", title: string): { blob: Blob; mime: string } {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
  };
  const content = `Đây là file mô phỏng (Mock Mode) cho báo cáo: ${title}\nĐịnh dạng: ${format}\nThời gian tạo: ${new Date().toLocaleString("vi-VN")}\n`;
  return { blob: new Blob([content], { type: mimeMap[format] }), mime: mimeMap[format] };
}

// ─── Mô phỏng vòng đời tạo báo cáo: pending → generating → ready ──────────────

function simulateReportGeneration(id: string, periodFrom: string, periodTo: string): void {
  setTimeout(() => {
    const reports = getReportsStore();
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) return;
    reports[idx] = { ...reports[idx], status: "generating" };
    saveReportsStore([...reports]);

    setTimeout(() => {
      const reports2 = getReportsStore();
      const idx2 = reports2.findIndex((r) => r.id === id);
      if (idx2 === -1) return;
      const now = new Date().toISOString();
      reports2[idx2] = {
        ...reports2[idx2],
        status: "ready",
        generated_at: now,
        summary_json: buildSummary(periodFrom, periodTo),
        files_json: {
          pdf: { path: `reports/${id}.pdf`, sizeMB: round1(0.5 + Math.random() * 4), url: "" },
          xlsx: { path: `reports/${id}.xlsx`, sizeMB: round1(0.3 + Math.random() * 2), url: "" },
        },
      };
      saveReportsStore([...reports2]);
    }, randInt(3000, 5000));
  }, randInt(1500, 2500));
}
