/**
 * Mock cho help.service.ts — bài viết tài liệu hướng dẫn (trang Help/Documentation),
 * hỗ trợ tạo/sửa/publish/xoá để kỹ thuật viên vẫn soạn thảo được khi backend lỗi.
 */
import type { HelpArticle } from "@/services/help.service";
import { getOrSeed, setCollection } from "../engine/store";
import { genId } from "../engine/utils";

const KEY = "help_articles";

interface SeedArticle {
  section_key: string;
  parent_key: string | null;
  type: "document" | "question";
  title: string;
  summary: string;
  content: string;
  tech_detail?: string;
}

const SEED: SeedArticle[] = [
  {
    section_key: "tong-quan",
    parent_key: null,
    type: "document",
    title: "Tổng quan hệ thống",
    summary: "Giới thiệu chung về hệ thống giám sát & dự báo lưu lượng giao thông.",
    content: "Hệ thống thu thập dữ liệu từ camera giao thông, xử lý bằng AI để đếm phương tiện, dự báo lưu lượng và hỗ trợ ra quyết định vận hành.",
  },
  {
    section_key: "camera-giam-sat",
    parent_key: null,
    type: "document",
    title: "Camera giám sát",
    summary: "Cách đọc thông tin trạng thái camera trên bản đồ và camera wall.",
    content: "Mỗi camera hiển thị mức độ phục vụ (LOS) bằng màu sắc: xanh lá (thông thoáng) đến đỏ (ùn tắc), kèm số liệu phương tiện thời gian thực.",
    tech_detail: "Dữ liệu camera truyền qua Socket.IO theo định dạng NGSI-LD (FIWARE Orion Context Broker), cập nhật mỗi khi có khung hình mới được xử lý.",
  },
  {
    section_key: "muc-do-phuc-vu",
    parent_key: "camera-giam-sat",
    type: "question",
    title: "Mức độ phục vụ (LOS) là gì?",
    summary: "LOS phản ánh mức độ đông đúc của một tuyến đường dựa trên tỉ lệ V/C.",
    content: "LOS gồm 5 mức: Thông thoáng, Trôi chảy, Vừa phải, Đông đúc, Ùn tắc — tính từ tỉ lệ lưu lượng thực tế so với năng lực tối đa (capacity) của camera.",
  },
  {
    section_key: "du-bao-mo-hinh",
    parent_key: null,
    type: "document",
    title: "Dự báo & Mô hình AI",
    summary: "Cách hệ thống dự báo lưu lượng 5-60 phút tới.",
    content: "Các mô hình Random Forest được huấn luyện riêng cho từng horizon (5, 10, 15, 30, 60 phút) dựa trên dữ liệu lịch sử và đặc trưng thời gian thực.",
    tech_detail: "Pipeline: thu thập detections → tổng hợp 5-phút → feature engineering → inference → lưu camera_forecasts → đối chiếu actual để tính sai số.",
  },
  {
    section_key: "huan-luyen-lai-mo-hinh",
    parent_key: "du-bao-mo-hinh",
    type: "question",
    title: "Khi nào nên huấn luyện lại mô hình?",
    summary: "Huấn luyện lại khi độ chính xác giảm hoặc dữ liệu mới đủ lớn.",
    content: "Khuyến nghị huấn luyện lại khi MAPE vượt 25% hoặc đã tích luỹ đủ dữ liệu mới (thường 7-14 ngày) chưa được model học.",
  },
  {
    section_key: "bao-cao-quyet-dinh",
    parent_key: null,
    type: "document",
    title: "Báo cáo & Quyết định",
    summary: "Hướng dẫn tạo báo cáo thông minh và xử lý khuyến nghị quyết định.",
    content: "Báo cáo được tạo bất đồng bộ (pending → generating → ready). Quyết định là các khuyến nghị AI sinh ra theo 5 nhóm: ùn tắc, dự báo, tối ưu, chất lượng, giám sát.",
  },
  {
    section_key: "thu-vien-du-lieu",
    parent_key: null,
    type: "document",
    title: "Thư viện dữ liệu",
    summary: "Quản lý các bộ dữ liệu nội bộ và import dữ liệu ngoài.",
    content: "Mỗi collection chứa nhiều snapshot entries theo ngày, có thể tải về dưới dạng CSV/JSON hoặc import file mới (kỹ thuật viên).",
  },
  {
    section_key: "phan-quyen",
    parent_key: null,
    type: "question",
    title: "Sự khác biệt giữa Khách và Kỹ thuật viên?",
    summary: "Khách chỉ xem được dữ liệu, Kỹ thuật viên có quyền quản trị hệ thống.",
    content: "Khách (viewer) xem dữ liệu, tải báo cáo. Kỹ thuật viên (technician) thêm có quyền huấn luyện/kích hoạt model, import/xoá dữ liệu, xử lý quyết định và truy cập khu vực phát triển (sandbox).",
  },
];

function seedArticles(): HelpArticle[] {
  const now = new Date().toISOString();
  return SEED.map((s, i) => ({
    id: genId("art"),
    section_key: s.section_key,
    parent_key: s.parent_key,
    type: s.type,
    title: s.title,
    summary: s.summary,
    content: s.content,
    tech_detail: s.tech_detail ?? null,
    sort_order: i,
    is_published: true,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  }));
}

function getStore(): HelpArticle[] {
  return getOrSeed(KEY, seedArticles);
}
function save(a: HelpArticle[]): void {
  setCollection(KEY, a);
}

export function getArticles(includeUnpublished: boolean): HelpArticle[] {
  const all = getStore();
  return includeUnpublished ? all : all.filter((a) => a.is_published);
}

export function createArticle(payload: {
  section_key: string;
  parent_key: string | null;
  type?: "document" | "question";
  title: string;
  summary: string;
  content: string;
  tech_detail?: string | null;
  sort_order?: number;
}): { ok: true; data: HelpArticle } | { ok: false; status: number; message: string } {
  const all = getStore();
  if (all.some((a) => a.section_key === payload.section_key)) {
    return { ok: false, status: 409, message: "section_key đã tồn tại" };
  }
  const now = new Date().toISOString();
  const article: HelpArticle = {
    id: genId("art"),
    section_key: payload.section_key,
    parent_key: payload.parent_key,
    type: payload.type ?? "document",
    title: payload.title,
    summary: payload.summary,
    content: payload.content,
    tech_detail: payload.tech_detail ?? null,
    sort_order: payload.sort_order ?? all.length,
    is_published: true,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
  save([...all, article]);
  return { ok: true, data: article };
}

export function updateArticle(
  id: string,
  payload: Partial<{
    section_key: string;
    parent_key: string | null;
    type: "document" | "question";
    title: string;
    summary: string;
    content: string;
    tech_detail: string | null;
    sort_order: number;
    is_published: boolean;
  }>
): HelpArticle | null {
  const all = getStore();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated: HelpArticle = { ...all[idx], ...payload, updated_at: new Date().toISOString() };
  const next = [...all];
  next[idx] = updated;
  save(next);
  return updated;
}

export function togglePublish(id: string): HelpArticle | null {
  const all = getStore();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], is_published: !all[idx].is_published, updated_at: new Date().toISOString() };
  const next = [...all];
  next[idx] = updated;
  save(next);
  return updated;
}

export function deleteArticle(id: string): boolean {
  const all = getStore();
  if (!all.some((a) => a.id === id)) return false;
  save(all.filter((a) => a.id !== id));
  return true;
}
