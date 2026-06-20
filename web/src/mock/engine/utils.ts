/** Tiện ích dùng chung cho các bộ sinh dữ liệu mock */

export const rand = (min: number, max: number): number => Math.random() * (max - min) + min;

export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Thêm nhiễu ngẫu nhiên quanh `base` trong khoảng +/- range/2 */
export const jitter = (base: number, range: number): number => base + (Math.random() - 0.5) * range;

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Độ trễ ngẫu nhiên mô phỏng network latency, để mock vẫn có cảm giác "đang tải" */
export const networkDelay = (): Promise<void> => delay(randInt(150, 450));

let seq = 0;
export function genId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
