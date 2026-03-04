/**
 * Model Service - API service để quản lý ML models
 */
import { apiFetch } from "@/lib/apiFetch";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

// ============================================================
// INTERFACES
// ============================================================

export interface MLModelMetadata {
  id: number;
  model_type: string;
  model_version: string;
  minio_key: string;
  base_model: string | null;
  training_samples: number | null;
  training_duration_hours: number | null;
  metrics: {
    mae?: number;
    rmse?: number;
    r2?: number;
    features?: string[];
    [key: string]: unknown;
  } | null;
  is_active: boolean;
  created_at: string;
  display_name: string;
}

export interface ModelHistoryResponse {
  success: boolean;
  model_type: string;
  display_name: string;
  data: MLModelMetadata[];
}

export interface ActiveModelsResponse {
  success: boolean;
  data: MLModelMetadata[];
}

export interface AllVersionsResponse {
  success: boolean;
  data: Record<string, MLModelMetadata[]>;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Lấy danh sách tất cả model đang active (1 model/loại)
 */
export const getActiveModels = async (): Promise<MLModelMetadata[]> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models`);
  if (!res.ok) throw new Error("Lỗi khi lấy danh sách mô hình");
  const json: ActiveModelsResponse = await res.json();
  return json.data ?? [];
};

/**
 * Lấy chi tiết 1 model theo ID
 */
export const getModelById = async (id: number): Promise<MLModelMetadata> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models/${id}`);
  if (!res.ok) throw new Error("Lỗi khi lấy chi tiết mô hình");
  const json = await res.json();
  return json.data;
};

/**
 * Lấy lịch sử tất cả versions của cùng loại model (theo ID của model hiện tại)
 */
export const getModelHistory = async (id: number): Promise<ModelHistoryResponse> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models/${id}/history`);
  if (!res.ok) throw new Error("Lỗi khi lấy lịch sử phiên bản");
  return res.json();
};

/**
 * Lấy tất cả versions của mọi loại model (dùng cho selector kích hoạt)
 */
export const getAllModelVersions = async (): Promise<Record<string, MLModelMetadata[]>> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models/all`);
  if (!res.ok) throw new Error("Lỗi khi lấy phiên bản mô hình");
  const json: AllVersionsResponse = await res.json();
  return json.data ?? {};
};

/**
 * Kích hoạt một model version (set is_active=TRUE, deactivate các version cùng loại)
 */
export const activateModel = async (
  id: number
): Promise<{ success: boolean; message: string; k8s_restart: boolean }> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models/${id}/activate`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Lỗi khi kích hoạt mô hình");
  return json;
};

/**
 * Tạo k8s Job huấn luyện phiên bản model mới (is_active=FALSE, user tự kích hoạt sau)
 */
export const trainModel = async (payload: {
  model_type: string;
  start_date: string;
  end_date: string;
}): Promise<{ success: boolean; job_name: string; job_id: string; status: string }> => {
  const res = await apiFetch(`${BACKEND_API_URL}/api/models/train`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Lỗi khi khởi động training");
  return json;
};

// ============================================================
// HELPER UTILS
// ============================================================

/**
 * Trả về màu badge dựa trên R² score
 */
export const getR2Color = (r2: number | undefined): string => {
  if (r2 === undefined) return "text-muted-foreground";
  if (r2 >= 0.9) return "text-green-600 dark:text-green-400";
  if (r2 >= 0.8) return "text-blue-600 dark:text-blue-400";
  if (r2 >= 0.7) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

/**
 * Format tên loại mô hình ngắn gọn để hiển thị trên card
 */
export const getModelShortLabel = (model_type: string): string => {
  const map: Record<string, string> = {
    random_forest_5m: "RF • 5 phút",
    random_forest_10m: "RF • 10 phút",
    random_forest_15m: "RF • 15 phút",
    random_forest_30m: "RF • 30 phút",
    random_forest_60m: "RF • 60 phút",
    yolo: "YOLO",
  };
  return map[model_type] ?? model_type;
};

/**
 * Format phiên bản timestamp thành chuỗi dễ đọc
 * VD: "20260227_143022" → "27/02/2026 14:30"
 */
export const formatVersion = (version: string): string => {
  // format: YYYYMMDD_HHmmss
  const match = version.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (!match) return version;
  const [, y, mo, d, h, min] = match;
  return `${d}/${mo}/${y} ${h}:${min}`;
};
