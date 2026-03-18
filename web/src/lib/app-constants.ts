/**
 * app-constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH cho toàn bộ UI terminology.
 * Bao gồm: LOS labels, Metric labels, Time labels, Job status, Trend,
 *          Page titles, Camera labels, Common UI feedback text.
 *
 * Quy tắc:
 *  • Muốn đổi nhãn → chỉ sửa file này hoặc .env.local, KHÔNG sửa trong component.
 *  • Muốn thêm từ mới → thêm vào đây + cập nhật assets/ideas/ui-terminology-refactor-design.md.
 *  • Các nhãn có thể override qua VITE env được đánh dấu: ?? "fallback".
 * ─────────────────────────────────────────────────────────────────────────────
 */


// ─── Primitive building blocks ───────────────────────────────────────────────
/** Một mục term cơ bản: tiêu đề, mô tả phụ, tooltip */
interface Term {
  title: string;
  description?: string;
  tooltips?: string;
}

interface CONNECTION_STATUS {
  label: string;
  color: string;
  theme?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const DASHBOARD_TERM = {
  page_header: {
    title: "Tổng quan",
    description: "Giám sát lưu lượng giao thông theo thời gian thực",
  },
  tab1: { title: "Tổng quan" },
  tab2: { title: "Dự báo" },
  card1: {
    title: "Tổng phương tiện",
    description: "Phát hiện thời gian thực",
    tooltips: "Tổng số phương tiện được phát hiện trên toàn bộ camera đang hoạt động",
  },
  card2: {
    title: "Máy quay hoạt động",
    tooltips: "Số camera đang gửi dữ liệu về hệ thống. Mỗi camera được phân loại theo mức độ giao thông LOS.",
  },
  card3: {
    title: "Tình trạng giao thông",
    tooltips: "Số camera ở trạng thái thông thoáng (LOS A-B). Thanh màu phản ánh tỉ lệ xanh/vàng/đỏ.",
  },
  card4: {
    title: "Xu hướng mạng lưới",
    tooltips: "Tỉ lệ % camera đang có xu hướng tăng lưu lượng so với chu kỳ trước.",
  },
  card5: {
    title: "Độ tin cậy dự đoán",
    description: "Tỷ lệ dự đoán sai số ≤5 xe theo mốc",
  },
  chart1: {
    title: "Dự báo lưu lượng giao thông",
    description: "Dự đoán số lượng phương tiện các mốc 5/10/15/30/60 phút",
  },
  chart2: {
    title: "Giao động mật độ giao thông trong ngày",
    description: "Phân tích lưu lượng trung bình theo chu kỳ thời gian",
  },
  chart3: {
    title: "Cuốn chiếu – 5 mốc thời gian",
    description: "Hiển thị từ 07:00 đến hiện tại (dự báo 60p tương lai đến 23:00). Quá khứ: 5 horizon bám thực tế.",
  },
  table1: {
    title: "Nguồn máy quay trực tiếp",
    description: "Giám sát luồng giao thông thời gian thực",
  },
} satisfies Record<string, Term>;

// ─── Monitoring ──────────────────────────────────────────────────────────────
export const MONITORING_TERM = {
  page_header: {
    title: "Giám sát lưu lượng thời gian thực",
    description: "Theo dõi lưu lượng giao thông tại các điểm quan trọng trong thành phố",
  },
} satisfies Record<string, Term>;

// ─── Analytics ───────────────────────────────────────────────────────────────
export const ANALYTICS_TERM = {
  page_header: {
    title: "Phân tích hiệu suất mô hình",
    description: "Theo dõi độ chính xác dự đoán từ dữ liệu lịch sử",
  },
  card1: {
    title: "MAE",
    description: "Sai số tuyệt đối trung bình",
    tooltips: "Mean Absolute Error - Sai số tuyệt đối trung bình. Đo lường chênh lệch trung bình giữa giá trị dự đoán và thực tế theo số xe."
  },
  card2: {
    title: "MAPE",
    description: "Sai số phần trăm trung bình",
    tooltips: "Mean Absolute Percentage Error - Sai số phần trăm tuyệt đối trung bình. Tiện ích để so sánh chất lượng dự đoán giữa các camera khác nhau."
  },
  card3: {
    title: "Accuracy ≤ 5xe",
    description: "Tỷ lệ dự đoán trong ±5 xe",
    tooltips: "Tỷ lệ % dự đoán có sai số trong phạm vi ±5 xe. Chiềm 75% trở lên được coi là tốt."
  },
  card4: {
    title: "Trend Accuracy",
    description: "Độ chính xác dự đoán xu hướng",
    tooltips: "Độ chính xác khi dự đoán xu hướng tăng/giảm/ổn định của lưu lượng giao thông. Hữu ích cho việc ra quyết định vận hành."
  },
  card5: {
    title: "Độ tin cậy dự đoán",
    description: "",
    tooltips: "Đánh giá chất lượng dữ liệu đầu vào (input samples) so với dữ liệu quá khứ (LAG samples) để xác định độ tin cậy của dự đoán."
  },
  card6: {
    title: "Độ tin cậy sai số",
    description: "",
    tooltips: "Đánh giá độ khớp giữa dữ liệu đầu vào khi dự đoán và dữ liệu thực tế khi đồng bộ, ảnh hưởng đến độ tin cậy của error value."
  },
  table1: {
    title: "So sánh theo các mốc",
  },
  table2: {
    title: "Top 5 khu vực (máy quay) tốt nhất",
  },
  table3: {
    title: "Top 5 khu vực (máy quay) thấp nhất",
  },
  table4: {
    title: "Lịch sử kiểm tra gần đây",
    description: "Dữ liệu được lưu định kỳ để hiển thị quá khứ"
  }

} satisfies Record<string, Term>;

// ─── Models ──────────────────────────────────────────────────────────────────
export const MODELS_TERM = {
  page_header: {
    title: "Danh sách mô hình",
    description: "Quản lý và theo dõi các mô hình dự đoán lưu lượng giao thông",
  },
} satisfies Record<string, Term>;

// ─── Data Library ────────────────────────────────────────────────────────────
export const DATA_LIBRARY_TERM = {
  page_header: {
    title: "Thư viện dữ liệu",
    description: "Quản lý và truy cập các bộ sưu tập dữ liệu giao thông",
  },
} satisfies Record<string, Term>;

// ─── Reports & Forecasts ────────────────────────────────────────────────────
export const REPORTS_TERM = {
  page_header: {
    title: "Báo cáo",
    description: "Quản lý và tải xuống báo cáo lưu lượng giao thông",
  },
} satisfies Record<string, Term>;

// ─── Search ──────────────────────────────────────────────────────────────────
export const SEARCH_TERM = {
  page_header: {
    title: "Tìm kiếm",
    description: "Tìm kiếm camera, mô hình, báo cáo và dự báo giao thông",
  },
} satisfies Record<string, Term>;

// ─── Word Assistant ──────────────────────────────────────────────────────────
export const WORD_ASSISTANT_TERM = {
  page_header: {
    title: "Hỗ trợ ra quyết định",
    description: "Khuyến nghị tự động dựa trên phân tích AI và dự đoán lưu lượng",
  },
} satisfies Record<string, Term>;

// ─── Settings / Help / Team ─────────────────────────────────────────────────
export const SETTINGS_TERM = {
  page_header: {
    title: "Cài đặt",
    description: "Quản lý tài khoản và tùy chọn hệ thống",
  },
} satisfies Record<string, Term>;

export const HELP_TERM = {
  page_header: {
    title: "Trung tâm hỗ trợ",
    description: "Tài liệu, hướng dẫn và hỗ trợ kỹ thuật",
  },
} satisfies Record<string, Term>;

export const TEAM_TERM = {
  page_header: {
    title: "Đội ngũ phát triển",
    description: "Thành viên tham gia dự án phát triển phần mềm đoán lưu lượng giao thông",
  },
} satisfies Record<string, Term>;

export const CONNECTION_STATUS: Record<string, CONNECTION_STATUS> = {
  connected: {
    label: "Đang kết nối",
    color: "size-1.5 mr-2 rounded-full bg-green-500",
    theme: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400"
  },
  disconnected: {
    label: "Mất kết nối",
    color: "size-1.5 mr-2 rounded-full bg-red-500",
    theme: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400"
  }
};

export const TREND_LABEL: Record<string, string> = {
  increasing: "Tăng",
  decreasing: "Giảm",
  stable:     "Ổn định",
};

/** Các term gắn với phương tiện (xe) - không trùng với LOS_LABEL / METRIC_LABELS / TIME_LABEL */
export const GENERAL_TERM = {
  car:      "xe lớn",
  motobike: "xe nhỏ",
  vehicle:  "xe",
  camera:   "máy quay",
  increase: "tăng",
  decrease: "giảm",
  vc_ratio: "Mức tải V/C",
} as const;

// ─── 1. LOS — Level of Service ───────────────────────────────────────────────
// Canonical keys: free_flow | smooth | moderate | heavy | congested
// Override qua: VITE_LOS_FREE_FLOW, VITE_LOS_SMOOTH, VITE_LOS_MODERATE,
//               VITE_LOS_HEAVY, VITE_LOS_CONGESTED

/** Map LOS key → nhãn tiếng Việt hiển thị */
export const LOS_LABEL: Record<string, string> = {
  free_flow: import.meta.env.VITE_LOS_FREE_FLOW ?? "Thông thoáng",
  smooth:    import.meta.env.VITE_LOS_SMOOTH    ?? "Trôi chảy",
  moderate:  import.meta.env.VITE_LOS_MODERATE  ?? "Vừa phải",
  heavy:     import.meta.env.VITE_LOS_HEAVY     ?? "Đông đúc",
  congested: import.meta.env.VITE_LOS_CONGESTED ?? "Ùn tắc",
};

/**
 * Trả về nhãn tiếng Việt cho trạng thái LOS.
 * @param status - Canonical LOS key
 * @param fallback - Fallback nếu key không khớp (mặc định: "Không rõ")
 */
export function getLOSLabel(status: string, fallback = "Không rõ"): string {
  return LOS_LABEL[status] ?? fallback;
}

// ─── 2. ML Metric Labels ─────────────────────────────────────────────────────
// Override qua: VITE_METRIC_MAE, VITE_METRIC_MAPE, VITE_METRIC_RMSE,
//               VITE_METRIC_R2, VITE_METRIC_ACC5, VITE_METRIC_TREND_ACC

/** Tên ngắn của các metric dùng trong chip, table header, chart axis */
export const METRIC_LABELS = {
  MAE:        import.meta.env.VITE_METRIC_MAE       ?? "MAE",
  MAPE:       import.meta.env.VITE_METRIC_MAPE      ?? "MAPE",
  RMSE:       import.meta.env.VITE_METRIC_RMSE      ?? "RMSE",
  R2:         import.meta.env.VITE_METRIC_R2        ?? "R²",
  ACC_5:      import.meta.env.VITE_METRIC_ACC5      ?? "Accuracy ≤5xe",
  TREND_ACC:  import.meta.env.VITE_METRIC_TREND_ACC ?? "Trend Accuracy",
  SAMPLES:    "Mẫu huấn luyện",
} as const;

/** Mô tả chi tiết metric dùng trong tooltip */
export const METRIC_DESCRIPTIONS: Record<keyof typeof METRIC_LABELS, string> = {
  MAE:        "Sai số tuyệt đối trung bình (xe / 5 phút). Càng thấp càng tốt.",
  MAPE:       "Sai số phần trăm trung bình. Càng thấp càng tốt.",
  RMSE:       "Căn bậc hai sai số bình phương trung bình. Nhạy với outlier.",
  R2:         "Hệ số xác định — độ khớp tổng thể mô hình (0–1, càng cao càng tốt).",
  ACC_5:      "Tỷ lệ dự đoán có sai số trong phạm vi ±5 xe.",
  TREND_ACC:  "Độ chính xác dự đoán xu hướng tăng / giảm của lưu lượng.",
  SAMPLES:    "Số lượng bản ghi lịch sử dùng để huấn luyện mô hình.",
};

// ─── 3. Time Interval Labels ─────────────────────────────────────────────────
// Key nội bộ → nhãn hiển thị. Prefix "f" = forecast window.

/** Map key khoảng thời gian → nhãn tiếng Việt */
export const TIME_LABEL: Record<string, string> = {
  "5m":  "5 phút",
  "10m": "10 phút",
  "15m": "15 phút",
  "30m": "30 phút",
  "60m": "60 phút",
  // Forecast windows (prefix f)
  "f5m":  "Dự báo 5 phút",
  "f10m": "Dự báo 10 phút",
  "f15m": "Dự báo 15 phút",
  "f30m": "Dự báo 30 phút",
  "f60m": "Dự báo 60 phút",
};

/**
 * Trả về nhãn khoảng thời gian.
 * @param key - Key nội bộ (5m, 10m, f5m, ...)
 * @param fallback - Fallback nếu key không khớp (mặc định: key gốc)
 */
export function getTimeLabel(key: string, fallback?: string): string {
  return TIME_LABEL[key] ?? fallback ?? key;
}

// ─── 4. Model Job Status Labels ──────────────────────────────────────────────
// Canonical keys khớp với giá trị API trả về.

/** Map job status → nhãn tiếng Việt + màu badge (Tailwind class) */
export const JOB_STATUS: Record<string, { label: string; color: string }> = {
  running:   { label: "Đang chạy",   color: "bg-blue-50 text-blue-700 border-blue-200"   },
  succeeded: { label: "Thành công",  color: "bg-green-50 text-green-700 border-green-200" },
  failed:    { label: "Thất bại",    color: "bg-red-50 text-red-700 border-red-200"       },
  pending:   { label: "Chờ xử lý",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

/**
 * Trả về nhãn tiếng Việt của job status.
 * @param status - Canonical job status key
 */
export function getJobStatusLabel(status: string): string {
  return JOB_STATUS[status]?.label ?? status;
}

// ─── 5. Trend Labels ─────────────────────────────────────────────────────────
// Canonical keys: increasing | decreasing | stable

/** Map xu hướng → nhãn tiếng Việt */


/**
 * Trả về nhãn xu hướng.
 * @param trend - Canonical trend key
 */
export function getTrendLabel(trend: string, fallback = "—"): string {
  return TREND_LABEL[trend] ?? fallback;
}

// ─── 6. Traffic Domain Terms ─────────────────────────────────────────────────
// Các thuật ngữ chuyên ngành giao thông xuất hiện rải rác trên UI.

export const TRAFFIC_TERMS = {
  VEHICLES:             "Phương tiện",
  VEHICLE_COUNT:        "Tổng phương tiện",
  FLOW_RATE:            "Lưu lượng",
  FLOW_RATE_HOURLY:     "Lưu lượng theo giờ",
  PEAK_HOUR:            "Giờ cao điểm",
  VC_RATIO:             "Mức tải V/C",
  FORECAST_SLOT:        "Thời điểm dự báo",
  UNIT_PER_HOUR:        "xe/h",
  UNIT_VEHICLE:         "xe",
} as const;

// ─── 7. Forecast Terms ───────────────────────────────────────────────────────

export const FORECAST_TERMS = {
  FORECAST:       "Dự báo",
  ACTUAL:         "Thực tế",
  CURRENT:        "Hiện tại",
  PAST:           "Quá khứ",
  FUTURE:         "Tương lai",
  ROLLING:        "Cuốn chiếu",
  FORECAST_FULL:  "Dự báo lưu lượng giao thông",
  FORECAST_5M:    "Dự Báo 5 Phút",
  DETECT_AND_FORECAST: "Phát hiện & Dự báo",
} as const;

// ─── 8. Page Titles ──────────────────────────────────────────────────────────
// Override qua: VITE_PAGE_DASHBOARD, VITE_PAGE_MONITORING, v.v.

/** Tiêu đề trang dùng trong sidebar, page header, breadcrumb */
export const PAGE_TITLES = {
  DASHBOARD:    import.meta.env.VITE_PAGE_DASHBOARD    ?? "Tổng quan",
  MONITORING:   import.meta.env.VITE_PAGE_MONITORING   ?? "Giám sát lưu lượng",
  ANALYTICS:    import.meta.env.VITE_PAGE_ANALYTICS    ?? "Phân tích mô hình",
  MODELS:       import.meta.env.VITE_PAGE_MODELS       ?? "Danh sách mô hình",
  DATA_LIBRARY: import.meta.env.VITE_PAGE_DATA_LIBRARY ?? "Dữ liệu giao thông",
  REPORTS:      import.meta.env.VITE_PAGE_REPORTS      ?? "Báo cáo giao thông",
  SEARCH:       import.meta.env.VITE_PAGE_SEARCH       ?? "Tìm kiếm nhanh",
  DOCS:         "Tài liệu hướng dẫn",
  HELP:         "Liên hệ & Hướng dẫn",
  TEAM:         "Đội ngũ phát triển",
  SETTINGS:     "Cài đặt",
} as const;

// ─── 9. Camera Labels ────────────────────────────────────────────────────────

export const CAMERA_LABELS = {
  CAMERA:         "Máy quay",
  ACTIVE:         "Máy quay hoạt động",
  SELECT:         "Chọn máy quay",
  ALL:            "Tất cả máy quay",
  ALL_AVERAGE:    "Toàn mạng lưới",
  ID:             "Mã máy quay",
  NAME:           "Tên máy quay",
  LIST:           "Danh sách máy quay",
  MONITOR_TITLE:  "Giám sát lưu lượng",
  NOT_FOUND:      "Không tìm thấy máy quay nào nào",
  OFFLINE_MSG:    "Máy quay mất kết nối — kiểm tra kết nối mạng và nguồn điện",
  SEARCH_HINT:    "Tìm máy quay, mã ID...",
} as const;

// ─── 10. Common UI Labels ────────────────────────────────────────────────────
// Text phản hồi, trạng thái loading, empty state dùng chung toàn UI.

export const UI_LABELS = {
  // Loading states
  LOADING:           "Đang tải dữ liệu...",
  LOADING_FORECAST:  "Đang tải dữ liệu dự báo...",
  WAIT_CONNECTION:   "Vui lòng đợi kết nối với hệ thống",

  // Empty / error states
  NOT_FOUND:         "Không tìm thấy",
  NO_DATA:           "N/A",
  UNKNOWN:           "Không rõ",
  NO_REPORT:         "Không tìm thấy báo cáo nào",

  // Actions
  ALL:               "Tất cả",
  DETAIL:            "Xem chi tiết",
  QUICK_VIEW:        "Xem nhanh",
  CLEAR_FILTER:      "Xóa bộ lọc",
  SEARCH:            "Tìm kiếm...",

  // Filter hints
  FILTER_HINT:       "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm",
  SEARCH_HINT_GLOBAL: "Thử tìm: tên camera, phiên bản mô hình, báo cáo",

  // Comparison
  AVERAGE:           "Trung bình",
  VS_BASE:           "Δ vs Cơ sở",
  COMPARE_BY:        "So sánh theo các mốc",
} as const;
