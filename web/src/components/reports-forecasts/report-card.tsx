/**
 * ReportCard – Card hiển thị báo cáo trong grid view (toggle alt)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconCalendar,
  IconCalendarWeek,
  IconCalendarMonth,
  IconAlertTriangle,
  IconDownload,
  IconEye,
  IconLoader2,
  IconUsers,
  IconClock,
  IconAlertCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { HighlightText } from "@/components/highlight-text";
import type { ReportData } from "./reports-types";
import { REPORT_TYPE_LABEL } from "./reports-types";

const TYPE_ICON: Record<ReportData["type"], React.ReactNode> = {
  daily:    <IconCalendar     className="size-5 text-blue-500" />,
  weekly:   <IconCalendarWeek  className="size-5 text-purple-500" />,
  monthly:  <IconCalendarMonth className="size-5 text-orange-500" />,
  incident: <IconAlertTriangle className="size-5 text-red-500" />,
};

const TYPE_COLOR: Record<ReportData["type"], string> = {
  daily:    "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  weekly:   "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400",
  monthly:  "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  incident: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}
function fmtSize(kb: number) {
  if (kb === 0) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface Props {
  report: ReportData;
  query?: string;
}

/** Card báo cáo – hiển thị khi ở grid view */
export function ReportCard({ report, query }: Props) {
  const isReady = report.status === "ready";
  const isProcessing = report.status === "processing";
  const dateLabel =
    report.dateRange.from === report.dateRange.to
      ? fmtDate(report.dateRange.from)
      : `${fmtDate(report.dateRange.from)} – ${fmtDate(report.dateRange.to)}`;

  return (
    <Card className={cn("flex flex-col", isProcessing && "opacity-70")}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
            {TYPE_ICON[report.type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm leading-snug truncate">
              <HighlightText text={report.title} query={query ?? ""} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TYPE_COLOR[report.type])}>
                {REPORT_TYPE_LABEL[report.type]}
              </Badge>
              {isReady && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                  Sẵn sàng
                </Badge>
              )}
              {isProcessing && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 flex items-center gap-1">
                  <IconLoader2 className="size-2.5 animate-spin" />
                  Đang xử lý
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconCalendar className="size-3.5 shrink-0" />
          <span>{dateLabel}</span>
        </div>

        {isProcessing ? (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconUsers className="size-3.5 shrink-0" />
              <span>{report.metrics.totalVehicles.toLocaleString("vi-VN")} xe</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconClock className="size-3.5 shrink-0" />
              <span className="truncate">{report.metrics.peakHour}</span>
            </div>
            {report.metrics.incidentCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-500">
                <IconAlertCircle className="size-3.5 shrink-0" />
                <span>{report.metrics.incidentCount} sự cố</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t">
          <span className="text-[11px] text-muted-foreground">{fmtSize(report.fileSizeKB)}</span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="icon" className="size-7" disabled={!isReady}>
              <IconEye className="size-3.5" />
            </Button>
            {isReady && report.downloadUrl ? (
              <a href={report.downloadUrl} download>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
                  <IconDownload className="size-3" />
                  Tải PDF
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" disabled>
                <IconDownload className="size-3" />
                Tải PDF
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
