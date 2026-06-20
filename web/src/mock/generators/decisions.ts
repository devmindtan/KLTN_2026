/**
 * Mock cho decisions.service.ts — danh sách khuyến nghị do "AI" sinh ra, có thể
 * xem xét / thực hiện / bỏ qua giống quy trình thật.
 */
import type { Decision, DecisionCategory, DecisionStatus } from "@/services/decisions-types";
import { CAMERA_SEEDS } from "./cameras";
import { getOrSeed, setCollection } from "../engine/store";
import { genId, pick, rand, randInt, round1 } from "../engine/utils";

const KEY = "decisions";

const CATEGORIES: DecisionCategory[] = ["congestion", "predictive", "optimization", "quality", "monitoring"];

const TEMPLATES: Record<DecisionCategory, { title: string; recommendation: string; rationale: string }[]> = {
  congestion: [
    {
      title: "Ùn tắc nghiêm trọng tại {cam}",
      recommendation: "Điều hướng phương tiện sang tuyến thay thế và điều chỉnh chu kỳ đèn tín hiệu theo hướng ưu tiên thoát xe.",
      rationale: "Tỉ lệ V/C hiện tại vượt 85%, mật độ tăng liên tục trong 15 phút gần nhất.",
    },
    {
      title: "Mật độ vượt ngưỡng tại {cam}",
      recommendation: "Triển khai lực lượng điều tiết giao thông tại giao lộ trong khung giờ cao điểm.",
      rationale: "Camera ghi nhận lưu lượng vượt 90% công suất thiết kế liên tục.",
    },
  ],
  predictive: [
    {
      title: "Dự báo ùn tắc sắp xảy ra tại {cam}",
      recommendation: "Chủ động điều chỉnh đèn tín hiệu trước 10-15 phút để giảm tích tụ phương tiện.",
      rationale: "Mô hình dự báo 30 phút cho thấy xu hướng tăng mạnh, V/C dự kiến vượt 80%.",
    },
    {
      title: "Nguy cơ tắc nghẽn trong giờ tới tại {cam}",
      recommendation: "Gửi cảnh báo sớm cho lực lượng điều tiết khu vực lân cận.",
      rationale: "Xu hướng GTI tăng nhanh hơn current_ratio, cho thấy khả năng quá tải sắp tới.",
    },
  ],
  optimization: [
    {
      title: "Tối ưu chu kỳ đèn giờ cao điểm tại {cam}",
      recommendation: "Điều chỉnh thời lượng pha đèn xanh theo dữ liệu tải 7 ngày gần nhất.",
      rationale: "Phân tích lịch sử cho thấy chu kỳ đèn hiện tại chưa tối ưu trong khung 7-9h và 17-19h.",
    },
    {
      title: "Cân nhắc điều chỉnh hạ tầng tại {cam}",
      recommendation: "Đánh giá khả năng mở rộng làn hoặc bổ sung biển báo phân luồng.",
      rationale: "Tải trung bình 7 ngày liên tục ở mức cao, vượt năng lực thiết kế tuyến đường.",
    },
  ],
  quality: [
    {
      title: "Độ chính xác mô hình giảm cho {cam}",
      recommendation: "Huấn luyện lại model với dữ liệu mới nhất hoặc kiểm tra pipeline đầu vào.",
      rationale: "MAPE vượt ngưỡng 25% trong kỳ đánh giá gần nhất.",
    },
    {
      title: "Số mẫu dữ liệu thấp tại {cam}",
      recommendation: "Kiểm tra luồng dữ liệu camera, đảm bảo tần suất ghi nhận ổn định.",
      rationale: "Số lượng dự báo có đủ mẫu xác thực dưới 10 trong 24h qua.",
    },
  ],
  monitoring: [
    {
      title: "Camera mất tín hiệu: {cam}",
      recommendation: "Kiểm tra kết nối phần cứng và nguồn điện camera tại hiện trường.",
      rationale: "Không nhận được dữ liệu cập nhật từ camera trong hơn 30 phút.",
    },
    {
      title: "Dữ liệu bất thường tại {cam}",
      recommendation: "Đối chiếu với camera lân cận và kiểm tra hiệu chỉnh (calibration).",
      rationale: "Giá trị ghi nhận lệch lớn so với baseline lịch sử cùng khung giờ.",
    },
  ],
};

