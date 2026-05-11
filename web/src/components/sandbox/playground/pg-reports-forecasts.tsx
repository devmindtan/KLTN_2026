/**
 * Playground: Trang Báo cáo & Dự báo – mô phỏng đầy đủ reports-forecasts page
 * Tái sử dụng toàn bộ components thực từ reports-forecasts với mock data
 */
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/custom/search-input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  IconFileText, IconChartBar, IconHistory,
  IconList, IconLayoutGrid, IconPlus, IconRefresh,
} from "@tabler/icons-react"

import { SmartReportRow as ReportRow }   from "@/components/reports/smart-report-row"
import { SmartReportCard as ReportCard } from "@/components/reports/smart-report-card"
import { ForecastStatCards }      from "@/components/dashboard/forecast/forecast-stat-cards"
import { ForecastRollingChart }   from "@/components/dashboard/forecast/forecast-rolling-chart"
import { ForecastHistoryTable }   from "@/components/dashboard/forecast/forecast-history-table"
import { HistoryTable }           from "@/components/reports/history-table"
import { MOCK_HISTORY }           from "@/components/reports/reports-types"
import type { SmartReport }       from "@/services/reports.service"

const MOCK_SMART_REPORTS: SmartReport[] = [
  {
    id: "r001", title: "Báo cáo lưu lượng ngày 18/03/2026",
    type: "daily", period_from: "2026-03-18T00:00:00Z", period_to: "2026-03-18T23:59:59Z",
    status: "ready", files_json: { pdf: { path: "/reports/r001.pdf", sizeMB: 1.2, url: "#" } },
    summary_json: null, settings_json: null,
    created_by: "adminuser", created_at: "2026-03-18T07:00:00Z",
    generated_at: "2026-03-18T07:05:00Z", error_message: null,
  },
  {
    id: "r002", title: "Báo cáo tuần 09–15/03/2026",
    type: "weekly", period_from: "2026-03-09T00:00:00Z", period_to: "2026-03-15T23:59:59Z",
    status: "ready", files_json: { pdf: { path: "/reports/r002.pdf", sizeMB: 3.5, url: "#" }, xlsx: { path: "/reports/r002.xlsx", sizeMB: 1.8, url: "#" } },
    summary_json: null, settings_json: null,
    created_by: "analyst", created_at: "2026-03-16T08:00:00Z",
    generated_at: "2026-03-16T08:10:00Z", error_message: null,
  },
  {
    id: "r003", title: "Báo cáo tháng 02/2026",
    type: "monthly", period_from: "2026-02-01T00:00:00Z", period_to: "2026-02-28T23:59:59Z",
    status: "generating", files_json: null,
    summary_json: null, settings_json: null,
    created_by: "adminuser", created_at: "2026-03-01T09:00:00Z",
    generated_at: null, error_message: null,
  },
  {
    id: "r004", title: "Báo cáo sự cố ùn tắc giao lộ Nguyễn Huệ",
    type: "incident", period_from: "2026-03-17T07:30:00Z", period_to: "2026-03-17T09:15:00Z",
    status: "failed", files_json: null,
    summary_json: null, settings_json: null,
    created_by: "operator", created_at: "2026-03-17T10:00:00Z",
    generated_at: null, error_message: "Không đủ dữ liệu camera trong khoảng thời gian yêu cầu",
  },
]

type ViewMode     = "list" | "grid"
type ReportType   = "all" | "daily" | "weekly" | "monthly" | "incident"
type StatusFilter = "all" | "ready" | "generating" | "failed"

/** Playground: Báo cáo & Dự báo – toàn trang */
export function PgReportsForecasts() {
  const [activeTab,     setActiveTab]     = useState("reports")
  const [viewMode,      setViewMode]      = useState<ViewMode>("list")
  const [searchQuery,   setSearchQuery]   = useState("")
  const [typeFilter,    setTypeFilter]    = useState<ReportType>("all")
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all")
  const [reports,       setReports]       = useState<SmartReport[]>([])
  const [loading,       setLoading]       = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      await new Promise(r => setTimeout(r, 300))
      setReports(MOCK_SMART_REPORTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const filteredReports = reports.filter(r => {
    if (typeFilter   !== "all" && r.type   !== typeFilter)   return false
    if (statusFilter !== "all" && r.status !== statusFilter) return false
    if (searchQuery.trim()) {
      if (!r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Mini header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <IconFileText className="size-4 text-primary" />
            Báo cáo &amp; Dự báo
          </p>
          <p className="text-xs text-muted-foreground">Quản lý báo cáo lưu lượng và phân tích dự báo realtime</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="gap-1.5 h-8 text-xs">
            <IconRefresh className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <IconPlus className="size-3.5" />
            Tạo báo cáo
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="w-fit h-8">
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

        {/* ══ TAB BÁO CÁO ══ */}
        <TabsContent value="reports" className="mt-0 flex flex-col gap-3">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              size="sm"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Tìm kiếm báo cáo..."
              className="flex-1 min-w-[180px] max-w-sm"
            />
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as ReportType)}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Loại" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="daily">Ngày</SelectItem>
                <SelectItem value="weekly">Tuần</SelectItem>
                <SelectItem value="monthly">Tháng</SelectItem>
                <SelectItem value="incident">Sự cố</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="ready">Sẵn sàng</SelectItem>
                <SelectItem value="generating">Đang tạo</SelectItem>
                <SelectItem value="failed">Lỗi</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <div className="flex gap-0.5 border rounded-md p-0.5">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon" className="size-7"
                onClick={() => setViewMode("list")} title="Danh sách"
              >
                <IconList className="size-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon" className="size-7"
                onClick={() => setViewMode("grid")} title="Lưới"
              >
                <IconLayoutGrid className="size-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredReports.length} báo cáo{searchQuery ? ` phù hợp với "${searchQuery}"` : ""}
          </p>

          {viewMode === "list" ? (
            <div className="rounded-lg border bg-card overflow-hidden">
              {filteredReports.length === 0
                ? <div className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy báo cáo nào</div>
                : filteredReports.map(r => <ReportRow key={r.id} report={r} query={searchQuery} />)
              }
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReports.length === 0
                ? <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Không tìm thấy báo cáo nào</div>
                : filteredReports.map(r => <ReportCard key={r.id} report={r} query={searchQuery} />)
              }
            </div>
          )}
        </TabsContent>

        {/* ══ TAB DỰ BÁO ══ */}
        <TabsContent value="forecast" className="mt-0 flex flex-col gap-4">
          <ForecastStatCards apiData={null} />
          <ForecastRollingChart sharedAllData={null} />
          <ForecastHistoryTable />
        </TabsContent>

        {/* ══ TAB LỊCH SỬ ══ */}
        <TabsContent value="history" className="mt-0">
          <HistoryTable entries={MOCK_HISTORY} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
