/**
 * Engine mô phỏng dữ liệu camera "sống": mỗi camera có 1 trạng thái lưu lượng dao động
 * theo random-walk quanh đường cong giờ cao điểm (xem time-curve.ts). Mỗi lần tick() sinh
 * ra entity định dạng NGSI-LD giống hệt dữ liệu thật từ Orion Context Broker, để phần
 * còn lại của SocketContext (transform → processedCameras) không cần thay đổi gì.
 *
 * State sống chỉ giữ trong bộ nhớ (không persist) — giống hành vi dữ liệu real-time thật,
 * vốn cũng reset/khởi tạo lại khi tải trang.
 */
import type { NGSILDCamera, TrendInfo } from "@/contexts/SocketContext";
import type { LosLevel, RiskLevel } from "@/services/forecast.service";
import { CAMERA_SEEDS, type CameraSeed } from "../generators/cameras";
import { combinedLoadFactor, loadFactorAt, vnHourMinute, vnNow } from "./time-curve";
import { clamp, jitter, rand } from "./utils";
import { liveTrafficImageUrl } from "./traffic-images";

interface LiveState {
  volume: number;
  prevVolume: number;
  carShare: number;
}

const liveState = new Map<string, LiveState>();

function ensureInit(): void {
  if (liveState.size > 0) return;
  const now = vnNow();
  CAMERA_SEEDS.forEach((seed) => {
    const factor = combinedLoadFactor(now);
    const vol = clamp(seed.capacity * factor * jitter(1, 0.3), 1, seed.capacity * 1.25);
    liveState.set(seed.cam_id, { volume: vol, prevVolume: vol, carShare: rand(0.35, 0.55) });
  });
}

// ─── LOS / V-C helpers (dùng chung cho forecast, traffic-pattern, decisions...) ────

export function vcRatio(volume: number, capacity: number): number {
  return capacity > 0 ? volume / capacity : 0;
}

export function losFromVc(vc: number): LosLevel {
  if (vc < 0.4) return "free_flow";
  if (vc < 0.6) return "smooth";
  if (vc < 0.8) return "moderate";
  if (vc < 1.0) return "heavy";
  return "congested";
}

export function gtiStateFromVc(vc: number): string {
  if (vc < 0.5) return "free_flow";
  if (vc < 0.75) return "normal";
  if (vc < 0.95) return "congestion_start";
  return "congestion_risk";
}

