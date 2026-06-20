/**
 * Mock cho data-library.service.ts — collections + snapshot entries, hỗ trợ đầy đủ
 * CRUD để trang Thư viện Dữ liệu hoạt động bình thường (tạo, sửa, xoá, import) khi
 * không có backend thật.
 */
import type { CollectionDetail, DataLibraryCollection, SnapshotEntry } from "@/services/data-library.service";
import { getOrSeed, setCollection } from "../engine/store";
import { genId, randInt } from "../engine/utils";

const COL_KEY = "data_library_collections";
const ENTRY_KEY = "data_library_entries";

const SEED_COLLECTIONS: { title: string; data_type: string; description: string; tags: string[]; source: "internal" | "external" }[] = [
  { title: "Camera Detections - Quận 1", data_type: "camera_detections", description: "Dữ liệu phát hiện phương tiện theo từng khung hình camera khu vực Quận 1", tags: ["camera", "detection", "quan-1"], source: "internal" },
  { title: "Traffic Patterns - Toàn mạng", data_type: "traffic_patterns", description: "Mật độ giao thông tổng hợp theo giờ/ngày/tuần/tháng toàn TP.HCM", tags: ["pattern", "aggregate"], source: "internal" },
  { title: "Model Predictions - Random Forest", data_type: "model_predictions", description: "Lịch sử dự báo của các model Random Forest 5-60 phút", tags: ["model", "forecast"], source: "internal" },
  { title: "Incident Reports 2026", data_type: "incident_reports", description: "Báo cáo sự cố giao thông được ghi nhận thủ công bởi kỹ thuật viên", tags: ["incident", "manual"], source: "internal" },
  { title: "Dữ liệu khảo sát Sở GTVT", data_type: "survey", description: "Bộ dữ liệu khảo sát lưu lượng do Sở Giao thông Vận tải cung cấp", tags: ["external", "gtvt"], source: "external" },
  { title: "Dữ liệu thời tiết OpenWeather", data_type: "weather", description: "Lịch sử thời tiết TP.HCM dùng làm đặc trưng phụ cho model dự báo", tags: ["weather", "external"], source: "external" },
  { title: "Camera Detections - Quận Bình Thạnh", data_type: "camera_detections", description: "Dữ liệu phát hiện phương tiện khu vực Bình Thạnh", tags: ["camera", "detection", "binh-thanh"], source: "internal" },
  { title: "Model Predictions - YOLO", data_type: "model_predictions", description: "Lịch sử output mô hình nhận diện phương tiện YOLO", tags: ["model", "yolo"], source: "internal" },
];

function seedCollections(): DataLibraryCollection[] {
  const now = Date.now();
  return SEED_COLLECTIONS.map((s, i) => {
    const createdAt = new Date(now - randInt(10, 200) * 86_400_000);
    const updatedAt = new Date(createdAt.getTime() + randInt(0, 30) * 86_400_000);
    return {
      id: genId("col"),
      source: s.source,
      title: s.title,
      description: s.description,
      data_type: s.data_type,
      tags: s.tags,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      entry_count: randInt(2, 9),
      last_snapshot_date: updatedAt.toISOString().slice(0, 10),
      __order: i,
    } as DataLibraryCollection & { __order: number };
  });
}

function seedEntries(): Record<string, SnapshotEntry[]> {
  const collections = getOrSeed(COL_KEY, seedCollections);
  const map: Record<string, SnapshotEntry[]> = {};
  collections.forEach((col) => {
    const entries: SnapshotEntry[] = [];
    for (let i = 0; i < col.entry_count; i++) {
      const date = new Date(Date.now() - i * 7 * 86_400_000);
      const dateStr = date.toISOString().slice(0, 10);
      entries.push({
        id: genId("entry"),
        collection_id: col.id,
        snapshot_date: dateStr,
        minio_keys: { csv: `data-library/${col.id}/${dateStr}.csv`, json: `data-library/${col.id}/${dateStr}.json` },
        file_sizes: { csv: randInt(50_000, 4_000_000), json: randInt(60_000, 4_500_000) },
        record_count: randInt(500, 50_000),
        uploaded_by: col.source === "external" ? "ky-thuat-vien" : null,
        created_at: date.toISOString(),
      });
    }
    map[col.id] = entries;
  });
  return map;
}

function getCollections(): DataLibraryCollection[] {
  return getOrSeed(COL_KEY, seedCollections);
}

function getEntriesMap(): Record<string, SnapshotEntry[]> {
  return getOrSeed(ENTRY_KEY, seedEntries);
}

function saveCollections(cols: DataLibraryCollection[]): void {
  setCollection(COL_KEY, cols);
}

function saveEntriesMap(map: Record<string, SnapshotEntry[]>): void {
  setCollection(ENTRY_KEY, map);
}

