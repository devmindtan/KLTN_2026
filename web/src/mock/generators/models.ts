/**
 * Mock cho model.service.ts — danh sách phiên bản model theo từng loại, cộng với mô
 * phỏng quy trình huấn luyện (TRAINING_JOB_UPDATED) và kích hoạt/hot-reload
 * (MODEL_RELOAD_UPDATED) đẩy qua mock event bus để banner tiến trình trên trang
 * Models hoạt động giống hệt khi dùng Socket.IO thật.
 */
import type { MLModelMetadata } from "@/services/model.service";
import { getOrSeed, setCollection } from "../engine/store";
import { genId, rand, randInt, round2 } from "../engine/utils";
import { emitMockEvent } from "../engine/bus";

const KEY = "models";

export const MODEL_TYPES = [
  "random_forest_5m",
  "random_forest_10m",
  "random_forest_15m",
  "random_forest_30m",
  "random_forest_60m",
  "yolo",
] as const;

const SHORT_LABEL: Record<string, string> = {
  random_forest_5m: "RF • 5 phút",
  random_forest_10m: "RF • 10 phút",
  random_forest_15m: "RF • 15 phút",
  random_forest_30m: "RF • 30 phút",
  random_forest_60m: "RF • 60 phút",
  yolo: "YOLO",
};

const FEATURES = ["avg_objects_5m", "avg_objects_15m", "hour_of_day", "day_of_week", "vc_ratio_lag1", "is_peak_hour"];

let nextId = 1000;

