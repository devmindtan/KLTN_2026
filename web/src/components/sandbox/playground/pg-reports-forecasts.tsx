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

import { ReportRow }              from "@/components/reports/report-row"
import { ReportCard }             from "@/components/reports/report-card"
import { ForecastStatCards }      from "@/components/dashboard/forecast/forecast-stat-cards"
import { ForecastRollingChart }   from "@/components/dashboard/forecast/forecast-rolling-chart"
import { ForecastHistoryTable }   from "@/components/dashboard/forecast/forecast-history-table"
import { HistoryTable }           from "@/components/reports/history-table"
import {
  MOCK_REPORTS, MOCK_HISTORY,
  type ReportData,
} from "@/components/reports/reports-types"

type ViewMode     = "list" | "grid"
type ReportType   = "all" | "daily" | "weekly" | "monthly" | "incident"
type StatusFilter = "all" | "ready" | "processing" | "failed"

/** Playground: Báo cáo & Dự báo – toàn trang */
export function PgReportsForecasts() {
  const [activeTab,     setActiveTab]     = useState("reports")
  const [viewMode,      setViewMode]      = useState<ViewMode>("list")
  const [searchQuery,   setSearchQuery]   = useState("")
  const [typeFilter,    setTypeFilter]    = useState<ReportType>("all")
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all")
  const [reports,       setReports]       = useState<ReportData[]>([])
  const [loading,       setLoading]       = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      await new Promise(r => setTimeout(r, 300))
      setReports(MOCK_REPORTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const filteredReports = reports.filter(r => {
    if (typeFilter   !== "all" && r.type   !== typeFilter)   return false
    if (statusFilter !== "all" && r.status !== statusFilter) return false
    if (searchQuery.trim()) {
      if (!r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
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
                <SelectItem value="processing">Đang xử lý</SelectItem>
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