function scoreFor(category: DecisionCategory): { impact: number; confidence: number; urgency: number } {
  const base: Record<DecisionCategory, [number, number, number]> = {
    congestion: [70, 80, 85],
    predictive: [60, 65, 60],
    optimization: [55, 75, 30],
    quality: [50, 85, 45],
    monitoring: [65, 70, 70],
  };
  const [i, c, u] = base[category];
  return { impact: round1(rand(i - 15, i + 20)), confidence: round1(rand(c - 15, c + 12)), urgency: round1(rand(u - 20, u + 15)) };
}

function compound(impact: number, confidence: number, urgency: number): number {
  return round1(impact * 0.4 + confidence * 0.35 + urgency * 0.25);
}

function buildDecision(category: DecisionCategory, status: DecisionStatus, daysAgo: number): Decision {
  const cam = pick(CAMERA_SEEDS);
  const tpl = pick(TEMPLATES[category]);
  const { impact, confidence, urgency } = scoreFor(category);
  const generatedAt = new Date(Date.now() - daysAgo * 86_400_000 - randInt(0, 80_000) * 1000);

  const actors: Decision["action_items"][number]["actor"][] = ["technician", "driver", "system"];
  const speeds: Decision["action_items"][number]["timeToAction"][] = ["immediate", "soon", "planned"];

  return {
    id: genId("dec"),
    category,
    title: tpl.title.replace("{cam}", cam.display_name),
    recommendation: tpl.recommendation,
    rationale: tpl.rationale,
    score_impact: impact,
    score_confidence: confidence,
    score_urgency: urgency,
    score_compound: compound(impact, confidence, urgency),
    camera_ids: [cam.cam_id],
    evidence: {
      currentStatus: `Camera ${cam.display_name} đang ghi nhận tải cao bất thường`,
      historicalData: "So với trung bình 7 ngày, mức tải cao hơn đáng kể",
      forecastData: "Mô hình dự báo xu hướng tiếp tục tăng trong 30 phút tới",
    },
    action_items: [
      { action: tpl.recommendation, actor: pick(actors), timeToAction: pick(speeds) },
    ],
    status,
    reviewed_by: status !== "new" ? "ky-thuat-vien" : undefined,
    reviewed_at: status !== "new" ? new Date(generatedAt.getTime() + 3_600_000).toISOString() : undefined,
    feedback: status === "dismissed" ? "Đã kiểm tra hiện trường, không cần can thiệp thêm" : undefined,
    generated_at: generatedAt.toISOString(),
    effective_until: new Date(generatedAt.getTime() + 6 * 3_600_000).toISOString(),
    created_by: "system",
  };
}

function seedDecisions(): Decision[] {
  const all: Decision[] = [];
  const statuses: DecisionStatus[] = ["new", "new", "new", "reviewed", "implemented", "dismissed"];
  for (let i = 0; i < 30; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const status = pick(statuses);
    all.push(buildDecision(category, status, randInt(0, 6)));
  }
  return all.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
}

function getStore(): Decision[] {
  return getOrSeed(KEY, seedDecisions);
}
function save(d: Decision[]): void {
  setCollection(KEY, d);
}

