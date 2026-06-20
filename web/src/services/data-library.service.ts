/**
 * Data Library Service - API calls cho collections và entries
 */
import { apiFetch, clearApiCache } from "@/lib/apiFetch";
import { isMockEnabled } from "@/mock/engine/mock-mode";
import { importEntry as mockImportEntry } from "@/mock/generators/data-library";
import { networkDelay } from "@/mock/engine/utils";

const BASE = import.meta.env.VITE_BACKEND_URL;

// ============================================================
// INTERFACES
// ============================================================

export interface DataLibraryCollection {
  id: string;
  source: "internal" | "external";
  title: string;
  description: string | null;
  data_type: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  entry_count: number;
  last_snapshot_date: string | null;
}

export interface SnapshotEntry {
  id: string;
  collection_id: string;
  snapshot_date: string;
  minio_keys: Record<string, string>;
  file_sizes: Record<string, number> | null;
  record_count: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CollectionDetail extends DataLibraryCollection {
  entries: SnapshotEntry[];
}

export interface CollectionsResponse {
  success: boolean;
  data: DataLibraryCollection[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Lấy danh sách collections với filter tùy chọn
 * GET /api/data-library/collections
 */
export async function getCollections(params?: {
  source?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<CollectionsResponse> {
  const query = new URLSearchParams();
  if (params?.source) query.set("source", params.source);
  if (params?.type)   query.set("type",   params.type);
  if (params?.page)   query.set("page",   String(params.page));
  if (params?.limit)  query.set("limit",  String(params.limit));

  const res = await apiFetch(`${BASE}/api/data-library/collections?${query}`);
  if (!res.ok) throw new Error("Không thể tải danh sách dữ liệu");
  return res.json();
}

/**
 * Lấy chi tiết collection + danh sách entries
 * GET /api/data-library/collections/:id
 */
export async function getCollectionById(id: string): Promise<CollectionDetail> {
  const res = await apiFetch(`${BASE}/api/data-library/collections/${id}`);
  if (!res.ok) throw new Error("Không thể tải chi tiết bộ dữ liệu");
  const json = await res.json();
  return json.data;
}

/**
 * Tạo collection mới (external)
 * POST /api/data-library/collections
 */
export async function createCollection(payload: {
  title: string;
  data_type: string;
  description?: string;
  tags?: string[];
}): Promise<DataLibraryCollection> {
  const res = await apiFetch(`${BASE}/api/data-library/collections`, {
    method: "POST",
    body:   JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Không thể tạo bộ dữ liệu");
  const json = await res.json();
  clearApiCache(/\/api\/data-library\/collections/);
  return json.data;
}

/**
 * Cập nhật thông tin cơ bản collection (title, description, data_type)
 * PUT /api/data-library/collections/:id
 */
export async function updateCollection(
  id: string,
  payload: { title?: string; description?: string | null; data_type?: string }
): Promise<DataLibraryCollection> {
  const res = await apiFetch(`${BASE}/api/data-library/collections/${id}`, {
    method: "PUT",
    body:   JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Không thể cập nhật bộ dữ liệu");
  const json = await res.json();
  clearApiCache(/\/api\/data-library\/collections/);
  return json.data;
}

/**
 * Xóa collection
 * DELETE /api/data-library/collections/:id
 */
export async function deleteCollection(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/data-library/collections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Không thể xóa bộ dữ liệu");
  clearApiCache(/\/api\/data-library\/collections/);
}

/**
 * Import 1 file vào collection (multipart/form-data)
 * POST /api/data-library/entries
 */
export async function importEntry(payload: {
  collection_id: string;
  snapshot_date: string;
  file: File;
  new_title?: string;
  data_type?: string;
  description?: string;
}): Promise<SnapshotEntry> {
  const token = localStorage.getItem("auth_token");
  const form  = new FormData();
  form.append("collection_id", payload.collection_id);
  form.append("snapshot_date", payload.snapshot_date);
  form.append("file",          payload.file);
  if (payload.new_title)   form.append("new_title",   payload.new_title);
  if (payload.data_type)   form.append("data_type",   payload.data_type);
  if (payload.description) form.append("description", payload.description);

  if (isMockEnabled()) {
    await networkDelay();
    const result = mockImportEntry({
      collection_id: payload.collection_id,
      snapshot_date: payload.snapshot_date,
      filename: payload.file.name,
      fileSize: payload.file.size,
      new_title: payload.new_title,
      data_type: payload.data_type,
      description: payload.description,
    });
    clearApiCache(/\/api\/data-library\/collections/);
    return result.data;
  }

  const res = await fetch(`${BASE}/api/data-library/entries`, {
    method:  "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    form,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Import thất bại");
  const json = await res.json();
  clearApiCache(/\/api\/data-library\/collections/);
  return json.data;
}

/**
 * Xóa 1 snapshot entry
 * DELETE /api/data-library/entries/:id
 */
export async function deleteEntry(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/data-library/entries/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Không thể xóa snapshot");
  clearApiCache(/\/api\/data-library\/collections/);
}

/**
 * Tải xuống 1 file hoặc toàn bộ snapshot
 * GET /api/data-library/entries/:id/download?file={key|all}
 */
export async function downloadEntryFile(entryId: string, fileKey: string, filename: string): Promise<void> {
  let blob: Blob;

  if (isMockEnabled()) {
    await networkDelay();
    const content = `Đây là file mô phỏng (Mock Mode)\nEntry: ${entryId}\nFile: ${fileKey}\nThời gian: ${new Date().toLocaleString("vi-VN")}\n`;
    blob = new Blob([content], { type: "text/plain" });
  } else {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(
      `${BASE}/api/data-library/entries/${entryId}/download?file=${fileKey}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("Tải file thất bại");
    blob = await res.blob();
  }

  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = filename;
  a.click();
  URL.revokeObjectURL(url);
}
