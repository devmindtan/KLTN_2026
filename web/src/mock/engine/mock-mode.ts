/**
 * Mock Mode — bật/tắt nguồn dữ liệu mock ngay trong UI (Settings), không cần build lại.
 * Khi bật: toàn bộ API nghiệp vụ (camera, forecast, model, báo cáo, quyết định, thư viện
 * dữ liệu, tài liệu, traffic pattern/history) được phục vụ từ bộ sinh dữ liệu giả lập
 * thay vì gọi backend thật. Auth (đăng nhập/đăng xuất) KHÔNG bị ảnh hưởng — luôn dùng API thật.
 */

const STORAGE_KEY = "twms_mock_mode_enabled";

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

export function isMockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Bật/tắt mock mode. `reload=true` (mặc định) sẽ tải lại trang để khởi tạo lại
 * Socket/Contexts theo đúng nguồn dữ liệu mới — đơn giản & chắc chắn hơn việc
 * rewire realtime state khi đang chạy.
 */
export function setMockEnabled(value: boolean, reload = true): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
  listeners.forEach((l) => l(value));
  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

export function onMockModeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Đường dẫn API không bao giờ bị mock — auth luôn dùng backend thật */
export function isMockExemptPath(path: string): boolean {
  return path.startsWith("/api/auth/");
}