export function riskFromLos(los: LosLevel): RiskLevel {
  switch (los) {
    case "congested":
      return "critical";
    case "heavy":
      return "high";
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

/** Quy đổi LOS A-F (Highway Capacity Manual) theo V/C, dùng cho ForecastRollingSlot.los */
export function losLetterFromVc(vc: number): string {
  if (vc < 0.2) return "A";
  if (vc < 0.4) return "B";
  if (vc < 0.6) return "C";
  if (vc < 0.8) return "D";
  if (vc < 1.0) return "E";
  return "F";
}

const LOS_LABEL_VI: Record<LosLevel, string> = {
  free_flow: "Thông thoáng",
  smooth: "Trôi chảy",
  moderate: "Vừa phải",
  heavy: "Đông đúc",
  congested: "Ùn tắc",
};

export function losLabelVi(los: LosLevel): string {
  return LOS_LABEL_VI[los];
}

/**
 * Ảnh minh hoạ tình trạng đường — ảnh giao thông thật, xoay vòng theo LOS của
 * từng camera (xem traffic-images.ts). Thay cho bản cũ dùng khối màu placehold.co.
 */
export function placeholderImageUrl(camId: string, los: LosLevel): string {
  return liveTrafficImageUrl(camId, los);
}

/** Dự báo các horizon 5/10/15/30/60 phút dựa trên đường cong giờ tương lai + nhiễu nhỏ */
export function projectForecast(
  seed: CameraSeed,
  baseDate: Date = vnNow()
): { "5m": number; "10m": number; "15m": number; "30m": number; "60m": number } {
  const horizons = [5, 10, 15, 30, 60] as const;
  const out = {} as Record<string, number>;
  horizons.forEach((h) => {
    const future = new Date(baseDate.getTime() + h * 60_000);
    const factor = combinedLoadFactor(future);
    out[`${h}m`] = Math.round(clamp(seed.capacity * factor * jitter(1, 0.18), 0, seed.capacity * 1.3));
  });
  return out as { "5m": number; "10m": number; "15m": number; "30m": number; "60m": number };
}

function tickOne(seed: CameraSeed): LiveState {
  ensureInit();
  const state = liveState.get(seed.cam_id)!;
  const { hour, minute } = vnHourMinute();
  const targetFactor = loadFactorAt(hour, minute) * jitter(1, 0.15);
  const target = clamp(seed.capacity * targetFactor, 1, seed.capacity * 1.3);
  const next = clamp(
    state.volume + (target - state.volume) * 0.35 + jitter(0, seed.capacity * 0.04),
    1,
    seed.capacity * 1.35
  );
  const updated: LiveState = {
    volume: next,
    prevVolume: state.volume,
    carShare: clamp(jitter(state.carShare, 0.04), 0.25, 0.65),
  };
  liveState.set(seed.cam_id, updated);
  return updated;
}

function buildCameraEntity(seed: CameraSeed, state: LiveState): NGSILDCamera {
  const now = Date.now() / 1000;
  const vc = vcRatio(state.volume, seed.capacity);
  const los = losFromVc(vc);
  const car = Math.round(state.volume * state.carShare);
  const motorbike = Math.max(0, Math.round(state.volume) - car);
  const direction =
    state.volume > state.prevVolume * 1.03 ? "increasing" : state.volume < state.prevVolume * 0.97 ? "decreasing" : "stable";
  const forecasts = projectForecast(seed);
  const predictedVc = vcRatio(forecasts["5m"], seed.capacity);
  const predictedLos = losFromVc(predictedVc);
  const gti = clamp(vc * 100 * jitter(1, 0.1), 0, 140);

  const trend: TrendInfo = {
    direction,
    gti_state: gtiStateFromVc(vc),
    gti: Math.round(gti * 10) / 10,
    current_ratio: Math.round(vc * 1000) / 10,
    diff: Math.round((gti - vc * 100) * 10) / 10,
  };

  const fullId = `urn:ngsi-ld:Camera:${seed.cam_id}`;

  return {
    _id: { id: fullId, type: "Camera", servicePath: "/" },
    attrs: {
      total_objects: { value: Math.round(state.volume), type: "Integer", modDate: now },
      detections: { value: { car, motorbike }, type: "StructuredValue", modDate: now },
      minio_key: { value: "", type: "Text", modDate: now },
      mock_image_url: { value: placeholderImageUrl(seed.cam_id, los), type: "Text", modDate: now },
      last_updated: { value: now, type: "DateTime", modDate: now },
      status: {
        value: {
          current: los,
          realtime: {
            current_volume: Math.round(state.volume),
            detections: { car, motorbike },
            capacity: seed.capacity,
            vc_ratio: Math.round(vc * 1000) / 1000,
            timestamp: now,
          },
        },
        type: "StructuredValue",
        modDate: now,
      },
      prediction: {
        value: {
          forecasts,
          status: {
            forecast: predictedLos,
            calculation: {
              predicted_volume: forecasts["5m"],
              capacity: seed.capacity,
              vc_ratio: Math.round(predictedVc * 1000) / 1000,
            },
          },
          trend,
          input_value: Math.round(state.volume),
        },
        type: "StructuredValue",
        modDate: now,
      },
      last_predicted: { value: new Date(now * 1000).toISOString(), type: "Text", modDate: now },
    },
    modDate: now,
  };
}

/** Danh sách camera tĩnh (cam_id, location, display_name) — dùng cho GET /api/cameras */
export function getMockCameraInfoList(): { cam_id: string; location: string; display_name: string }[] {
  return CAMERA_SEEDS.map((s) => ({
    cam_id: s.cam_id,
    location: `[${s.lat}, ${s.lng}]`,
    display_name: s.display_name,
  }));
}

/** Snapshot entities ban đầu — gọi 1 lần khi SocketContext mount ở Mock Mode */
export function initialCameraEntities(): NGSILDCamera[] {
  ensureInit();
  return CAMERA_SEEDS.map((seed) => buildCameraEntity(seed, liveState.get(seed.cam_id)!));
}

/** Tick định kỳ — mô phỏng các bản tin CAMERA_UPDATED liên tục */
export function tickCameraEntities(): NGSILDCamera[] {
  ensureInit();
  return CAMERA_SEEDS.map((seed) => buildCameraEntity(seed, tickOne(seed)));
}

export interface CameraSnapshot {
  seed: CameraSeed;
  volume: number;
  capacity: number;
  vc: number;
  los: LosLevel;
}

export function getCameraSnapshot(camId: string): CameraSnapshot | null {
  ensureInit();
  const seed = CAMERA_SEEDS.find((s) => s.cam_id === camId);
  if (!seed) return null;
  const state = liveState.get(camId)!;
  const vc = vcRatio(state.volume, seed.capacity);
  return { seed, volume: state.volume, capacity: seed.capacity, vc, los: losFromVc(vc) };
}

export function getAllSnapshots(): CameraSnapshot[] {
  ensureInit();
  return CAMERA_SEEDS.map((seed) => getCameraSnapshot(seed.cam_id)!);
}