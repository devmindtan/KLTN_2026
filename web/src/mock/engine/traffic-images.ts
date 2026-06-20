/**
 * traffic-images.ts
 * ------------------------------------------------------------------
 * Cấp ảnh giao thông THẬT theo từng camera, lấy từ thư mục local
 * src/mock/mock-cameras/<cam_id>/*.jpg — KHÔNG dùng URL ảnh stock
 * ngoài (Unsplash/placehold.co) nữa.
 *
 * Chuẩn bị dữ liệu: chỉ cần bỏ ảnh vào đúng thư mục, không cần build/script
 * gì thêm — Vite's import.meta.glob tự quét toàn bộ ảnh lúc dev/build:
 *        src/mock/mock-cameras/<cam_id>/anh1.jpg
 *        src/mock/mock-cameras/<cam_id>/anh2.jpg
 *        ...
 * Thêm/xoá ảnh vào thư mục rồi chạy lại `npm run dev` là nhận ngay, không
 * cần sinh manifest.json thủ công.
 *
 * Cách hoạt động lúc runtime:
 *   - Mỗi camera có 1 "con trỏ" (cursor) trỏ vào 1 ảnh trong danh sách ảnh của nó.
 *   - Mỗi lần tick() được gọi (xem camera-engine.ts), có 25% xác suất cursor
 *     nhích sang ảnh kế tiếp -> tạo cảm giác ảnh "đang chạy" theo thời gian,
 *     không đứng yên nhưng cũng không nháy liên tục.
 *   - Nếu camera không có ảnh nào (chưa tải ảnh cho cam đó), trả về ảnh
 *     placeholder màu theo LOS để không vỡ giao diện.
 */
import type { LosLevel } from "@/services/forecast.service";

// Vite quét toàn bộ ảnh khớp pattern lúc build/dev, trả về map "đường dẫn file" -> "URL đã build".
// eager: true để lấy URL ngay (string), không cần import động/await.
const imageModules = import.meta.glob<{ default: string }>(
  "../mock-cameras/*/*.{jpg,jpeg,png,webp}",
  { eager: true }
);

/**
 * Gom danh sách ảnh theo cam_id từ kết quả glob.
 * Key gốc có dạng: "../mock-cameras/<cam_id>/<file>.jpg"
 */
function buildImageManifest(): Record<string, string[]> {
  const manifest: Record<string, string[]> = {};
  for (const [filePath, mod] of Object.entries(imageModules)) {
    const match = filePath.match(/mock-cameras\/([^/]+)\/[^/]+\.(?:jpg|jpeg|png|webp)$/i);
    if (!match) continue;
    const camId = match[1];
    if (!manifest[camId]) manifest[camId] = [];
    manifest[camId].push(mod.default);
  }
  // sắp xếp để thứ tự ổn định giữa các lần chạy
  Object.values(manifest).forEach((arr) => arr.sort());
  return manifest;
}

const IMAGE_MANIFEST: Record<string, string[]> = buildImageManifest();

// Lưu offset hiện tại của từng camera, để xoay vòng ảnh mượt qua các lần tick
const camCursor = new Map<string, number>();

const LOS_COLOR_HEX: Record<LosLevel, string> = {
  free_flow: "16a34a",
  smooth: "0ea5e9",
  moderate: "eab308",
  heavy: "f97316",
  congested: "dc2626",
};

/** Ảnh dự phòng khi camera chưa có ảnh thật nào trong manifest (tránh vỡ UI khi demo thiếu ảnh) */
function fallbackImageUrl(camId: string, los: LosLevel): string {
  const bg = LOS_COLOR_HEX[los] ?? "475569";
  return `https://placehold.co/640x360/${bg}/ffffff?text=${encodeURIComponent(camId)}`;
}

/**
 * Trả về URL ảnh giao thông thật (local) cho 1 camera.
 * `los` hiện chưa dùng để CHỌN ảnh (vì ảnh là ảnh thật cố định của từng camera,
 * không phân loại theo mức kẹt xe) — chỉ dùng cho ảnh dự phòng khi thiếu ảnh.
 * Nếu sau này bạn phân loại ảnh theo mức độ kẹt xe trong từng thư mục con
 * (vd: <cam_id>/clear/, <cam_id>/congested/), có thể mở rộng hàm này để
 * chọn đúng thư mục con theo los.
 */
export function liveTrafficImageUrl(camId: string, los: LosLevel): string {
  const images = IMAGE_MANIFEST[camId];
  if (!images || images.length === 0) {
    return fallbackImageUrl(camId, los);
  }

  let cursor = camCursor.get(camId);
  if (cursor === undefined) {
    // Offset khởi tạo theo cam_id để các camera không đồng bộ cùng 1 ảnh lúc mới load
    cursor = hashString(camId) % images.length;
  } else if (Math.random() < 0.25) {
    cursor = (cursor + 1) % images.length;
  }
  camCursor.set(camId, cursor);

  return images[cursor];
}

/** Hash chuỗi đơn giản (FNV-1a rút gọn) -> số nguyên dương */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}