/**
 * Pattern lưu lượng giao thông mô phỏng theo giờ HCM: thấp về đêm, cao điểm sáng 7-9h
 * và chiều 17-19h. Dùng làm "load factor" (0..1) nhân với capacity từng camera để
 * sinh ra số liệu trông tự nhiên, nhất quán giữa các trang (dashboard, camera, forecast...).
 */

/** Hệ số tải theo từng giờ trong ngày (0h → 23h), đỉnh = 1.0 */
export const HOURLY_LOAD: number[] = [
  0.06, 0.04, 0.03, 0.04, 0.09, 0.24, // 00h-05h
  0.58, 0.9, 0.97, 0.78, 0.62, 0.65, // 06h-11h
  0.72, 0.66, 0.61, 0.69, 0.83, 0.98, // 12h-17h
  1.0, 0.88, 0.7, 0.5, 0.3, 0.15, // 18h-23h
];

/** Hệ số theo ngày trong tuần, index = Date.getUTCDay() (0=CN...6=Thứ 7) */
export const DOW_LOAD: number[] = [0.74, 0.95, 0.91, 0.9, 0.92, 1.0, 0.82];

/** Hệ số theo tuần trong tháng (1-5), đầu tháng cao hơn cuối tháng */
export const WEEK_OF_MONTH_LOAD: number[] = [1.0, 0.97, 0.93, 0.88, 0.8];

/** Hệ số theo tháng trong năm, index 0 = Tháng 1 */
export const MONTH_LOAD: number[] = [0.86, 0.97, 0.92, 0.9, 0.88, 0.85, 0.83, 0.87, 0.93, 0.96, 0.94, 0.78];

/** Giờ hiện tại theo VN timezone (UTC+7) */
export function vnNow(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

export function vnHourMinute(date: Date = vnNow()): { hour: number; minute: number } {
  return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

/** Hệ số tải nội suy tuyến tính giữa 2 mốc giờ, theo phút trong giờ đó */
export function loadFactorAt(hour: number, minute = 0): number {
  const h0 = HOURLY_LOAD[((hour % 24) + 24) % 24];
  const h1 = HOURLY_LOAD[((hour + 1) % 24 + 24) % 24];
  return h0 + (h1 - h0) * clamp01(minute / 60);
}

/** Hệ số tải tổng hợp tại một thời điểm cụ thể (giờ trong ngày × ngày trong tuần) */
export function combinedLoadFactor(date: Date): number {
  const { hour, minute } = vnHourMinute(date);
  const hourFactor = loadFactorAt(hour, minute);
  const dowFactor = DOW_LOAD[date.getUTCDay()];
  return hourFactor * dowFactor;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Phút trong ngày VN hiện tại, làm tròn xuống bước 5 phút (dùng cho rolling/history) */
export function currentVnMinuteOfDay(): number {
  const now = vnNow();
  const raw = now.getUTCHours() * 60 + now.getUTCMinutes();
  return Math.floor(raw / 5) * 5;
}

export function minuteToLabel(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