function versionString(date: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function makeModel(modelType: string, daysAgo: number, isActive: boolean): MLModelMetadata {
  const createdDate = new Date(Date.now() - daysAgo * 86_400_000 - randInt(0, 3600) * 1000);
  const isYolo = modelType === "yolo";
  const id = nextId++;
  return {
    id,
    model_type: modelType,
    model_version: versionString(createdDate),
    minio_key: `models/${modelType}/${versionString(createdDate)}.pkl`,
    base_model: isYolo ? "yolov8n" : null,
    training_samples: isYolo ? null : randInt(8000, 60000),
    training_duration_hours: round2(rand(0.3, 4.5)),
    metrics: isYolo
      ? { mae: round2(rand(1.5, 4)), rmse: round2(rand(2.5, 6)), r2: round2(rand(0.82, 0.95)), features: ["bbox", "class_conf"] }
      : {
          mae: round2(rand(2, 7)),
          rmse: round2(rand(3, 11)),
          r2: round2(rand(0.72, 0.96)),
          features: FEATURES,
        },
    is_active: isActive,
    created_at: createdDate.toISOString(),
    display_name: SHORT_LABEL[modelType] ?? modelType,
  };
}

function seedModels(): MLModelMetadata[] {
  const all: MLModelMetadata[] = [];
  MODEL_TYPES.forEach((type) => {
    const versions = randInt(2, 4);
    for (let v = versions; v >= 1; v--) {
      all.push(makeModel(type, v * randInt(4, 9), v === versions));
    }
  });
  return all;
}

function getStore(): MLModelMetadata[] {
  return getOrSeed(KEY, seedModels);
}

function save(models: MLModelMetadata[]): void {
  setCollection(KEY, models);
}

export function getActiveModels(): MLModelMetadata[] {
  return getStore().filter((m) => m.is_active);
}

export function getModelById(id: number): MLModelMetadata | null {
  return getStore().find((m) => m.id === id) ?? null;
}

export function getModelHistory(id: number): { model_type: string; display_name: string; data: MLModelMetadata[] } | null {
  const models = getStore();
  const target = models.find((m) => m.id === id);
  if (!target) return null;
  const data = models
    .filter((m) => m.model_type === target.model_type)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { model_type: target.model_type, display_name: target.display_name, data };
}

export function getAllModelVersions(): Record<string, MLModelMetadata[]> {
  const models = getStore();
  const grouped: Record<string, MLModelMetadata[]> = {};
  MODEL_TYPES.forEach((t) => {
    grouped[t] = models
      .filter((m) => m.model_type === t)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });
  return grouped;
}

export function activateModel(id: number): { success: boolean; message: string; k8s_restart: boolean } | null {
  const models = getStore();
  const target = models.find((m) => m.id === id);
  if (!target) return null;

  const updated = models.map((m) => (m.model_type === target.model_type ? { ...m, is_active: m.id === id } : m));
  save(updated);

  // Mô phỏng banner hot-reload qua mock event bus (giống MODEL_RELOAD_UPDATED thật)
  simulateModelReload(target.model_type, target.model_version);

  return { success: true, message: `Đã kích hoạt phiên bản ${target.model_version}`, k8s_restart: true };
}

export function trainModel(payload: {
  model_type: string;
  start_date: string;
  end_date: string;
}): { success: boolean; job_name: string; job_id: string; status: string } {
  const jobId = genId("job");
  const jobName = `train-${payload.model_type}-${Date.now()}`;
  simulateTrainingJob(jobId, payload.model_type, payload.start_date, payload.end_date);
  return { success: true, job_name: jobName, job_id: jobId, status: "pending" };
}

// ─── Mô phỏng tiến trình training/reload qua mock event bus ───────────────────

const TRAIN_STAGES = ["Tải dữ liệu huấn luyện", "Tiền xử lý đặc trưng", "Huấn luyện mô hình", "Đánh giá hiệu năng", "Lưu trữ phiên bản"];

function simulateTrainingJob(jobId: string, modelType: string, startDate: string, endDate: string): void {
  const totalSamples = randInt(8000, 60000);
  let progress = 0;
  const startedAt = new Date().toISOString();

  const tick = () => {
    progress = Math.min(100, progress + randInt(8, 18));
    const stageIdx = Math.min(TRAIN_STAGES.length - 1, Math.floor((progress / 100) * TRAIN_STAGES.length));
    const status = progress >= 100 ? "succeeded" : "running";

    emitMockEvent("TRAINING_JOB_UPDATED", {
      job_id: jobId,
      model_type: modelType,
      status,
      progress_pct: progress,
      current_stage: status === "succeeded" ? "Hoàn tất" : TRAIN_STAGES[stageIdx],
      start_date: startDate,
      end_date: endDate,
      total_samples: totalSamples,
      started_at: startedAt,
      finished_at: status === "succeeded" ? new Date().toISOString() : "",
      error_message: "",
      result_metrics:
        status === "succeeded"
          ? { mae: round2(rand(2, 6)), rmse: round2(rand(3, 9)), r2: round2(rand(0.78, 0.95)) }
          : {},
    });

    if (status === "succeeded") {
      const models = getStore();
      const newModel = makeModel(modelType, 0, false);
      save([newModel, ...models]);
      return;
    }
    setTimeout(tick, randInt(1200, 2200));
  };

  setTimeout(tick, randInt(800, 1500));
}

const RELOAD_STAGES = ["Dừng service hiện tại", "Tải phiên bản mới", "Khởi động lại service", "Kiểm tra sức khoẻ"];

function simulateModelReload(modelType: string, modelVersion: string): void {
  let progress = 0;
  const startedAt = new Date().toISOString();

  const tick = () => {
    progress = Math.min(100, progress + randInt(15, 30));
    const stageIdx = Math.min(RELOAD_STAGES.length - 1, Math.floor((progress / 100) * RELOAD_STAGES.length));
    const status = progress >= 100 ? "succeeded" : "running";

    emitMockEvent("MODEL_RELOAD_UPDATED", {
      reload_id: genId("reload"),
      model_type: modelType,
      status,
      progress_pct: progress,
      current_stage: status === "succeeded" ? "Hoàn tất" : RELOAD_STAGES[stageIdx],
      model_version: modelVersion,
      started_at: startedAt,
      finished_at: status === "succeeded" ? new Date().toISOString() : "",
      error_message: "",
    });

    if (status !== "succeeded") setTimeout(tick, randInt(700, 1300));
  };

  setTimeout(tick, randInt(400, 900));
}
