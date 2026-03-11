/**
 * ReportRow – 1 hàng báo cáo trong list view (dạng truyền thống)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconAlertTriangle,
  IconCalendarWeek,
  IconCalendar,
  IconCalendarMonth,
  IconDownload,
  IconEye,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { HighlightText } from "@/components/highlight-text";
import type { ReportData } from "./reports-types";
import { REPORT_TYPE_LABEL } from "./reports-types";

const TYPE_ICON: Record<ReportData["type"], React.ReactNode> = {
  daily:    <IconCalendar    className="size-4 text-blue-500 shrink-0" />,
  weekly:   <IconCalendarWeek className="size-4 text-purple-500 shrink-0" />,
  monthly:  <IconCalendarMonth className="size-4 text-orange-500 shrink-0" />,
  incident: <IconAlertTriangle className="size-4 text-red-500 shrink-0" />,
};

const TYPE_COLOR: Record<ReportData["type"], string> = {
  daily:    "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  weekly:   "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400",
  monthly:  "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  incident: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

/** Format ngày theo dd/mm/yyyy */
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

/** Format datetime ngắn */
function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

/** Format KB → KB hoặc MB */
function fmtSize(kb: number) {
  if (kb === 0) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface Props {
  report: ReportData;
  query?: string;
}

/** Hàng báo cáo dạng list – default view */
export function ReportRow({ report, query }: Props) {
  const isReady = report.status === "ready";
  const isProcessing = report.status === "processing";
  const dateLabel =
    report.dateRange.from === report.dateRange.to
      ? fmtDate(report.dateRange.from)
      : `${fmtDate(report.dateRange.from)} – ${fmtDate(report.dateRange.to)}`;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 border-b last:border-0 transition-colors",
        "hover:bg-accent/40",
        isProcessing && "opacity-70"
      )}
    >
      {/* Icon file */}
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
        {TYPE_ICON[report.type]}
      </div>

      {/* Info chính */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate max-w-xs">
            <HighlightText text={report.title} query={query ?? ""} />
          </span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", TYPE_COLOR[report.type])}>
            {REPORT_TYPE_LABEL[report.type]}
          </Badge>
          {isReady && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
              Sẵn sàng
            </Badge>
          )}
          {isProcessing && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 flex items-center gap-1">
              <IconLoader2 className="size-2.5 animate-spin" />
              Đang xử lý
            </Badge>
          )}
          {report.status === "failed" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-red-700 border-red-200 bg-red-50">
              Lỗi
            </Badge>
          )}
        </div>

        {isProcessing ? (
          <Skeleton className="h-3.5 w-48 mt-1" />
        ) : (
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{dateLabel}</span>
            {report.metrics.totalVehicles > 0 && (
              <>
                <span>•</span>
                <span>{report.metrics.totalVehicles.toLocaleString("vi-VN")} xe</span>
                <span>•</span>
                <span>Cao điểm: {report.metrics.peakHour}</span>
                {report.metrics.incidentCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-500">{report.metrics.incidentCount} sự cố</span>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground mt-0.5">
          Tạo: {fmtDateTime(report.createdAt)}
          {isReady && <span className="ml-2">{fmtSize(report.fileSizeKB)}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" disabled={!isReady}>
              <IconEye className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Xem nhanh</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            {isReady && report.downloadUrl ? (
              <a href={report.downloadUrl} download>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <IconDownload className="size-3.5" />
                  Tải về
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled>
                <IconDownload className="size-3.5" />
                Tải về
              </Button>
            )}
          </TooltipTrigger>
          {!isReady && <TooltipContent>Báo cáo chưa sẵn sàng</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}
