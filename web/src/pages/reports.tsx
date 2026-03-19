/**
 * Trang Smart Reports - Báo cáo phân tích hoàn chỉnh  
 * Enhanced với template system và dual download (PDF + XLSX)
 */
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconFileText,
  IconHistory,
  IconPlus,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { useLoading } from "@/contexts/LoadingContext";
import { useAuth } from "@/contexts/AuthContext";
import { REPORTS_TERM } from "@/lib/app-constants";

import { CreateReportDialog } from "@/components/reports/create-report-dialog";
import { SmartReportsFilters } from "@/components/reports/smart-reports-filters";
import { SmartReportsGrid } from "@/components/reports/smart-reports-grid";
import { HistoryTable } from "@/components/reports/history-table";
import { ReportDetailSheet } from "@/components/reports/report-detail-sheet";
import {
  getReports,
  createReport,
  deleteReport,
  pollReportStatus,
  getReportHistory,
  type SmartReport,
  type CreateReportRequest
} from "@/services/reports.service";
import { MOCK_HISTORY, type HistoryEntry } from "@/components/reports/reports-types";

type ViewMode = "list" | "grid";
type ReportType = "all" | "daily" | "weekly" | "monthly" | "quarterly" | "incident" | "custom";
type StatusFilter = "all" | "pending" | "generating" | "ready" | "failed";

/** Trang Smart Reports với enhanced features */
export default function ReportsPage() {
  const { startLoading, stopLoading } = useLoading();
  const { role } = useAuth();
  const isTechnician = role === "technician";

  // States
  const [activeTab, setActiveTab] = useState("reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReportType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [reports, setReports] = useState<SmartReport[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLocalLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SmartReport | null>(null);
  const [pollingCleanups, setPollingCleanups] = useState<Map<string, () => void>>(new Map());
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const startPollingReport = useCallback(async (reportId: string) => {
    if (pollingCleanups.has(reportId)) return; // Already polling

    const cleanup = await pollReportStatus(reportId, (updatedReport) => {
      setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r));

      // Stop polling if completed
      if (["ready", "failed"].includes(updatedReport.status)) {
        cleanup();
        setPollingCleanups(prev => {
          const newMap = new Map(prev);
          newMap.delete(reportId);
          return newMap;
        });
      }
    });

    setPollingCleanups(prev => new Map(prev).set(reportId, cleanup));
  }, [pollingCleanups]);

  // Fetch reports with filters
  const fetchReports = useCallback(async () => {
    setLocalLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery || undefined,
      };

      if (typeFilter !== "all") params.type = typeFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const result = await getReports(params);
      setReports(result.data);
      setPagination(result.pagination);

      // Start polling for generating reports  
      result.data.forEach(report => {
        if (report.status === "generating" || report.status === "pending") {
          startPollingReport(report.id);
        }
      });

    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLocalLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, typeFilter, statusFilter, startPollingReport]);

  // Handle create report
  const handleCreateReport = async (request: CreateReportRequest) => {
    try {
      startLoading();
      const result = await createReport(request);
      setCreateDialogOpen(false);
      
      // Refresh reports list
      fetchReports();
      
      // Start polling for new report
      startPollingReport(result.data.id);
      
      // TODO: Show success toast
      console.log("Report creation started:", result.data.message);
      
    } catch (error) {
      console.error("Failed to create report:", error);
      // TODO: Show error toast
    } finally {
      stopLoading();
    }
  };

  // Handle view detail
  const handleViewDetail = (report: SmartReport) => {
    setSelectedReport(report);
    setDetailSheetOpen(true);
  };

  // Handle delete report
  const handleDeleteReport = async (report: SmartReport) => {
    if (!confirm(`Bạn có chắc muốn xóa báo cáo "${report.title}"?`)) return;

    try {
      await deleteReport(report.id);
      setReports(prev => prev.filter(r => r.id !== report.id));
      
      // Clean up polling
      const cleanup = pollingCleanups.get(report.id);
      if (cleanup) {
        cleanup();
        setPollingCleanups(prev => {
          const newMap = new Map(prev);
          newMap.delete(report.id);
          return newMap;
        });
      }
      
      // TODO: Show success toast
      
    } catch (error) {
      console.error("Failed to delete report:", error);
      // TODO: Show error toast
    }
  };

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await getReportHistory({ limit: 50, offset: 0 });
      setHistoryEntries(result.data);
    } catch (error) {
      console.error("Failed to fetch report history:", error);
      // Fallback to mock data
      setHistoryEntries(MOCK_HISTORY);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Effect: Fetch initial data
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Effect: Reset page when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchQuery, typeFilter, statusFilter]);

  // Effect: Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingCleanups.forEach(cleanup => cleanup());
    };
  }, [pollingCleanups]);

  // Effect: Fetch history when history tab is active
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Filter reports for display
  const filteredReports = reports.filter(report => {
    if (typeFilter !== "all" && report.type !== typeFilter) return false;
    if (statusFilter !== "all" && report.status !== statusFilter) return false;
    if (searchQuery && !report.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Page Header */}
      <PageHeader
        icon={<IconFileText className="size-5" />}
        title={REPORTS_TERM.page_header.title}
        description="Báo cáo phân tích hoàn chỉnh với output PDF executive summary + XLSX structured data cho AI"
      >
        {isTechnician && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateDialogOpen(true)}>
            <IconPlus className="size-4" />
            Tạo báo cáo
          </Button>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="reports" className="gap-1.5 text-xs">
            <IconFileText className="size-3.5" />
            Báo cáo
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {reports.filter(r => r.status === "ready").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <IconHistory className="size-3.5" />
            Lịch sử
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB SMART REPORTS ══════════════ */}
        <TabsContent value="reports" className="mt-0 flex flex-col gap-3">
          {/* Filter bar */}
          <SmartReportsFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRefresh={fetchReports}
            refreshLoading={loading}
          />

          {/* Reports display */}
          <SmartReportsGrid
            reports={filteredReports}
            viewMode={viewMode}
            searchQuery={searchQuery}
            loading={loading}
            canManage={isTechnician}
            onDeleteReport={handleDeleteReport}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>

        {/* ══════════════ TAB LỊCH SỬ ══════════════ */}
        <TabsContent value="history" className="mt-0">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Đang tải lịch sử...
            </div>
          ) : (
            <HistoryTable entries={historyEntries} />
          )}
        </TabsContent>
      </Tabs>

      {/* Create Report Dialog – chỉ technician mới có quyền tạo */}
      {isTechnician && (
        <CreateReportDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSubmit={handleCreateReport}
          loading={loading}
        />
      )}

      {/* Report Detail Sheet */}
      <ReportDetailSheet
        report={selectedReport}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
