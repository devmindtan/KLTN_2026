/**
 * Kiểu dữ liệu, hằng số, và các hàm tiện ích dùng chung cho trang Search
 */
import type { ElementType } from "react";
import { LOS_LABEL as _LOS_LABEL } from "@/lib/app-constants";
import {
  IconCameraPlus,
  IconBrain,
  IconFileText,
  IconChartBar,
  IconRefresh,
  IconMapPin,
  IconSearch,
  IconBook,
} from "@tabler/icons-react";
import type { CameraInfo } from "@/services/camera.service";
import type { ForecastRollingResponse } from "@/services/forecast.service";
import type { MLModelMetadata } from "@/services/model.service";
import type { HelpArticle } from "@/services/help.service";
import type { SmartReport } from "@/services/reports.service";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ResultType = "camera" | "model" | "report" | "forecast" | "doc";

export interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  status?: "online" | "offline" | "warning";
  details?: Record<string, string | number | boolean | undefined>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
/** Re-export từ @/lib/los-config – single source of truth */
export const LOS_LABELS = _LOS_LABEL;

// export const MOCK_REPORT_FORECAST: SearchResult[] = [
//   {
//     id: "r1",
//     type: "report",
//     title: "Báo cáo lưu lượng tháng 2/2026",
//     subtitle: "Tổng 2.4M lượt • Giờ cao điểm: 17:00–19:00",
//     meta: "Tạo: 01/03/2026",
//     badge: "PDF",
//     badgeVariant: "outline",
//   },
//   {
//     id: "r2",
//     type: "report",
//     title: "Báo cáo mô hình LSTM tháng 2",
//     subtitle: "Accuracy: 94.2% • 28 ngày dữ liệu",
//     meta: "Tạo: 28/02/2026",
//     badge: "PDF",
//     badgeVariant: "outline",
//   },
//   {
//     id: "r3",
//     type: "report",
//     title: "Tổng hợp sự cố tháng 1/2026",
//     subtitle: "12 sự kiện ùn tắc • 3 camera offline",
//     meta: "Tạo: 01/02/2026",
//     badge: "Docs",
//     badgeVariant: "outline",
//   },
//   {
//     id: "f1",
//     type: "forecast",
//     title: "Dự báo 17:00–18:00 hôm nay",
//     subtitle: "Cầu Sài Gòn: 480 xe/giờ • Nguy cơ ùn tắc cao",
//     meta: "Độ tin cậy: 91%",
//     badge: "Nguy cơ cao",
//     badgeVariant: "destructive",
//   },
//   {
//     id: "f2",
//     type: "forecast",
//     title: "Dự báo 08:00–09:00 mai",
//     subtitle: "Ngã tư Bến Thành: 310 xe/giờ • Bình thường",
//     meta: "Độ tin cậy: 87%",
//     badge: "Bình thường",
//     badgeVariant: "default",
//   },
//   {
//     id: "f3",
//     type: "forecast",
//     title: "Dự báo cuối tuần 14–15/03",
//     subtitle: "Toàn mạng lưới: giảm 35% so với ngày thường",
//     meta: "Độ tin cậy: 82%",
//     badge: "Thấp điểm",
//     badgeVariant: "secondary",
//   },
// ];

export const QUICK_ACTIONS: {
  key:
    | "refresh_camera"
    | "active_model"
    | "open_monitoring"
    | "open_reports_today";
  label: string;
  icon: ElementType;
  desc: string;
}[] = [
  {
    key: "refresh_camera",
    label: "Làm mới dữ liệu máy quay",
    icon: IconRefresh,
    desc: "Làm mới toàn bộ dữ liệu máy quay",
  },
  {
    key: "active_model",
    label: "Xem mô hình đang hoạt động",
    icon: IconBrain,
    desc: "Lọc nhanh danh sách mô hình đang dùng",
  },
  {
    key: "open_monitoring",
    label: "Giám sát lưu lượng",
    icon: IconMapPin,
    desc: "Mở chế độ xem wall",
  },
  {
    key: "open_reports_today",
    label: "Xem báo cáo nhanh",
    icon: IconFileText,
    desc: "Mở nhanh trang báo cáo",
  },
];

