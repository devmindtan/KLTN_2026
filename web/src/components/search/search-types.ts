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
import type { MLModelMetadata } from "@/services/model.service";
import type { HelpArticle } from "@/services/help.service";

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

export const MOCK_REPORT_FORECAST: SearchResult[] = [
  { id: "r1", type: "report", title: "Báo cáo lưu lượng tháng 2/2026", subtitle: "Tổng 2.4M lượt • Giờ cao điểm: 17:00–19:00", meta: "Tạo: 01/03/2026", badge: "PDF", badgeVariant: "outline" },
  { id: "r2", type: "report", title: "Báo cáo mô hình LSTM tháng 2", subtitle: "Accuracy: 94.2% • 28 ngày dữ liệu", meta: "Tạo: 28/02/2026", badge: "PDF", badgeVariant: "outline" },
  { id: "r3", type: "report", title: "Tổng hợp sự cố tháng 1/2026", subtitle: "12 sự kiện ùn tắc • 3 camera offline", meta: "Tạo: 01/02/2026", badge: "Docs", badgeVariant: "outline" },
  { id: "f1", type: "forecast", title: "Dự báo 17:00–18:00 hôm nay", subtitle: "Cầu Sài Gòn: 480 xe/giờ • Nguy cơ ùn tắc cao", meta: "Độ tin cậy: 91%", badge: "Nguy cơ cao", badgeVariant: "destructive" },
  { id: "f2", type: "forecast", title: "Dự báo 08:00–09:00 mai", subtitle: "Ngã tư Bến Thành: 310 xe/giờ • Bình thường", meta: "Độ tin cậy: 87%", badge: "Bình thường", badgeVariant: "default" },
  { id: "f3", type: "forecast", title: "Dự báo cuối tuần 14–15/03", subtitle: "Toàn mạng lưới: giảm 35% so với ngày thường", meta: "Độ tin cậy: 82%", badge: "Thấp điểm", badgeVariant: "secondary" },
];

export const QUICK_ACTIONS: { label: string; icon: ElementType; desc: string }[] = [
  { label: "Làm mới dữ liệu camera", icon: IconRefresh,  desc: "Cập nhật toàn bộ feed camera" },
  { label: "Xem mô hình đang active", icon: IconBrain,    desc: "Tìm kiếm theo từ khoá 'active'" },
  { label: "Bản đồ giám sát",         icon: IconMapPin,   desc: "Mở chế độ xem bản đồ" },
  { label: "Xuất báo cáo hôm nay",    icon: IconFileText, desc: "Tải báo cáo mới nhất" },
];

export const TAB_CONFIG: { value: string; label: string; type?: ResultType; icon: ElementType }[] = [
  { value: "all",      label: "Tất cả",    icon: IconSearch    },
  { value: "camera",   label: "Camera",    type: "camera",   icon: IconCameraPlus },
  { value: "model",    label: "Mô hình",   type: "model",    icon: IconBrain      },
  { value: "report",   label: "Báo cáo",   type: "report",   icon: IconFileText   },
  { value: "forecast", label: "Dự báo",    type: "forecast", icon: IconChartBar   },
  { value: "doc",      label: "Tài liệu",  type: "doc",      icon: IconBook       },
];

export const LS_KEY = "search_history";
export const MAX_HISTORY = 8;

// ─── Helper functions ─────────────────────────────────────────────────────────
/** Trả về metadata icon/màu theo loại kết quả */
export function getTypeMeta(type: ResultType) {
  switch (type) {
    case "camera":   return { icon: IconCameraPlus, color: "text-blue-500",   bg: "bg-blue-500/10",   label: "Camera"   };
    case "model":    return { icon: IconBrain,       color: "text-purple-500", bg: "bg-purple-500/10", label: "Mô hình"  };
    case "report":   return { icon: IconFileText,    color: "text-orange-500", bg: "bg-orange-500/10", label: "Báo cáo"  };
    case "forecast": return { icon: IconChartBar,    color: "text-green-500",  bg: "bg-green-500/10",  label: "Dự báo"   };
    case "doc":      return { icon: IconBook,         color: "text-teal-500",   bg: "bg-teal-500/10",   label: "Tài liệu" };
  }
}

