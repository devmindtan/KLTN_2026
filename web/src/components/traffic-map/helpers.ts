import L from "leaflet";
import { getLOSLabel } from "@/lib/app-constants";
import { LOS_MARKER_COLOR, GTI_LABELS, GTI_COLORS } from "./constants";
import type { EnrichedCamera, ForecastKey } from "./types";

export function getLosLabel(los: string): string {
  return getLOSLabel(los, los);
}

/** Trả về label + màu sắc GTI theo phần trăm */
export function getGtiState(gti: number) {
  const i = gti <= 30 ? 0 : gti <= 60 ? 1 : gti <= 85 ? 2 : 3;
  return { label: GTI_LABELS[i], color: GTI_COLORS[i] };
}

/** Chuyển V/C ratio → LOS string */
export function vcToLos(vc: number): string {
  if (vc < 0.4) return "free_flow";
  if (vc < 0.6) return "smooth";
  if (vc < 0.8) return "moderate";
  if (vc < 1.0) return "heavy";
  return "congested";
}

/** Lấy LOS dự báo (5m dùng status.forecast; còn lại tính từ count/capacity) */
export function getForecastLos(cam: EnrichedCamera, key: ForecastKey): string {
  if (key === "5m") return cam.status.forecast;
  const cap = cam.calculation?.capacity ?? cam.realtimeData?.capacity ?? 0;
  if (!cap) return "unknown";
  return vcToLos(cam.forecasts[key] / cap);
}

/** Tạo DivIcon tròn màu LOS cho camera marker */
export function createLosMarker(los: string, onRoute = false): L.DivIcon {
  const color = LOS_MARKER_COLOR[los] ?? "#94a3b8";
  const size = onRoute ? 28 : 22;
  const bdr = onRoute
    ? `border:3px solid white;outline:2.5px solid ${color};`
    : "border:2.5px solid white;";
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};${bdr}box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  });
}

/** Tạo DivIcon ghim A/B cho waypoint tuyến đường */
export function createWaypointMarker(type: "origin" | "dest"): L.DivIcon {
  const color = type === "origin" ? "#16a34a" : "#dc2626";
  const letter = type === "origin" ? "A" : "B";
  return L.divIcon({
    html: `<div style="width:28px;height:28px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:700;">${letter}</span></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

/** Tạo DivIcon ghim preview A/B — updating=true khi đang chờ chọn vị trí mới */
export function createPickPreviewMarker(type: "origin" | "dest", updating = false): L.DivIcon {
  const color = type === "origin" ? "#16a34a" : "#dc2626";
  const letter = type === "origin" ? "A" : "B";
  const ringHtml = updating
    ? `<div style="position:absolute;top:-7px;left:-7px;width:46px;height:46px;border-radius:50%;border:2px dashed ${color};opacity:0.7;animation:spin 2s linear infinite;"></div>`
    : '';
  return L.divIcon({
    html: `
      <style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>
      <div style="position:relative;width:32px;height:40px;">
        ${ringHtml}
        <div style="width:32px;height:32px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:${updating ? '3px dashed white' : '2.5px solid white'};box-shadow:0 3px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:${updating ? '0.75' : '1'};">
          <span style="transform:rotate(45deg);color:white;font-size:12px;font-weight:700;">${letter}</span>
        </div>
        <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:6px;height:6px;background:${color};border-radius:50%;opacity:0.6;"></div>
      </div>
    `,
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

/**
 * Tạo DivIcon "cập nhật vị trí" — hiển thị khi đã có routeAnalysis
 * nhưng user muốn thay đổi điểm A hoặc B (icon bút chì + viền nhấp nháy).
 */
export function createUpdateWaypointMarker(type: "origin" | "dest", isPicking = false): L.DivIcon {
  const color = type === "origin" ? "#16a34a" : "#dc2626";
  const letter = type === "origin" ? "A" : "B";
  // Pencil SVG inline
  const pencilSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>`;

  const pulseRing = isPicking
    ? `<div style="position:absolute;top:-8px;left:-8px;width:50px;height:50px;border-radius:50%;border:2.5px dashed ${color};animation:pulse-ring 1s ease-in-out infinite;"></div>`
    : `<div style="position:absolute;top:-5px;left:-5px;width:44px;height:44px;border-radius:50%;border:1.5px dashed ${color};opacity:0.5;"></div>`;

  return L.divIcon({
    html: `
      <style>
        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 1; }
          50%  { transform: scale(1.05); opacity: 0.7; }
          100% { transform: scale(0.9); opacity: 1; }
        }
      </style>
      <div style="position:relative;width:34px;height:44px;">
        ${pulseRing}
        <div style="
          width:34px;height:34px;
          background:${color};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2.5px solid white;
          box-shadow:0 3px 10px rgba(0,0,0,.5);
          display:flex;align-items:center;justify-content:center;
          opacity:${isPicking ? 0.8 : 1};
        ">
          <div style="transform:rotate(45deg);display:flex;flex-direction:column;align-items:center;gap:1px;">
            <span style="color:white;font-size:11px;font-weight:700;line-height:1;">${letter}</span>
            <div style="width:10px;height:10px;">${pencilSvg}</div>
          </div>
        </div>
        <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:6px;height:6px;background:${color};border-radius:50%;opacity:0.7;"></div>
      </div>
    `,
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -44],
  });
}

/** Gợi ý hành động theo LOS */
export function getDecisionAction(los: string): string {
  if (los === "congested") return "Phân luồng khẩn cấp – chuyển hướng lưu lượng";
  if (los === "heavy")     return "Điều chỉnh chu kỳ đèn – ưu tiên hướng bị ùn";
  return "Theo dõi liên tục";
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatDuration(s: number): string {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`;
}

function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toR = (v: number) => v * Math.PI / 180;
  const [la1, la2] = [toR(a[0]), toR(b[0])];
  const x =
    Math.sin(toR(b[0] - a[0]) / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(toR(b[1] - a[1]) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function distToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const l2 = dx * dx + dy * dy;
  if (!l2) return haversineDistance(p, a);
  const t = Math.max(0, Math.min(1, ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / l2));
  return haversineDistance(p, [a[0] + t * dy, a[1] + t * dx]);
}

/** Lọc camera trên tuyến đường (khoảng cách vuông góc tới segment ≤ thresholdM) */
export function findCamerasOnRoute(
  cameras: EnrichedCamera[],
  route: [number, number][],
  thresholdM = 12
): EnrichedCamera[] {
  return cameras.filter((cam) => {
    const p: [number, number] = [cam.lat, cam.lng];
    for (let i = 0; i < route.length - 1; i++) {
      if (distToSegment(p, route[i], route[i + 1]) <= thresholdM) return true;
    }
    return false;
  });
}

/** Kiểm tra tuyến đường có bị ùn tắc không */
export function hasCongestion(cameras: EnrichedCamera[]): boolean {
  return cameras.some(
    (c) =>
      c.status.current === "congested" ||
      c.status.current === "heavy" ||
      c.status.forecast === "congested" ||
      c.status.forecast === "heavy"
  );
}