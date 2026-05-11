/**
 * SmartReportRow – Hàng ngang compact cho list view
 * - Ready: hiển đầy đủ (type badge, tiêu đề, chỉ số, download)
 * - Khác: hiển tối giản (type badge, tiêu đề, status badge, ngày tạo)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HighlightText } from "@/components/custom/highlight-text";
import {
  IconFileTypePdf,
  IconFileTypeXls,
  IconTrash,
  IconClock,
  IconCar,
  IconChartBar,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useState } from "react";
import { toast } from "sonner";
import type { SmartReport } from "@/services/reports.service";
import { downloadReportBlob } from "@/services/reports.service";

interface Props {
  report: SmartReport;
  query?: string;
  canManage?: boolean;
  onDelete?: (report: SmartReport) => void;
  onClick?: (report: SmartReport) => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "Chưa xử lý",
    cls: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700",
  },
  generating: {
    label: "Đang tạo",
    cls: "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700",
  },
  ready: {
    label: "Sẵn sàng",
    cls: "text-green-700 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700",
  },
  failed: {
    label: "Lỗi",
    cls: "text-red-700 border-red-200 bg-red-50 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700",
  },
};

const TYPE_LABELS: Record<SmartReport["type"], string> = {
  daily: "Ngày",
  weekly: "Tuần",
  monthly: "Tháng",
  quarterly: "Quý",
  custom: "Tùy chỉnh",
  incident: "Sự cố",
};

const TYPE_CLS: Record<SmartReport["type"], string> = {
  daily:
    "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  weekly:
    "text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400",
  monthly:
    "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  quarterly:
    "text-indigo-700 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400",
  custom:
    "text-gray-700 border-gray-200 bg-gray-50 dark:bg-gray-950/30 dark:text-gray-400",
  incident:
    "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

/** Hàng danh sách báo cáo – compact, layout thay đổi theo trạng thái */
export function SmartReportRow({
  report,
  query,
  canManage = false,
  onDelete,
  onClick,
}: Props) {
  const statusCfg = STATUS_CONFIG[report.status];
  const isReady = report.status === "ready";
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);

  const formatPeriod = () => {
    const from = format(new Date(report.period_from), "dd/MM", { locale: vi });
    const to = format(new Date(report.period_to), "dd/MM/yy", { locale: vi });
    return report.period_from === report.period_to ? to : `${from}–${to}`;
  };

  const formatFileSize = (sizeMB: number) =>
    sizeMB < 1 ? `${Math.round(sizeMB * 1024)} KB` : `${sizeMB} MB`;

  const handleDownload = async (fmt: "pdf" | "xlsx") => {
    if (downloading) return;
    setDownloading(fmt);
    try {
      const ext = fmt === "pdf" ? "pdf" : "xlsx";
      const title = report.title
        .replace(/[^a-zA-Z0-9À-ỹ\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      await downloadReportBlob(report.id, fmt, `${title}.${ext}`);
    } catch (err) {
      toast.error("Tải file thất bại", {
        description: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Không trigger onClick nếu click vào button
    if ((e.target as HTMLElement).closest("button")) return;
    onClick?.(report);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b last:border-0 transition-colors hover:bg-accent/40 min-w-0",
        onClick && "cursor-pointer",
        !isReady && "opacity-70",
      )}
      onClick={handleRowClick}
    >
      {/* ── Loại báo cáo ─────────────────────────────── */}
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 text-[10px] px-1.5 py-0.5 font-medium w-12 sm:w-16 justify-center",
          TYPE_CLS[report.type],
        )}
      >
        {TYPE_LABELS[report.type]}
      </Badge>

      {/* ── Tiêu đề + thông tin phụ ──────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">
          <HighlightText text={report.title} query={query ?? ""} />
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            {formatPeriod()}
          </span>

          {/* Ngày tạo hiển thị trên mobile */}
          <span className="md:hidden text-[11px] text-muted-foreground">•</span>
          <span className="md:hidden text-[11px] text-muted-foreground">
            {format(new Date(report.created_at), "dd/MM HH:mm", { locale: vi })}
          </span>

          {/* Chỉ số tóm tắt trên mobile (chỉ khi ready) */}
          {isReady && report.summary_json && (
            <>
              <span className="sm:hidden text-[11px] text-muted-foreground">
                •
              </span>
              <span className="sm:hidden text-[11px] text-muted-foreground">
                {report.summary_json.overview.totalVehicles.toLocaleString()} xe
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Chỉ số tóm tắt desktop (chỉ khi ready) ──────────── */}
      {isReady && report.summary_json && (
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconCar className="size-3.5 text-blue-500" />
            <span className="font-medium text-foreground">
              {report.summary_json.overview.totalVehicles.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconChartBar className="size-3.5 text-green-500" />
            <span className="font-medium text-foreground">
              {report.summary_json.performance.modelAccuracy.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Trạng thái ───────────────────────────────── */}
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 text-[10px] px-1.5 py-0.5 hidden xs:inline-flex",
          statusCfg.cls,
        )}
      >
        {statusCfg.label}
      </Badge>

      {/* ── Ngày tạo desktop ───────────────────────────────── */}
      <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
        <IconClock className="size-3" />
        <span className="whitespace-nowrap">
          {format(new Date(report.created_at), "dd/MM HH:mm", { locale: vi })}
        </span>
      </div>

      {/* ── Actions ──────────────────── */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {isReady && report.files_json && (
          <>
            {report.files_json.pdf && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!!downloading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload("pdf");
                    }}
                  >
                    <IconFileTypePdf className="h-4 w-4 text-red-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Tải PDF ({formatFileSize(report.files_json.pdf.sizeMB)})
                </TooltipContent>
              </Tooltip>
            )}
            {report.files_json.xlsx && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!!downloading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload("xlsx");
                    }}
                  >
                    <IconFileTypeXls className="h-4 w-4 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Tải Excel ({formatFileSize(report.files_json.xlsx.sizeMB)})
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}

        {/* Xóa – chỉ technician */}
        {canManage && onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(report);
                }}
              >
                <IconTrash className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xóa báo cáo</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
