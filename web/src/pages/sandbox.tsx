/**
 * Trang Sandbox – Kỹ thuật viên thử nghiệm UI component và giao diện thực tế
 * Chỉ accessible khi role === "technician"
 * Nhóm 1 "Thư viện": tham khảo component đơn lẻ (tabs)
 * Nhóm 2 "Thử nghiệm": trang thử nghiệm hoàn chỉnh (dropdown selector)
 */
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconFlask, IconLayoutCards, IconSection, IconLayoutNavbar,
  IconInfoCircle, IconSearch, IconTool,
  IconBooks, IconDeviceAnalytics,
  IconChartAreaLine, IconTable, IconFileText, IconForms,
} from "@tabler/icons-react"
import { LayoutDashboardIcon, CameraIcon, BrainCircuitIcon } from "lucide-react"
import { PageHeader } from "@/components/custom/page-header"
import { useAuth } from "@/contexts/AuthContext"
import { TabStatCard }          from "@/components/sandbox/library/tab-stat-card"
import { TabCardSectionHeader } from "@/components/sandbox/library/tab-card-section-header"
import { TabPageHeader }        from "@/components/sandbox/library/tab-page-header"
import { TabTooltips }          from "@/components/sandbox/library/tab-tooltips"
import { TabHighlightText }     from "@/components/sandbox/library/tab-highlight-text"
import { TabUtilities }         from "@/components/sandbox/library/tab-utilities"
import { TabCharts }            from "@/components/sandbox/library/tab-charts"
import { TabTables }            from "@/components/sandbox/library/tab-tables"
import { TabFormControls }      from "@/components/sandbox/library/tab-form-controls"
import { PgDashboard }        from "@/components/sandbox/playground/pg-dashboard"
import { PgDashboard2 }       from "@/components/sandbox/playground/pg-dashboard-2"
import { PgMonitoring }       from "@/components/sandbox/playground/pg-monitoring"
import { PgAnalytics }        from "@/components/sandbox/playground/pg-analytics"
import { PgAnalyticsNew }     from "@/components/sandbox/playground/pg-analytics-new"
import { PgReportsForecasts } from "@/components/sandbox/playground/pg-reports-forecasts"

const PLAYGROUND_PAGES = [
  { value: "dashboard",  label: "Tổng quan Dashboard",   icon: LayoutDashboardIcon },
  { value: "dashboard2", label: "Tổng quan Dashboard 2",  icon: LayoutDashboardIcon },
  { value: "monitoring", label: "Giám sát Camera",        icon: CameraIcon          },
  { value: "analytics",     label: "Phân tích Mô hình",        icon: BrainCircuitIcon    },
  { value: "analytics-new", label: "Phân tích Mô hình (Mới)",  icon: IconChartAreaLine   },
  { value: "reports",       label: "Báo cáo & Dự báo",        icon: IconFileText        },
] as const

type PlaygroundPage = typeof PLAYGROUND_PAGES[number]["value"]

