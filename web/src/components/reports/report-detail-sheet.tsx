/**
 * Report Detail Sheet - Chi tiết đầy đủ báo cáo trước khi tải
 */
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileZip,
  IconClock,
  IconCalendar,
  IconAlertTriangle,
  IconCheck,
  IconTrendingUp,
  IconUsers,
  IconCamera,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

import type { SmartReport } from "@/services/reports.service";
import { downloadReportBlob } from "@/services/reports.service";

interface Props {
  report: SmartReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "Đang chờ",
    icon: IconClock,
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-900",
  },
  generating: {
    label: "Đang tạo",
    icon: IconTrendingUp,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-900",
  },
  ready: {
    label: "Sẵn sàng",
    icon: IconCheck,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-900",
  },
  failed: {
    label: "Lỗi",
    icon: IconAlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
  },
};

const TYPE_LABELS = {
  daily: "Báo cáo Ngày",
  weekly: "Báo cáo Tuần",
  monthly: "Báo cáo Tháng",
  quarterly: "Báo cáo Quý",
  custom: "Báo cáo Tùy chỉnh",
  incident: "Báo cáo Sự cố",
};

export function ReportDetailSheet({ report, open, onOpenChange }: Props) {
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | "zip" | null>(
    null,
  );

  if (!report) return null;

  const statusConfig =
    STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = statusConfig.icon;

  const formatDateTime = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: vi });
  };

  const getFilename = (fmt: "pdf" | "xlsx" | "zip") => {
    const title = report.title
      .replace(/[^a-zA-Z0-9À-ỹ\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    return fmt === "zip" ? `${title}.zip` : `${title}.${fmt}`;
  };

  const handleDownload = async (fmt: "pdf" | "xlsx") => {
    if (report.status !== "ready" || !report.files_json?.[fmt] || downloading)
      return;
    setDownloading(fmt);
    try {
      await downloadReportBlob(report.id, fmt, getFilename(fmt));
    } catch (err) {
      toast.error("Tải file thất bại", {
        description: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (report.status !== "ready" || downloading) return;
    setDownloading("zip");
    try {
      await downloadReportBlob(report.id, "zip", getFilename("zip"));
    } catch (err) {
      toast.error("Tải file thất bại", {
        description: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <SheetTitle className="text-base leading-tight pr-8">
            {report.title}
          </SheetTitle>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 ${statusConfig.color} ${statusConfig.bg} ${statusConfig.border}`}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Thông tin cơ bản */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Thông tin chung</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconCalendar className="h-3.5 w-3.5" />
                  <span>Loại báo cáo</span>
                </div>
                <div className="text-sm font-medium">
                  {TYPE_LABELS[report.type as keyof typeof TYPE_LABELS]}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconClock className="h-3.5 w-3.5" />
                  <span>Khởi tạo</span>
                </div>
                <div className="text-sm font-medium">
                  {formatDateTime(report.created_at)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconCalendar className="h-3.5 w-3.5" />
                  <span>Từ ngày</span>
                </div>
                <div className="text-sm font-medium">
                  {formatDate(report.period_from)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconCalendar className="h-3.5 w-3.5" />
                  <span>Đến ngày</span>
                </div>
                <div className="text-sm font-medium">
                  {formatDate(report.period_to)}
                </div>
              </div>

              {report.generated_at && (
                <div className="space-y-1 col-span-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <IconCheck className="h-3.5 w-3.5" />
                    <span>Hoàn thành lúc</span>
                  </div>
                  <div className="text-sm font-medium">
                    {formatDateTime(report.generated_at)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar for generating */}
          {report.status === "generating" && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Đang phân tích dữ liệu giao thông...</span>
                  <span>Khoảng 3 phút</span>
                </div>
                <Progress value={50} className="h-2" />
              </div>
            </>
          )}

          {/* Error message */}
          {report.status === "failed" && report.error_message && (
            <>
              <Separator />
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-md text-sm border border-red-200 dark:border-red-900">
                <IconAlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium">Lỗi khi tạo báo cáo</div>
                  <div className="text-xs leading-relaxed">
                    {report.error_message}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Summary metrics */}
          {report.status === "ready" && report.summary_json && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Tổng quan dữ liệu</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10">
                      <IconUsers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">
                        Tổng xe
                      </div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {report.summary_json.overview.totalVehicles.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-500/10">
                      <IconCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">
                        Độ chính xác
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                        {report.summary_json.performance.modelAccuracy.toFixed(
                          1,
                        )}
                        %
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-md border border-orange-200 dark:border-orange-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500/10">
                      <IconTrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">
                        Giờ cao điểm
                      </div>
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                        {report.summary_json.overview.peakHours.length}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-200 dark:border-purple-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-500/10">
                      <IconCamera className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">
                        Camera
                      </div>
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {report.summary_json.camerasAnalysis.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* File sizes */}
                {report.files_json && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/30 rounded-md text-xs">
                    {report.files_json.pdf && (
                      <div className="flex items-center gap-1.5">
                        <IconFileTypePdf className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-muted-foreground">PDF:</span>
                        <span className="font-medium tabular-nums">
                          {report.files_json.pdf.sizeMB} MB
                        </span>
                      </div>
                    )}
                    {report.files_json.xlsx && (
                      <div className="flex items-center gap-1.5">
                        <IconFileTypeXls className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-muted-foreground">Excel:</span>
                        <span className="font-medium tabular-nums">
                          {report.files_json.xlsx.sizeMB} MB
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Insights */}
                {report.summary_json.insights && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      Những phát hiện chính
                    </h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {report.summary_json.insights.trends
                        .slice(0, 3)
                        .map((trend, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500 shrink-0 mt-0.5">
                              •
                            </span>
                            <span className="leading-relaxed">{trend}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Download actions */}
          {report.status === "ready" && report.files_json && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Tải xuống báo cáo</h3>
                <div className="grid gap-2">
                  {report.files_json.pdf && (
                    <Button
                      variant="outline"
                      className="justify-start gap-2 h-auto py-2.5"
                      disabled={!!downloading}
                      onClick={() => handleDownload("pdf")}
                    >
                      <IconFileTypePdf className="h-5 w-5 text-red-500" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">
                          {downloading === "pdf" ? "Đang tải..." : "Tải PDF"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Báo cáo tổng hợp với biểu đồ (
                          {report.files_json.pdf.sizeMB} MB)
                        </div>
                      </div>
                    </Button>
                  )}

                  {report.files_json.xlsx && (
                    <Button
                      variant="outline"
                      className="justify-start gap-2 h-auto py-2.5"
                      disabled={!!downloading}
                      onClick={() => handleDownload("xlsx")}
                    >
                      <IconFileTypeXls className="h-5 w-5 text-green-600" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">
                          {downloading === "xlsx" ? "Đang tải..." : "Tải Excel"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Dữ liệu chi tiết cho phân tích (
                          {report.files_json.xlsx.sizeMB} MB)
                        </div>
                      </div>
                    </Button>
                  )}

                  {report.files_json.pdf && report.files_json.xlsx && (
                    <Button
                      variant="default"
                      className="justify-start gap-2 h-auto py-2.5"
                      disabled={!!downloading}
                      onClick={handleDownloadZip}
                    >
                      <IconFileZip className="h-5 w-5" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">
                          {downloading === "zip"
                            ? "Đang tải..."
                            : "Tải tất cả (ZIP)"}
                        </div>
                        <div className="text-xs opacity-90">
                          Tải cả PDF và Excel trong một file nén
                        </div>
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
