/**
 * SmartReportsGrid - Grid/List hiển thị báo cáo với mode switch
 */
import { SmartReportCard } from "./smart-report-card";
import { SmartReportRow } from "./smart-report-row";
import { EmptyState } from "@/components/custom/empty-state";
import type { SmartReport } from "@/services/reports.service";
import { IconFileSearch } from "@tabler/icons-react";

type ViewMode = "list" | "grid";

interface SmartReportsGridProps {
  reports: SmartReport[];
  viewMode: ViewMode;
  searchQuery?: string;
  loading?: boolean;
  canManage?: boolean;
  onDeleteReport: (report: SmartReport) => void;
  onViewDetail: (report: SmartReport) => void;
}

/** Hiển thị danh sách báo cáo – grid card hoặc list row compact */
export function SmartReportsGrid({
  reports,
  viewMode,
  searchQuery = "",
  loading = false,
  canManage = false,
  onDeleteReport,
  onViewDetail
}: SmartReportsGridProps) {
  if (loading) {
    return (
      <div className="text-center p-12 text-muted-foreground">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        Đang tải...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<IconFileSearch className="size-12 text-muted-foreground/30" />}
        title={searchQuery ? "Không tìm thấy báo cáo" : "Chưa có báo cáo nào"}
        description={
          searchQuery 
            ? `Không có báo cáo nào khớp với từ khóa "${searchQuery}"`
            : "Hãy tạo báo cáo đầu tiên của bạn"
        }
      />
    );
  }

  if (viewMode === "list") {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        {reports.map(report => (
          <SmartReportRow
            key={report.id}
            report={report}
            query={searchQuery}
            canManage={canManage}
            onDelete={onDeleteReport}
            onClick={onViewDetail}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {reports.map(report => (
        <SmartReportCard
          key={report.id}
          report={report}
          query={searchQuery}
          canManage={canManage}
          onDelete={onDeleteReport}
          onClick={onViewDetail}
        />
      ))}
    </div>
  );
}