/** Chuyển danh sách bài viết trợ giúp thành SearchResult */
export function buildDocResults(articles: HelpArticle[]): SearchResult[] {
  return articles
    .filter((a) => a.is_published)
    .map((a) => ({
      id:           `doc-${a.section_key}`,
      type:         "doc" as ResultType,
      title:        a.title,
      subtitle:     a.summary ?? (a.type === "question" ? "Câu hỏi thường gặp" : "Tài liệu hướng dẫn"),
      meta:         a.type === "question" ? "FAQ" : "Hướng dẫn",
      badge:        a.type === "question" ? "FAQ" : "Tài liệu",
      badgeVariant: (a.type === "question" ? "outline" : "secondary") as SearchResult["badgeVariant"],
      details: {
        section_key: a.section_key,
        type:        a.type,
      },
    }));
}

/** Chuyển dữ liệu camera tĩnh + realtime thành SearchResult */
export function buildCameraResults(
  cameras: CameraInfo[],
  processedMap: Map<string, { totalObjects: number; status: string; lastUpdated: string }>
): SearchResult[] {
  return cameras.map(cam => {
    const realtime  = processedMap.get(cam.cam_id);
    const isOnline  = !!realtime;
    const losStatus = realtime?.status;
    const isWarning = losStatus === "heavy" || losStatus === "congested";

    const statusKey: SearchResult["status"] = !isOnline ? "offline" : isWarning ? "warning" : "online";
    const badge         = !isOnline ? "Offline" : isWarning ? "Cảnh báo" : "Online";
    const badgeVariant: SearchResult["badgeVariant"] = !isOnline ? "secondary" : isWarning ? "destructive" : "default";

    const subtitle = isOnline
      ? `${realtime!.totalObjects} xe/giờ • ${LOS_LABELS[losStatus!] ?? losStatus}`
      : "Không có dữ liệu real-time";

    const meta = isOnline
      ? `Cập nhật: ${new Date(realtime!.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
      : "Offline";

    return {
      id:           cam.cam_id,
      type:         "camera",
      title:        cam.display_name,
      subtitle,
      meta,
      badge,
      badgeVariant,
      status:       statusKey,
      details: {
        cam_id:       cam.cam_id,
        location:     cam.location,
        display_name: cam.display_name,
        totalObjects: realtime?.totalObjects,
        losStatus:    realtime ? (LOS_LABELS[losStatus!] ?? losStatus) : undefined,
        lastUpdated:  realtime?.lastUpdated,
      },
    };
  });
}

/** Chuyển dữ liệu model thành SearchResult */
export function buildModelResults(versions: MLModelMetadata[]): SearchResult[] {
  return versions.map(v => {
    const acc  = v.metrics?.r2  != null ? `R²: ${(v.metrics.r2  as number).toFixed(3)}` : null;
    const mae  = v.metrics?.mae != null ? `MAE: ${(v.metrics.mae as number).toFixed(2)}` : null;
    const metrics      = [acc, mae].filter(Boolean).join(" • ");
    const typeDisplay  = v.model_type.replace(/_/g, " ");
    const displayLabel = v.display_name && v.display_name !== v.model_version ? v.display_name : typeDisplay;
    const subtitle = `${displayLabel}${metrics ? ` • ${metrics}` : ""}`;
    const meta     = `Loại: ${typeDisplay} • Huấn luyện: ${new Date(v.created_at).toLocaleDateString("vi-VN")}`;
    return {
      id:           String(v.id),
      type:         "model",
      title:        v.model_version,
      subtitle,
      meta,
      badge:        v.is_active ? "Đang dùng" : "Lưu trữ",
      badgeVariant: v.is_active ? "default" : "outline",
      details: {
        model_version:    v.model_version,
        display_name:     v.display_name || "",
        model_type:       typeDisplay,
        r2:               v.metrics?.r2  != null ? (v.metrics.r2  as number).toFixed(4) : undefined,
        mae:              v.metrics?.mae != null ? (v.metrics.mae as number).toFixed(2) : undefined,
        is_active:        v.is_active,
        training_samples: v.training_samples ?? undefined,
        created_at:       new Date(v.created_at).toLocaleString("vi-VN"),
      },
    };
  });
}