export const TAB_CONFIG: {
  value: string;
  label: string;
  type?: ResultType;
  icon: ElementType;
}[] = [
  { value: "all", label: "Tất cả", icon: IconSearch },
  { value: "camera", label: "Camera", type: "camera", icon: IconCameraPlus },
  { value: "model", label: "Mô hình", type: "model", icon: IconBrain },
  { value: "report", label: "Báo cáo", type: "report", icon: IconFileText },
  { value: "forecast", label: "Dự báo", type: "forecast", icon: IconChartBar },
  { value: "doc", label: "Tài liệu", type: "doc", icon: IconBook },
];

export const LS_KEY = "search_history";
export const MAX_HISTORY = 8;

const REPORT_TYPE_LABELS: Record<SmartReport["type"], string> = {
  daily: "Hàng ngày",
  weekly: "Hàng tuần",
  monthly: "Hàng tháng",
  quarterly: "Hàng quý",
  custom: "Tùy chỉnh",
  incident: "Sự cố",
};

const REPORT_STATUS_LABELS: Record<SmartReport["status"], string> = {
  pending: "Chờ xử lý",
  generating: "Đang tạo",
  ready: "Sẵn sàng",
  failed: "Thất bại",
};

const REPORT_STATUS_VARIANTS: Record<
  SmartReport["status"],
  SearchResult["badgeVariant"]
> = {
  pending: "secondary",
  generating: "outline",
  ready: "default",
  failed: "destructive",
};