/** Sandbox – playground thử nghiệm UI component và page (chỉ dành cho technician) */
export default function SandboxPage() {
  const { role, routePrefix } = useAuth()
  const [mode, setMode]       = useState<"library" | "playground">("library")
  const [pgPage, setPgPage]   = useState<PlaygroundPage>("dashboard")

  if (role !== "technician") {
    return <Navigate to={`/${routePrefix}/dashboard`} replace />
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        icon={<IconFlask className="size-5" />}
        title="Thử nghiệm giao diện"
        description="Thử nghiệm component và giao diện trước khi áp dụng vào production. Chỉ hiển thị cho kỹ thuật viên."
      >
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
          Dev only
        </Badge>
      </PageHeader>

      {/* ── Mode selector ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/50 w-fit border">
        <Button
          variant={mode === "library" ? "default" : "ghost"}
          size="sm"
          className="gap-1.5 h-7 text-xs px-3"
          onClick={() => setMode("library")}
        >
          <IconBooks className="size-3.5" />
          Thư viện
        </Button>
        <Button
          variant={mode === "playground" ? "default" : "ghost"}
          size="sm"
          className="gap-1.5 h-7 text-xs px-3"
          onClick={() => setMode("playground")}
        >
          <IconDeviceAnalytics className="size-3.5" />
          Thử nghiệm
        </Button>
      </div>

      {/* ── Group 1: Thư viện – component reference tabs ── */}
      {mode === "library" && (
        <Tabs defaultValue="stat-card" className="flex-1">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
            <TabsTrigger value="stat-card"    className="gap-1.5 text-xs"><IconLayoutCards  className="size-3.5" />StatCard</TabsTrigger>
            <TabsTrigger value="card-header"  className="gap-1.5 text-xs"><IconSection      className="size-3.5" />CardSectionHeader</TabsTrigger>
            <TabsTrigger value="page-header"  className="gap-1.5 text-xs"><IconLayoutNavbar className="size-3.5" />PageHeader</TabsTrigger>
            <TabsTrigger value="tooltips"     className="gap-1.5 text-xs"><IconInfoCircle   className="size-3.5" />InfoTooltip</TabsTrigger>
            <TabsTrigger value="highlight"    className="gap-1.5 text-xs"><IconSearch       className="size-3.5" />HighlightText</TabsTrigger>
            <TabsTrigger value="utilities"    className="gap-1.5 text-xs"><IconTool         className="size-3.5" />Utilities</TabsTrigger>
            <TabsTrigger value="charts"       className="gap-1.5 text-xs"><IconChartAreaLine className="size-3.5" />Charts</TabsTrigger>
            <TabsTrigger value="tables"       className="gap-1.5 text-xs"><IconTable        className="size-3.5" />Tables</TabsTrigger>
            <TabsTrigger value="form-controls" className="gap-1.5 text-xs"><IconForms        className="size-3.5" />Form Controls</TabsTrigger>
          </TabsList>
          <TabsContent value="stat-card"   className="mt-4"><Card><CardContent className="pt-4"><TabStatCard /></CardContent></Card></TabsContent>
          <TabsContent value="card-header" className="mt-4"><Card><CardContent className="pt-4"><TabCardSectionHeader /></CardContent></Card></TabsContent>
          <TabsContent value="page-header" className="mt-4"><Card><CardContent className="pt-4"><TabPageHeader /></CardContent></Card></TabsContent>
          <TabsContent value="tooltips"    className="mt-4"><Card><CardContent className="pt-4"><TabTooltips /></CardContent></Card></TabsContent>
          <TabsContent value="highlight"   className="mt-4"><Card><CardContent className="pt-4"><TabHighlightText /></CardContent></Card></TabsContent>
          <TabsContent value="utilities"   className="mt-4"><Card><CardContent className="pt-4"><TabUtilities /></CardContent></Card></TabsContent>
          <TabsContent value="charts"       className="mt-4"><Card><CardContent className="pt-4"><TabCharts /></CardContent></Card></TabsContent>
          <TabsContent value="tables"       className="mt-4"><Card><CardContent className="pt-4"><TabTables /></CardContent></Card></TabsContent>
          <TabsContent value="form-controls" className="mt-4"><Card><CardContent className="pt-4"><TabFormControls /></CardContent></Card></TabsContent>
        </Tabs>
      )}

      {/* ── Group 2: Thử nghiệm – full page playground ── */}
      {mode === "playground" && (
        <div className="flex flex-col gap-4 flex-1">
          {/* Page selector */}
          <div className="flex items-center gap-3">
            <Select value={pgPage} onValueChange={v => setPgPage(v as PlaygroundPage)}>
              <SelectTrigger className="w-64 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYGROUND_PAGES.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <p.icon className="size-3.5 text-muted-foreground" />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {PLAYGROUND_PAGES.find(p => p.value === pgPage)?.label}
            </span>
          </div>

          {/* Playground page render */}
          <Card className="flex-1">
            <CardContent className="pt-4">
              {pgPage === "dashboard"  && <PgDashboard        />}
              {pgPage === "dashboard2" && <PgDashboard2       />}
              {pgPage === "monitoring" && <PgMonitoring        />}
              {pgPage === "analytics"     && <PgAnalytics         />}
              {pgPage === "analytics-new" && <PgAnalyticsNew      />}
              {pgPage === "reports"        && <PgReportsForecasts  />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
