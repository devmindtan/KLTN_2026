/**
 * Trang Báo cáo & Dự báo
 * Tab "Báo cáo": list view (mặc định) + grid toggle
 * Tab "Dự báo": dashboard realtime 4 zone (summary, chart, next slot, history)
 * Tab "Lịch sử": audit log thao tác
 */
import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconFileText,
  IconChartBar,
  IconHistory,
  IconSearch,
  IconList,
  IconLayoutGrid,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { useLoading } from "@/contexts/LoadingContext";

import { ReportRow }  from "@/components/reports-forecasts/report-row";
import { ReportCard } from "@/components/reports-forecasts/report-card";
import { ForecastSummaryBar }    from "@/components/reports-forecasts/forecast-summary-bar";
import { ForecastTimelineChart } from "@/components/reports-forecasts/forecast-timeline-chart";
import { ForecastNextPanel }     from "@/components/reports-forecasts/forecast-next-panel";
import { ForecastHistoryTable }  from "@/components/reports-forecasts/forecast-history-table";
import { HistoryTable }          from "@/components/reports-forecasts/history-table";
import {
  MOCK_REPORTS,
  MOCK_FORECAST_SLOTS,
  MOCK_FORECAST_SUMMARY,
  MOCK_HISTORY,
  type ReportData,
} from "@/components/reports-forecasts/reports-types";

type ViewMode   = "list" | "grid";
type ReportType = "all" | "daily" | "weekly" | "monthly" | "incident";
type StatusFilter = "all" | "ready" | "processing" | "failed";

/** Trang Báo cáo & Dự báo giao thông */
export default function ReportsForecastsPage() {
  const { startLoading, stopLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Tab state ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("reports");

  // Auto-switch tab khi được điều hướng từ nơi khác (ví dụ: dashboard chart)
  useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab) {
      setActiveTab(state.tab);
      // Clear state để tránh re-trigger khi navigate qua lại
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Báo cáo state ────────────────────────────────────
  const [viewMode,      setViewMode]      = useState<ViewMode>("list");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [typeFilter,    setTypeFilter]    = useState<ReportType>("all");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");
  const [reports,       setReports]       = useState<ReportData[]>([]);

  // ── Fetch giả lập (sẽ thay bằng API) ─────────────────
  const fetchReports = useCallback(async () => {
    startLoading();
    try {
      await new Promise(r => setTimeout(r, 400));
      setReports(MOCK_REPORTS);
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── Filter logic ──────────────────────────────────────
  const filteredReports = reports.filter(r => {
    if (typeFilter   !== "all" && r.type   !== typeFilter)   return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconFileText className="size-5" />}
        title="Báo cáo & Dự báo"
        description="Quản lý báo cáo lưu lượng và phân tích dự báo realtime"
      >
        <Button variant="outline" size="sm" onClick={fetchReports} className="gap-1.5">
          <IconRefresh className="size-4" />
          Làm mới
        </Button>
        <Button size="sm" className="gap-1.5">
          <IconPlus className="size-4" />
          Tạo báo cáo
        </Button>
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
          <TabsTrigger value="forecast" className="gap-1.5 text-xs">
            <IconChartBar className="size-3.5" />
            Dự báo
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <IconHistory className="size-3.5" />
            Lịch sử
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB BÁO CÁO ══════════════ */}
        <TabsContent value="reports" className="mt-0 flex flex-col gap-3">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm báo cáo..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as ReportType)}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="daily">Ngày</SelectItem>
                <SelectItem value="weekly">Tuần</SelectItem>
                <SelectItem value="monthly">Tháng</SelectItem>
                <SelectItem value="incident">Sự cố</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="ready">Sẵn sàng</SelectItem>
                <SelectItem value="processing">Đang xử lý</SelectItem>
                <SelectItem value="failed">Lỗi</SelectItem>
              </SelectContent>
            </Select>

            {/* Spacer */}
            <div className="flex-1" />

            {/* View mode toggle */}
            <div className="flex gap-0.5 border rounded-md p-0.5">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => setViewMode("list")}
                title="Dạng danh sách"
              >
                <IconList className="size-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => setViewMode("grid")}
                title="Dạng lưới"
              >
                <IconLayoutGrid className="size-4" />
              </Button>
            </div>
          </div>

          {/* Count */}
          <p className="text-xs text-muted-foreground">
            {filteredReports.length} báo cáo{searchQuery ? ` phù hợp với "${searchQuery}"` : ""}
          </p>

          {/* List view */}
          {viewMode === "list" ? (
            <div className="rounded-lg border bg-card overflow-hidden">
              {filteredReports.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Không tìm thấy báo cáo nào</div>
              ) : (
                filteredReports.map(r => (
                  <ReportRow key={r.id} report={r} query={searchQuery} />
                ))
              )}
            </div>
          ) : (
            /* Grid view */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReports.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">Không tìm thấy báo cáo nào</div>
              ) : (
                filteredReports.map(r => (
                  <ReportCard key={r.id} report={r} query={searchQuery} />
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* ══════════════ TAB DỰ BÁO ══════════════ */}
        <TabsContent value="forecast" className="mt-0 flex flex-col gap-4">
          {/* Zone 1 – Summary */}
          <ForecastSummaryBar summary={MOCK_FORECAST_SUMMARY} />

          {/* Zone 2 + 3 – Chart + Next panel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <ForecastTimelineChart />
            <ForecastNextPanel slots={MOCK_FORECAST_SLOTS} />
          </div>

          {/* Zone 4 – History table */}
          <ForecastHistoryTable slots={MOCK_FORECAST_SLOTS} />
        </TabsContent>

        {/* ══════════════ TAB LỊCH SỬ ══════════════ */}
        <TabsContent value="history" className="mt-0">
          <HistoryTable entries={MOCK_HISTORY} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
