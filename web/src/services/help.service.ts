/**
 * Help Service — API calls cho hệ thống tài liệu hướng dẫn
 */
import { apiFetch } from "@/lib/apiFetch";

const BASE = import.meta.env.VITE_BACKEND_URL;

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface HelpArticle {
  id: string;
  /** Unique slug, dùng làm anchor và URL (?article=los) */
  section_key: string;
  /** Null = section gốc, có giá trị = con của section đó */
  parent_key: string | null;
  /** Loại bài viết: 'document' = hướng dẫn, 'question' = hỏi đáp */
  type: "document" | "question";
  title: string;
  /** Lớp 1 — 1 câu tóm tắt, không chuyên môn */
  summary: string;
  /** Lớp 2 — Giải thích ngữ cảnh (Markdown) */
  content: string;
  /** Lớp 3 — Chi tiết kỹ thuật ẩn trong collapsible (Markdown, nullable) */
  tech_detail: string | null;
  sort_order: number;
  is_published: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateArticlePayload {
  section_key: string;
  parent_key: string | null;
  /** 'document' | 'question' — mặc định 'document' nếu không truyền */
  type?: "document" | "question";
  title: string;
  summary: string;
  content: string;
  tech_detail?: string | null;
  sort_order?: number;
}

export interface UpdateArticlePayload extends Partial<CreateArticlePayload> {
  is_published?: boolean;
}

export interface ArticlesResponse {
  success: boolean;
  data: HelpArticle[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Lấy tất cả articles đã publish, sorted theo sort_order */
export async function getHelpArticles(): Promise<HelpArticle[]> {
  const res = await apiFetch(`${BASE}/api/help/articles`);
  const json = await res.json() as ArticlesResponse;
  return json.data;
}

/** Tạo article mới (chỉ technician) */
export async function createHelpArticle(payload: CreateArticlePayload): Promise<HelpArticle> {
  const res = await apiFetch(
    `${BASE}/api/help/articles`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    const err: Error & { code?: string } = new Error(
      body.message ?? `Lỗi ${res.status}`
    );
    if (res.status === 409) err.code = "DUPLICATE_KEY";
    throw err;
  }
  const json = await res.json() as { success: boolean; data: HelpArticle };
  return json.data;
}

/** Cập nhật article (chỉ technician) */
export async function updateHelpArticle(
  id: string,
  payload: UpdateArticlePayload
): Promise<HelpArticle> {
  const res = await apiFetch(
    `${BASE}/api/help/articles/${id}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
  const json = await res.json() as { success: boolean; data: HelpArticle };
  return json.data;
}

/** Toggle is_published (chỉ technician) */
export async function togglePublishArticle(id: string): Promise<void> {
  await apiFetch(`${BASE}/api/help/articles/${id}/publish`, { method: "PATCH" });
}

/** Xóa article (chỉ technician) */
export async function deleteHelpArticle(id: string): Promise<void> {
  await apiFetch(`${BASE}/api/help/articles/${id}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

export interface ArticleTreeNode {
  article: HelpArticle;
  children: ArticleTreeNode[];
}

/**
 * Xây dựng cây sidebar từ mảng phẳng articles.
 * Trả về các root nodes (parent_key = null) cùng children đã sorted.
 */
export function buildArticleTree(articles: HelpArticle[]): ArticleTreeNode[] {
  const map = new Map<string, ArticleTreeNode>();
  const roots: ArticleTreeNode[] = [];

  // Server đã scope theo role (viewer → published only, technician → all)
  // Không lọc lại ở đây để technician thấy được bài chưa publish
  articles.forEach(a => {
    map.set(a.section_key, { article: a, children: [] });
  });

  articles.forEach(a => {
    const node = map.get(a.section_key)!;
    if (a.parent_key && map.has(a.parent_key)) {
      map.get(a.parent_key)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: ArticleTreeNode[]) => {
    nodes.sort((a, b) => a.article.sort_order - b.article.sort_order);
    nodes.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}