export function listCollections(params: { source?: string; type?: string; page?: number; limit?: number }): {
  success: boolean;
  data: DataLibraryCollection[];
  total: number;
  page: number;
  limit: number;
} {
  let cols = getCollections();
  if (params.source) cols = cols.filter((c) => c.source === params.source);
  if (params.type) cols = cols.filter((c) => c.data_type === params.type);
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const start = (page - 1) * limit;
  const data = cols.slice(start, start + limit);
  return { success: true, data, total: cols.length, page, limit };
}

export function getCollectionDetail(id: string): { success: boolean; data: CollectionDetail } | null {
  const col = getCollections().find((c) => c.id === id);
  if (!col) return null;
  const entries = (getEntriesMap()[id] ?? []).slice().sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  return { success: true, data: { ...col, entries } };
}

export function createCollection(payload: { title: string; data_type: string; description?: string; tags?: string[] }): {
  success: boolean;
  data: DataLibraryCollection;
} {
  const cols = getCollections();
  const now = new Date().toISOString();
  const newCol: DataLibraryCollection = {
    id: genId("col"),
    source: "external",
    title: payload.title,
    description: payload.description ?? null,
    data_type: payload.data_type,
    tags: payload.tags ?? [],
    created_at: now,
    updated_at: now,
    entry_count: 0,
    last_snapshot_date: null,
  };
  saveCollections([newCol, ...cols]);
  const entriesMap = getEntriesMap();
  entriesMap[newCol.id] = [];
  saveEntriesMap(entriesMap);
  return { success: true, data: newCol };
}

export function updateCollection(
  id: string,
  payload: { title?: string; description?: string | null; data_type?: string }
): { success: boolean; data: DataLibraryCollection } | null {
  const cols = getCollections();
  const idx = cols.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated: DataLibraryCollection = {
    ...cols[idx],
    ...payload,
    updated_at: new Date().toISOString(),
  };
  const next = [...cols];
  next[idx] = updated;
  saveCollections(next);
  return { success: true, data: updated };
}

export function deleteCollection(id: string): { success: boolean } {
  saveCollections(getCollections().filter((c) => c.id !== id));
  const entriesMap = getEntriesMap();
  delete entriesMap[id];
  saveEntriesMap(entriesMap);
  return { success: true };
}

export function importEntry(payload: {
  collection_id: string;
  snapshot_date: string;
  filename: string;
  fileSize: number;
  new_title?: string;
  data_type?: string;
  description?: string;
}): { success: boolean; data: SnapshotEntry } {
  let cols = getCollections();
  let collectionId = payload.collection_id;

  if (collectionId === "__new__" || !cols.find((c) => c.id === collectionId)) {
    const now = new Date().toISOString();
    const newCol: DataLibraryCollection = {
      id: genId("col"),
      source: "external",
      title: payload.new_title ?? "Bộ dữ liệu mới",
      description: payload.description ?? null,
      data_type: payload.data_type ?? "other",
      tags: [],
      created_at: now,
      updated_at: now,
      entry_count: 0,
      last_snapshot_date: null,
    };
    cols = [newCol, ...cols];
    saveCollections(cols);
    collectionId = newCol.id;
  }

  const ext = payload.filename.split(".").pop() ?? "csv";
  const entry: SnapshotEntry = {
    id: genId("entry"),
    collection_id: collectionId,
    snapshot_date: payload.snapshot_date,
    minio_keys: { [ext]: `data-library/${collectionId}/${payload.snapshot_date}.${ext}` },
    file_sizes: { [ext]: payload.fileSize },
    record_count: randInt(100, 20_000),
    uploaded_by: "ky-thuat-vien",
    created_at: new Date().toISOString(),
  };

  const entriesMap = getEntriesMap();
  entriesMap[collectionId] = [entry, ...(entriesMap[collectionId] ?? [])];
  saveEntriesMap(entriesMap);

  const colsAfter = getCollections().map((c) =>
    c.id === collectionId
      ? { ...c, entry_count: c.entry_count + 1, last_snapshot_date: payload.snapshot_date, updated_at: new Date().toISOString() }
      : c
  );
  saveCollections(colsAfter);

  return { success: true, data: entry };
}

export function deleteEntry(id: string): { success: boolean } {
  const entriesMap = getEntriesMap();
  let ownerCollectionId: string | null = null;
  Object.entries(entriesMap).forEach(([colId, entries]) => {
    if (entries.some((e) => e.id === id)) ownerCollectionId = colId;
  });
  if (ownerCollectionId) {
    entriesMap[ownerCollectionId] = entriesMap[ownerCollectionId].filter((e) => e.id !== id);
    saveEntriesMap(entriesMap);
    const cols = getCollections().map((c) =>
      c.id === ownerCollectionId ? { ...c, entry_count: Math.max(0, c.entry_count - 1) } : c
    );
    saveCollections(cols);
  }
  return { success: true };
}
