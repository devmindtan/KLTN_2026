/**
 * SmartReportCard — Minimal & Clean redesign
 * Supports light + dark mode. Drop-in replacement for the original.
 */

import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/custom/highlight-text";
import {
  IconTrash,
  IconClock,
  IconAlertTriangle,
  IconFileTypePdf,
  IconFileTypeXls,
  IconChevronRight,
  IconChartLine,
  IconCalendar,
  IconTable,
  IconSettings,
  IconExclamationMark,
  IconChartBar,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";

import type { SmartReport } from "@/services/reports.service";

interface Props {
  report: SmartReport;
  query?: string;
  canManage?: boolean;
  onDelete?: (report: SmartReport) => void;
  onClick?: (report: SmartReport) => void;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Đang chờ",
    accent: "bg-amber-500",
    badge: "text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
    dot: "bg-amber-500",
    icon: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
    pulse: false,
  },
  generating: {
    label: "Đang tạo",
    accent: "bg-blue-500",
    badge: "text-blue-800 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800",
    dot: "bg-blue-500",
    icon: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40",
    pulse: true,
  },
  ready: {
    label: "Sẵn sàng",
    accent: "bg-teal-600",
    badge: "text-teal-800 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800",
    dot: "bg-teal-600",
    icon: "text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/40",
    pulse: false,
  },
  failed: {
    label: "Lỗi",
    accent: "bg-red-500",
    badge: "text-red-800 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800",
    dot: "bg-red-500",
    icon: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40",
    pulse: false,
  },
} as const;

// ─── Type icons ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  daily: IconCalendar,
  weekly: IconChartBar,
  monthly: IconChartLine,
  quarterly: IconTable,
  custom: IconSettings,
  incident: IconExclamationMark,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartReportCard({
  report,
  query,
  canManage = false,
  onDelete,
  onClick,
}: Props) {
  const status = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG];
  const TypeIcon = TYPE_ICON[report.type as keyof typeof TYPE_ICON] ?? IconChartLine;

  const formatPeriod = () => {
    const from = format(new Date(report.period_from), "dd/MM", { locale: vi });
    const to = format(new Date(report.period_to), "dd/MM/yyyy", { locale: vi });
    return report.period_from === report.period_to ? to : `${from}–${to}`;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    onClick?.(report);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(report)}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card",
        "cursor-pointer select-none overflow-hidden",
        "transition-all duration-150",
        "hover:border-border/70 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Status accent bar */}
      <div className={cn("h-0.5 w-full flex-shrink-0", status.accent)} />

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">

        {/* Top: Icon + Title + Delete */}
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
              status.icon
            )}
          >
            <TypeIcon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
              <HighlightText text={report.title} query={query ?? ""} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{formatPeriod()}</p>
          </div>

          {canManage && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(report);
              }}
            >
              <IconTrash className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          {/* Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              status.badge
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full flex-shrink-0",
                status.dot,
                status.pulse && "animate-pulse"
              )}
            />
            {status.label}
          </span>

          {/* File chips */}
          {report.status === "ready" && report.files_json && (
            <div className="flex items-center gap-1.5">
              {report.files_json.pdf && (
                <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                  <IconFileTypePdf className="h-3 w-3" />
                  PDF
                </span>
              )}
              {report.files_json.xlsx && (
                <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                  <IconFileTypeXls className="h-3 w-3" />
                  XLSX
                </span>
              )}
            </div>
          )}
        </div>

        {/* Metrics — only when ready */}
        {report.status === "ready" && report.summary_json && (
          <div className="flex overflow-hidden rounded-lg bg-muted/40">
            <div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
              <span className="text-[15px] font-medium leading-none tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
                {report.summary_json.overview.totalVehicles.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">Tổng xe</span>
            </div>
            <div className="w-px bg-border/50" />
            <div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
              <span className="text-[15px] font-medium leading-none tracking-tight text-teal-600 dark:text-teal-400 tabular-nums">
                {report.summary_json.performance.modelAccuracy.toFixed(1)}%
              </span>
              <span className="text-[10px] text-muted-foreground">Chính xác</span>
            </div>
          </div>
        )}

        {/* Generating hint */}
        {report.status === "generating" && (
          <p className="text-[11px] text-muted-foreground">
            Hệ thống đang xử lý dữ liệu…
          </p>
        )}

        {/* Pending hint */}
        {report.status === "pending" && (
          <p className="text-[11px] text-muted-foreground">
            Đã xếp vào hàng chờ xử lý
          </p>
        )}

        {/* Error message */}
        {report.status === "failed" && report.error_message && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950/30">
            <IconAlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="line-clamp-2 text-[11px] leading-snug text-red-700 dark:text-red-400">
              {report.error_message}
            </p>
          </div>
        )}

        <div className="flex-1" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <IconClock className="h-3 w-3" />
          {format(new Date(report.created_at), "dd/MM · HH:mm", { locale: vi })}
        </div>
        <div className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          Xem chi tiết
          <IconChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}