const FORECAST_HORIZON_CONFIG = [
  { key: "f5m", label: "5 phút", slotsAhead: 1 },
  { key: "f10m", label: "10 phút", slotsAhead: 2 },
  { key: "f15m", label: "15 phút", slotsAhead: 3 },
  { key: "f30m", label: "30 phút", slotsAhead: 6 },
  { key: "f60m", label: "60 phút", slotsAhead: 12 },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getForecastLosMeta(vcPct: number | null) {
  if (vcPct == null) {
    return {
      level: "unknown",
      label: "Chưa có dữ liệu",
      badgeVariant: "secondary" as const,
    };
  }

  if (vcPct < 60) {
    return {
      level: "free_flow",
      label: LOS_LABELS.free_flow,
      badgeVariant: "default" as const,
    };
  }
  if (vcPct < 75) {
    return {
      level: "smooth",
      label: LOS_LABELS.smooth,
      badgeVariant: "default" as const,
    };
  }
  if (vcPct < 85) {
    return {
      level: "moderate",
      label: LOS_LABELS.moderate,
      badgeVariant: "outline" as const,
    };
  }
  if (vcPct < 100) {
    return {
      level: "heavy",
      label: LOS_LABELS.heavy,
      badgeVariant: "destructive" as const,
    };
  }

  return {
    level: "congested",
    label: LOS_LABELS.congested,
    badgeVariant: "destructive" as const,
  };
}

function getOfficialForecastValue(
  slots: ForecastRollingResponse["cameras"][string]["slots"],
  nowIndex: number,
  key: (typeof FORECAST_HORIZON_CONFIG)[number]["key"],
  slotsAhead: number,
) {
  const sourceIndex = nowIndex + slotsAhead - 1;
  const targetIndex = nowIndex + slotsAhead;
  return {
    value: slots[sourceIndex]?.[key] ?? null,
    time: slots[targetIndex]?.t ?? null,
  };
}

// ─── Helper functions ─────────────────────────────────────────────────────────
/** Trả về metadata icon/màu theo loại kết quả */
export function getTypeMeta(type: ResultType) {
  switch (type) {
    case "camera":
      return {
        icon: IconCameraPlus,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        label: "Camera",
      };
    case "model":
      return {
        icon: IconBrain,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        label: "Mô hình",
      };
    case "report":
      return {
        icon: IconFileText,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        label: "Báo cáo",
      };
    case "forecast":
      return {
        icon: IconChartBar,
        color: "text-green-500",
        bg: "bg-green-500/10",
        label: "Dự báo",
      };
    case "doc":
      return {
        icon: IconBook,
        color: "text-teal-500",
        bg: "bg-teal-500/10",
        label: "Tài liệu",
      };
  }
}

/** Chuyển danh sách bài viết trợ giúp thành SearchResult */
export function buildDocResults(articles: HelpArticle[]): SearchResult[] {
  return articles
    .filter((a) => a.is_published)
    .map((a) => ({
      id: `doc-${a.section_key}`,
      type: "doc" as ResultType,
      title: a.title,
      subtitle:
        a.summary ??
        (a.type === "question" ? "Câu hỏi thường gặp" : "Tài liệu hướng dẫn"),
      meta: a.type === "question" ? "FAQ" : "Hướng dẫn",
      badge: a.type === "question" ? "FAQ" : "Tài liệu",
      badgeVariant: (a.type === "question"
        ? "outline"
        : "secondary") as SearchResult["badgeVariant"],
      details: {
        section_key: a.section_key,
        type: a.type,
      },
    }));
}

/** Chuyển dữ liệu camera tĩnh + realtime thành SearchResult */
export function buildCameraResults(
  cameras: CameraInfo[],
  processedMap: Map<
    string,
    { totalObjects: number; status: string; lastUpdated: string }
  >,
): SearchResult[] {
  return cameras.map((cam) => {
    const realtime = processedMap.get(cam.cam_id);
    const isOnline = !!realtime;
    const losStatus = realtime?.status;
    const isWarning = losStatus === "heavy" || losStatus === "congested";

    const statusKey: SearchResult["status"] = !isOnline
      ? "offline"
      : isWarning
        ? "warning"
        : "online";
    const badge = !isOnline ? "Offline" : isWarning ? "Cảnh báo" : "Online";
    const badgeVariant: SearchResult["badgeVariant"] = !isOnline
      ? "secondary"
      : isWarning
        ? "destructive"
        : "default";

    const subtitle = isOnline
      ? `${realtime!.totalObjects} xe/giờ • ${LOS_LABELS[losStatus!] ?? losStatus}`
      : "Không có dữ liệu real-time";

    const meta = isOnline
      ? `Cập nhật: ${new Date(realtime!.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
      : "Offline";

    return {
      id: cam.cam_id,
      type: "camera",
      title: cam.display_name,
      subtitle,
      meta,
      badge,
      badgeVariant,
      status: statusKey,
      details: {
        cam_id: cam.cam_id,
        location: cam.location,
        display_name: cam.display_name,
        totalObjects: realtime?.totalObjects,
        losStatus: realtime ? (LOS_LABELS[losStatus!] ?? losStatus) : undefined,
        lastUpdated: realtime?.lastUpdated,
      },
    };
  });
}

/** Chuyển dữ liệu model thành SearchResult */
export function buildModelResults(versions: MLModelMetadata[]): SearchResult[] {
  return versions.map((v) => {
    const acc =
      v.metrics?.r2 != null
        ? `R²: ${(v.metrics.r2 as number).toFixed(3)}`
        : null;
    const mae =
      v.metrics?.mae != null
        ? `MAE: ${(v.metrics.mae as number).toFixed(2)}`
        : null;
    const metrics = [acc, mae].filter(Boolean).join(" • ");
    const typeDisplay = v.model_type.replace(/_/g, " ");
    const displayLabel =
      v.display_name && v.display_name !== v.model_version
        ? v.display_name
        : typeDisplay;
    const subtitle = `${displayLabel}${metrics ? ` • ${metrics}` : ""}`;
    const meta = `Loại: ${typeDisplay} • Huấn luyện: ${new Date(v.created_at).toLocaleDateString("vi-VN")}`;
    return {
      id: String(v.id),
      type: "model",
      title: v.model_version,
      subtitle,
      meta,
      badge: v.is_active ? "Đang dùng" : "Lưu trữ",
      badgeVariant: v.is_active ? "default" : "outline",
      details: {
        model_version: v.model_version,
        display_name: v.display_name || "",
        model_type: typeDisplay,
        r2:
          v.metrics?.r2 != null
            ? (v.metrics.r2 as number).toFixed(4)
            : undefined,
        mae:
          v.metrics?.mae != null
            ? (v.metrics.mae as number).toFixed(2)
            : undefined,
        is_active: v.is_active,
        training_samples: v.training_samples ?? undefined,
        created_at: new Date(v.created_at).toLocaleString("vi-VN"),
      },
    };
  });
}

/** Chuyển dữ liệu báo cáo thật thành SearchResult */
export function buildReportResults(reports: SmartReport[]): SearchResult[] {
  return reports.map((report) => {
    const typeLabel = REPORT_TYPE_LABELS[report.type] ?? report.type;
    const statusLabel = REPORT_STATUS_LABELS[report.status] ?? report.status;
    const totalVehicles = report.summary_json?.overview?.totalVehicles;
    const accuracy = report.summary_json?.performance?.modelAccuracy;

    const summaryBits = [
      typeLabel,
      `${formatDate(report.period_from)} → ${formatDate(report.period_to)}`,
    ];
    if (typeof totalVehicles === "number") {
      summaryBits.push(`${totalVehicles.toLocaleString("vi-VN")} xe`);
    } else if (typeof accuracy === "number") {
      summaryBits.push(`Độ chính xác ${accuracy.toFixed(1)}%`);
    }

    return {
      id: report.id,
      type: "report",
      title: report.title,
      subtitle: summaryBits.join(" • "),
      meta: `${statusLabel} • Tạo: ${formatDateTime(report.created_at)}`,
      badge: statusLabel,
      badgeVariant: REPORT_STATUS_VARIANTS[report.status],
      details: {
        report_id: report.id,
        report_type: typeLabel,
        report_status: statusLabel,
        period_from: formatDate(report.period_from),
        period_to: formatDate(report.period_to),
        generated_at: formatDateTime(report.generated_at),
      },
    };
  });
}

/** Chuyển rolling forecast thật thành SearchResult */
export function buildForecastResults(
  cameras: CameraInfo[],
  rollingData: ForecastRollingResponse,
): SearchResult[] {
  const cameraMap = new Map(cameras.map((camera) => [camera.cam_id, camera]));
  const nowIndex = rollingData.metadata.nowIndex;
  const ids = [
    ...(rollingData.cameras.all ? ["all"] : []),
    ...Object.keys(rollingData.cameras).filter((id) => id !== "all"),
  ];

  return ids.map((id) => {
    const cameraForecast = rollingData.cameras[id];
    const info = cameraMap.get(id);
    const displayName =
      id === "all" ? "Toàn mạng lưới" : (info?.display_name ?? id);
    const capacity =
      cameraForecast?.capacity ?? rollingData.capacities[id] ?? null;

    const primaryForecast = FORECAST_HORIZON_CONFIG.map((config) => ({
      ...config,
      ...getOfficialForecastValue(
        cameraForecast?.slots ?? [],
        nowIndex,
        config.key,
        config.slotsAhead,
      ),
    })).find((item) => item.value != null);

    const vcPct =
      primaryForecast?.value != null && capacity && capacity > 0
        ? (Number(primaryForecast.value) / Number(capacity)) * 100
        : null;

    const forecastMeta = getForecastLosMeta(vcPct);
    const generatedTime = new Date(
      rollingData.metadata.generatedAt,
    ).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      id: `forecast-${id}`,
      type: "forecast",
      title: id === "all" ? "Dự báo toàn mạng lưới" : `Dự báo ${displayName}`,
      subtitle: primaryForecast
        ? `${primaryForecast.label}: ${Math.round(Number(primaryForecast.value))} xe • ${forecastMeta.label}`
        : "Chưa có dữ liệu dự báo mới nhất",
      meta: primaryForecast?.time
        ? `Mốc: ${primaryForecast.time} • Cập nhật: ${generatedTime}`
        : `Hiện tại: ${rollingData.metadata.nowTime} • Cập nhật: ${generatedTime}`,
      badge: forecastMeta.label,
      badgeVariant: forecastMeta.badgeVariant,
      details: {
        cam_id: id,
        display_name: displayName,
        forecast_time: primaryForecast?.time ?? rollingData.metadata.nowTime,
        forecast_value:
          primaryForecast?.value != null
            ? Math.round(Number(primaryForecast.value))
            : undefined,
        horizon_label: primaryForecast?.label,
        vc_pct: vcPct != null ? Math.round(vcPct) : undefined,
      },
    };
  });
}