export function listDecisions(filters: {
  status?: string;
  category?: string;
  cameras?: string;
  sort_by?: "score" | "urgency" | "created_at";
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}): { success: boolean; data: Decision[]; status_counts: Record<string, number>; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  let items = getStore();
  const statusCounts: Record<string, number> = { new: 0, reviewed: 0, implemented: 0, dismissed: 0 };
  getStore().forEach((d) => { statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1; });

  if (filters.status) {
    const set = new Set(filters.status.split(","));
    items = items.filter((d) => set.has(d.status));
  }
  if (filters.category) {
    const set = new Set(filters.category.split(","));
    items = items.filter((d) => set.has(d.category));
  }
  if (filters.cameras) {
    const set = new Set(filters.cameras.split(","));
    items = items.filter((d) => d.camera_ids.some((c) => set.has(c)));
  }

  const sortBy = filters.sort_by ?? "score";
  const order = filters.sort_order === "asc" ? 1 : -1;
  items = [...items].sort((a, b) => {
    if (sortBy === "urgency") return (a.score_urgency - b.score_urgency) * order;
    if (sortBy === "created_at") return (new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime()) * order;
    return (a.score_compound - b.score_compound) * order;
  });

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    success: true,
    data,
    status_counts: statusCounts,
    pagination: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) || 1 },
  };
}

export function analyzeDecisions(filters: { cameras?: string; time_window?: string; category?: string; limit?: number }): {
  success: boolean;
  count: number;
  data: Decision[];
  time_window: string;
  query: { cameras: string; category: string };
} {
  // Mô phỏng việc "phân tích lại" — sinh thêm 1-3 khuyến nghị mới ngẫu nhiên
  const newOnes: Decision[] = [];
  const n = randInt(1, 3);
  for (let i = 0; i < n; i++) {
    const category = (filters.category as DecisionCategory) || pick(CATEGORIES);
    newOnes.push(buildDecision(category, "new", 0));
  }
  save([...newOnes, ...getStore()]);

  return {
    success: true,
    count: newOnes.length,
    data: newOnes,
    time_window: filters.time_window ?? "24h",
    query: { cameras: filters.cameras ?? "all", category: filters.category ?? "all" },
  };
}

export function getDecisionById(id: string): Decision | null {
  return getStore().find((d) => d.id === id) ?? null;
}

export function getDecisionHistory(cameraId: string, limit: number): Decision[] {
  return getStore()
    .filter((d) => d.camera_ids.includes(cameraId))
    .slice(0, limit);
}

function updateDecision(id: string, patch: Partial<Decision>): Decision | null {
  const items = getStore();
  const idx = items.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const updated = { ...items[idx], ...patch };
  const next = [...items];
  next[idx] = updated;
  save(next);
  return updated;
}

export function reviewDecision(id: string, status: DecisionStatus, feedback?: string): { success: boolean; message: string; data: Decision } | null {
  const updated = updateDecision(id, { status, feedback, reviewed_by: "ky-thuat-vien", reviewed_at: new Date().toISOString() });
  if (!updated) return null;
  return { success: true, message: "Đã cập nhật trạng thái quyết định", data: updated };
}

export function implementDecision(id: string, details?: string): { success: boolean; message: string; data: Decision } | null {
  const updated = updateDecision(id, {
    status: "implemented",
    feedback: details,
    reviewed_by: "ky-thuat-vien",
    reviewed_at: new Date().toISOString(),
  });
  if (!updated) return null;
  return { success: true, message: "Đã đánh dấu thực hiện", data: updated };
}

export function dismissDecision(id: string): { success: boolean; message: string; data: Decision } | null {
  const updated = updateDecision(id, { status: "dismissed", reviewed_by: "ky-thuat-vien", reviewed_at: new Date().toISOString() });
  if (!updated) return null;
  return { success: true, message: "Đã bỏ qua quyết định", data: updated };
}

export function createDecision(partial: Partial<Decision>): { success: boolean; message: string; data: Decision } {
  const category = partial.category ?? pick(CATEGORIES);
  const base = buildDecision(category, "new", 0);
  const merged: Decision = { ...base, ...partial, id: genId("dec"), created_by: "ky-thuat-vien" };
  save([merged, ...getStore()]);
  return { success: true, message: "Đã tạo quyết định mới", data: merged };
}
