export const LOS_MARKER_COLOR: Record<string, string> = {
  free_flow: "#22c55e",
  smooth:    "#3b82f6",
  moderate:  "#eab308",
  heavy:     "#f97316",
  congested: "#ef4444",
};

export const LOS_BADGE_CLASS: Record<string, string> = {
  free_flow: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  smooth:    "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  moderate:  "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  heavy:     "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  congested: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

export const LOS_PRIORITY: Record<string, number> = {
  congested: 5, heavy: 4, moderate: 3, smooth: 2, free_flow: 1, unknown: 0,
};

export const GTI_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#ef4444"] as const;
export const GTI_LABELS = ["Thông thoáng", "Bình thường", "Bắt đầu kẹt xe", "Nguy cơ kẹt xe"] as const;
export const GTI_RANGES = ["0–30%", "31–60%", "61–85%", ">85%"] as const;

export const FORECAST_KEYS = ["5m", "10m", "15m", "30m", "60m"] as const;

/** Phương tiện di chuyển hỗ trợ OSRM */
export const TRAVEL_MODES = [
  { key: "cycling", label: "Xe máy", icon: "" },
  { key: "driving", label: "Ô tô",             icon: "" },
  { key: "foot",    label: "Đi bộ", icon: "" },
] as const;

export type TravelMode = typeof TRAVEL_MODES[number]["key"];