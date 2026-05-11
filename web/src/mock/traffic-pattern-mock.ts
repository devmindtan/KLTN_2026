/**
 * Mock data cho chart giao động mật độ giao thông
 * Mô phỏng pattern thực tế của TP.HCM: cao điểm 7-9h và 17-19h
 */

export interface TrafficPatternPoint {
  label: string;
  avg_vehicles: number;
  max_vehicles: number;
}

export interface TrafficPatternMock {
  byHour: TrafficPatternPoint[];
  byDow: TrafficPatternPoint[];
  byWeekOfMonth: TrafficPatternPoint[];
  byMonth: TrafficPatternPoint[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Thêm jitter ngẫu nhiên nhỏ để mock data trông tự nhiên hơn */
const jitter = (base: number, range: number) =>
  Math.round(base + (Math.random() - 0.5) * range);

// ─── Dữ liệu theo GIỜ trong ngày (24 giờ) ───────────────────────────────────
// Pattern: Thấp đêm (0-5h), tăng mạnh 6-8h (đi làm), ổn định trưa, spike 17-19h (tan tầm)

const hourlyBase = [
  4, 3, 3, 4, 6, 18,  // 00h - 05h (đêm khuya → tờ mờ sáng)
  52, 87, 92, 74, 58, 61, // 06h - 11h (cao điểm sáng)
  68, 62, 58, 65, 78, 93, // 12h - 17h (buổi chiều → bắt đầu tan tầm)
  95, 88, 70, 52, 32, 14, // 18h - 23h (tan tầm → về khuya)
];

const byHour: TrafficPatternPoint[] = hourlyBase.map((base, i) => ({
  label: `${String(i).padStart(2, "0")}:00`,
  avg_vehicles: jitter(base, 8),
  max_vehicles: Math.round(base * 1.55 + Math.random() * 10),
}));

// ─── Dữ liệu theo NGÀY trong tuần ────────────────────────────────────────────
// Pattern: T2 và T6 cao nhất, Cuối tuần thấp hơn ~30%

const byDow: TrafficPatternPoint[] = [
  { label: "Thứ 2", avg_vehicles: 78, max_vehicles: 134 },
  { label: "Thứ 3", avg_vehicles: 72, max_vehicles: 121 },
  { label: "Thứ 4", avg_vehicles: 71, max_vehicles: 118 },
  { label: "Thứ 5", avg_vehicles: 75, max_vehicles: 127 },
  { label: "Thứ 6", avg_vehicles: 82, max_vehicles: 138 },
  { label: "Thứ 7", avg_vehicles: 58, max_vehicles: 99 },
  { label: "CN",    avg_vehicles: 47, max_vehicles: 84 },
].map((d) => ({
  ...d,
  avg_vehicles: jitter(d.avg_vehicles, 6),
  max_vehicles: jitter(d.max_vehicles, 8),
}));

// ─── Dữ liệu theo TUẦN trong tháng ───────────────────────────────────────────
// Pattern: Tuần 1-2 cao (đầu tháng đi làm nhiều), Tuần 4 thấp hơn (gần cuối tháng)

const byWeekOfMonth: TrafficPatternPoint[] = [
  { label: "Tuần 1", avg_vehicles: jitter(74, 6), max_vehicles: jitter(128, 10) },
  { label: "Tuần 2", avg_vehicles: jitter(72, 6), max_vehicles: jitter(122, 10) },
  { label: "Tuần 3", avg_vehicles: jitter(68, 6), max_vehicles: jitter(115, 10) },
  { label: "Tuần 4", avg_vehicles: jitter(65, 6), max_vehicles: jitter(110, 10) },
];

// ─── Dữ liệu theo THÁNG trong năm ────────────────────────────────────────────
// Pattern: Tháng 1-2 thấp (Tết), Tháng 4-12 ổn định, Tháng 9-11 cao nhất

const byMonth: TrafficPatternPoint[] = [
  { label: "T1",  avg_vehicles: 42, max_vehicles: 98 },   // Tết
  { label: "T2",  avg_vehicles: 55, max_vehicles: 107 },  // Sau Tết
  { label: "T3",  avg_vehicles: 68, max_vehicles: 118 },
  { label: "T4",  avg_vehicles: 72, max_vehicles: 122 },
  { label: "T5",  avg_vehicles: 74, max_vehicles: 126 },
  { label: "T6",  avg_vehicles: 71, max_vehicles: 120 },
  { label: "T7",  avg_vehicles: 69, max_vehicles: 117 },
  { label: "T8",  avg_vehicles: 73, max_vehicles: 123 },
  { label: "T9",  avg_vehicles: 79, max_vehicles: 131 },  // Khai giảng
  { label: "T10", avg_vehicles: 81, max_vehicles: 134 },
  { label: "T11", avg_vehicles: 78, max_vehicles: 128 },
  { label: "T12", avg_vehicles: 65, max_vehicles: 112 },  // Lễ cuối năm
].map((d) => ({
  ...d,
  avg_vehicles: jitter(d.avg_vehicles, 5),
  max_vehicles: jitter(d.max_vehicles, 8),
}));

// ─── Export: Tất cả cameras (aggregate) ──────────────────────────────────────

export const mockAllCameras: TrafficPatternMock = {
  byHour,
  byDow,
  byWeekOfMonth,
  byMonth,
};

// ─── Export: Mock riêng cho 3 loại camera điển hình ──────────────────────────

/** Camera ở đường đi làm: cao điểm sáng + chiều rõ rệt */
const mockOfficeRoad: TrafficPatternMock = {
  byHour: hourlyBase.map((base, i) => ({
    label: `${String(i).padStart(2, "0")}:00`,
    avg_vehicles: jitter(Math.round(base * 1.15), 6),
    max_vehicles: Math.round(base * 1.7),
  })),
  byDow: byDow.map((d) => ({
    ...d,
    avg_vehicles: Math.round(d.avg_vehicles * 1.1),
    max_vehicles: Math.round(d.max_vehicles * 1.1),
  })),
  byWeekOfMonth,
  byMonth,
};

/** Camera ở khu dân sinh: phân bố đều hơn trong ngày */
const mockResidential: TrafficPatternMock = {
  byHour: hourlyBase.map((base, i) => ({
    label: `${String(i).padStart(2, "0")}:00`,
    avg_vehicles: jitter(Math.round(base * 0.7 + 12), 5),
    max_vehicles: Math.round(base * 1.2 + 8),
  })),
  byDow: byDow.map((d) => ({
    ...d,
    avg_vehicles: jitter(Math.round(d.avg_vehicles * 0.85), 5),
    max_vehicles: Math.round(d.max_vehicles * 0.85),
  })),
  byWeekOfMonth,
  byMonth,
};

/** Camera ở khu thương mại: chiều + tối cao hơn sáng */
const mockCommercial: TrafficPatternMock = {
  byHour: hourlyBase.map((base, i) => {
    const commercialBase = i >= 10 && i <= 21 ? base * 1.2 : base * 0.5;
    return {
      label: `${String(i).padStart(2, "0")}:00`,
      avg_vehicles: jitter(Math.round(commercialBase), 6),
      max_vehicles: Math.round(commercialBase * 1.5),
    };
  }),
  byDow: byDow.map((d, i) => ({
    ...d,
    // Cuối tuần cao hơn ngày thường tại khu thương mại
    avg_vehicles: jitter(i >= 5 ? Math.round(d.avg_vehicles * 1.3) : d.avg_vehicles, 5),
    max_vehicles: i >= 5 ? Math.round(d.max_vehicles * 1.3) : d.max_vehicles,
  })),
  byWeekOfMonth,
  byMonth,
};

// Map camera_id → mock data (dùng 3 cameras thực từ camera_data trong DB)
export const mockByCameraId: Record<string, TrafficPatternMock> = {
  "5d9ddd49766c880017188c94": mockOfficeRoad,     // Nút giao Hàng Xanh 1
  "662b86c41afb9c00172dd31c": mockResidential,    // Trần Quang Khải
  "649da77ea6068200171a6dd4": mockCommercial,     // Tôn Đức Thắng - Mê Linh
};

/** Danh sách camera để hiển thị trong dropdown */
export const mockCameraList = [
  { id: "5d9ddd49766c880017188c94", name: "Nút giao Hàng Xanh 1 (Viện Máy tính)" },
  { id: "5d9ddec9766c880017188c9c", name: "Nút giao Hàng Xanh 5 (Hàng Xanh - Bạch Đằng)" },
  { id: "662b86c41afb9c00172dd31c", name: "Trần Quang Khải - Trần Khắc Chân" },
  { id: "649da77ea6068200171a6dd4", name: "Tôn Đức Thắng - Công trường Mê Linh" },
  { id: "662b857b1afb9c00172dd106", name: "Điện Biên Phủ - Nguyễn Bỉnh Khiêm" },
  { id: "5a6065c58576340017d06615", name: "Tô Ngọc Vân – TX25" },
];
