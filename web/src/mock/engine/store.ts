/**
 * Store mock đơn giản, persist qua localStorage để các thao tác tạo/sửa/xoá trong lúc
 * demo (tạo báo cáo, train model, review quyết định...) vẫn còn nguyên sau khi reload.
 * Dữ liệu "sống" (camera realtime) KHÔNG dùng store này — xem mock/engine/camera-engine.ts.
 */

const PREFIX = "twms_mock_db:";

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / unavailable — bỏ qua, dữ liệu chỉ tồn tại trong phiên hiện tại */
  }
}

/** Lấy collection theo key; nếu chưa tồn tại thì khởi tạo từ `seed()` và lưu lại */
export function getOrSeed<T>(key: string, seed: () => T): T {
  const existing = read<T>(key);
  if (existing !== undefined) return existing;
  const seeded = seed();
  write(key, seeded);
  return seeded;
}

export function getCollection<T>(key: string): T | undefined {
  return read<T>(key);
}

export function setCollection<T>(key: string, value: T): void {
  write(key, value);
}

/** Xoá toàn bộ dữ liệu mock đã sinh — dùng khi muốn "làm mới" demo từ đầu */
export function resetMockDb(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
