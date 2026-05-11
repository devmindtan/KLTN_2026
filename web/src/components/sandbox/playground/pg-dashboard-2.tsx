/**
 * Playground: Tổng quan Dashboard 2 — layout cải tiến với Recharts thực và dữ liệu giả
 * Cùng cấu trúc với Dashboard thực: SectionCards + AreaChart + ForecastAccuracy + TrafficDensity + Table
 */
import { useState } from "react"
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, XAxis, YAxis, LabelList,
} from "recharts"
import {
  ActivityIcon, CameraIcon, ShieldIcon, TrendingUpIcon, TrendingDownIcon,
  MinusIcon, AlertTriangleIcon, CheckCircle2Icon,
} from "lucide-react"
import { IconShieldCheck, IconChartHistogram, IconChartAreaLine } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart"
import { StatCard } from "@/components/custom/stat-card"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { cn } from "@/lib/utils"

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CAMERAS = [
  { id: "CAM-01", name: "Ngã tư Đinh Tiên Hoàng – ĐBP", total: 148, car: 93, moto: 55, status: "free_flow", trend: "stable", vc: 58, forecast5m: 151, gti: 61.2 },
  { id: "CAM-02", name: "Nút giao ĐBP – 3/2",            total: 192, car: 117,moto: 75, status: "moderate", trend: "up",     vc: 74, forecast5m: 201, gti: 78.4 },
  { id: "CAM-03", name: "Đường Lê Lợi – Cầu Bông",       total: 97,  car: 60, moto: 37, status: "free_flow", trend: "down",   vc: 46, forecast5m: 89,  gti: 43.1 },
  { id: "CAM-04", name: "Ngã tư Cộng Hoà – Trường Chinh", total: 228, car: 145,moto: 83, status: "heavy",    trend: "up",     vc: 89, forecast5m: 243, gti: 91.5 },
  { id: "CAM-05", name: "Đại lộ Đông Tây – Hầm sông SG", total: 261, car: 178,moto: 83, status: "congested",trend: "up",     vc: 96, forecast5m: 274, gti: 98.2 },
  { id: "CAM-06", name: "Quốc lộ 13 – Bình Phước",       total: 134, car: 79, moto: 55, status: "smooth",   trend: "down",   vc: 63, forecast5m: 128, gti: 59.8 },
  { id: "CAM-07", name: "Cầu Sài Gòn – Xa lộ HN",        total: 176, car: 109,moto: 67, status: "moderate", trend: "stable", vc: 71, forecast5m: 178, gti: 72.3 },
]

/** 12 giờ gần nhất (07:00 → 18:00) — lưu lượng trung bình thực tế + dự báo */
const AREA_CHART_DATA = [
  { label: "07:00", actual: 312, forecast: 318 },
  { label: "08:00", actual: 487, forecast: 495 },
  { label: "09:00", actual: 563, forecast: 558 },
  { label: "10:00", actual: 441, forecast: 450 },
  { label: "11:00", actual: 398, forecast: 405 },
  { label: "12:00", actual: 352, forecast: 348 },
  { label: "13:00", actual: 410, forecast: 418 },
  { label: "14:00", actual: 456, forecast: 452 },
  { label: "15:00", actual: 501, forecast: 510 },
  { label: "16:00", actual: 598, forecast: 585 },
  { label: "17:00", actual: 643, forecast: 652 },
  { label: "18:00", actual: null, forecast: 631 },
]

/** Lưu lượng trung bình theo giờ trong ngày (pattern hôm nay) */
const BAR_CHART_DATA = [
  { label: "06:00", avg: 198, max: 271 },
  { label: "07:00", avg: 312, max: 434 },
  { label: "08:00", avg: 487, max: 621 },
  { label: "09:00", avg: 563, max: 702 },
  { label: "10:00", avg: 441, max: 578 },
  { label: "11:00", avg: 398, max: 512 },
  { label: "12:00", avg: 352, max: 447 },
  { label: "13:00", avg: 410, max: 530 },
  { label: "14:00", avg: 456, max: 591 },
  { label: "15:00", avg: 501, max: 635 },
  { label: "16:00", avg: 598, max: 743 },
  { label: "17:00", avg: 643, max: 798 },
  { label: "18:00", avg: 521, max: 671 },
  { label: "19:00", avg: 389, max: 498 },
  { label: "20:00", avg: 274, max: 351 },
  { label: "21:00", avg: 187, max: 248 },
  { label: "22:00", avg: 121, max: 162 },
  { label: "23:00", avg: 74,  max: 98  },
]

/** Độ tin cậy dự đoán theo mốc (giả) */
const FORECAST_HORIZONS = [
  { horizon: "5 phút",  accuracy: 91, mae: 12.4 },
  { horizon: "10 phút", accuracy: 87, mae: 18.7 },
  { horizon: "15 phút", accuracy: 83, mae: 24.1 },
  { horizon: "30 phút", accuracy: 76, mae: 33.8 },
  { horizon: "60 phút", accuracy: 68, mae: 47.2 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOS_MAP: Record<string, { label: string; cls: string; short: string }> = {
  free_flow: { label: "Thông thoáng", short: "A",  cls: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400" },
  smooth:    { label: "Trôi chảy",   short: "B",  cls: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
  moderate:  { label: "Trung bình",  short: "C",  cls: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400" },
  heavy:     { label: "Nặng",        short: "D",  cls: "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400" },
  congested: { label: "Ùn tắc",      short: "E",  cls: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400" },
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "up")   return <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400"><TrendingUpIcon className="size-3" />Tăng</Badge>
  if (trend === "down") return <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"><TrendingDownIcon className="size-3" />Giảm</Badge>
  return <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 text-muted-foreground border-border"><MinusIcon className="size-3" />Ổn định</Badge>
}

function AccuracyBadge({ value }: { value: number }) {
  if (value >= 80) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">{value}%</Badge>
  if (value >= 65) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">{value}%</Badge>
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">{value}%</Badge>
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const areaConfig = {
  actual:   { label: "Thực tế",  color: "var(--primary)" },
  forecast: { label: "Dự báo",   color: "var(--chart-2)" },
} satisfies ChartConfig

const barConfig = {
  avg: { label: "TB xe / giờ", color: "var(--chart-1)" },
  max: { label: "Max xe",      color: "var(--chart-2)" },
} satisfies ChartConfig

// ─── Derived mock metrics (same shape as real SectionCards) ──────────────────
const TOTAL     = MOCK_CAMERAS.reduce((s, c) => s + c.total, 0)
const TOTAL_CAR = MOCK_CAMERAS.reduce((s, c) => s + c.car, 0)
const TOTAL_MOTO= MOCK_CAMERAS.reduce((s, c) => s + c.moto, 0)
const GOOD      = MOCK_CAMERAS.filter(c => c.status === "free_flow" || c.status === "smooth").length
const MODERATE  = MOCK_CAMERAS.filter(c => c.status === "moderate").length
const BAD       = MOCK_CAMERAS.filter(c => c.status === "heavy"    || c.status === "congested").length
const TREND_UP  = MOCK_CAMERAS.filter(c => c.trend === "up").length
const TREND_DOWN= MOCK_CAMERAS.filter(c => c.trend === "down").length
const AVG_VEH   = Math.round(TOTAL / MOCK_CAMERAS.length)
const TREND_PCT = Math.round(TREND_UP / MOCK_CAMERAS.length * 100)
const BAD_PCT   = Math.round(BAD     / MOCK_CAMERAS.length * 100)

// ─── Component ────────────────────────────────────────────────────────────────

/** Playground: Dashboard 2 — layout cải tiến với Recharts thực */
export function PgDashboard2() {
  const [densityTab, setDensityTab] = useState<"hour" | "dow">("hour")

  return (
    <div className="space-y-5">

      {/* ── Section 1: StatCards (giống hệt dashboard thực) ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* Card 1 — Tổng Phương Tiện */}
        <StatCard
          title="Tổng Phương Tiện"
          tooltip="Tổng số phương tiện được phát hiện trên toàn bộ camera đang hoạt động"
          headerRight={
            <>
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              <ActivityIcon className="size-4 text-blue-500" />
            </>
          }
          value={TOTAL.toLocaleString("vi-VN")}
          sub1={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">{TOTAL_CAR} ô tô</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400">{TOTAL_MOTO} xe máy</Badge>
            </div>
          }
          sub2={<p className="text-[11px] text-muted-foreground mt-1.5">Phát hiện thời gian thực</p>}
        />

        {/* Card 2 — Camera Hoạt Động */}
        <StatCard
          title="Camera Hoạt Động"
          tooltip="Số camera đang gửi dữ liệu về hệ thống"
          headerRight={<CameraIcon className="size-4 text-purple-500" />}
          value={MOCK_CAMERAS.length}
          sub1={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">{GOOD} tốt</Badge>
              {MODERATE > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">{MODERATE} trung bình</Badge>}
              {BAD > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">{BAD} tắc</Badge>}
            </div>
          }
          sub2={<p className="text-[11px] text-muted-foreground mt-1.5">Trung bình {AVG_VEH} xe / camera</p>}
        />

        {/* Card 3 — Tình Trạng Giao Thông */}
        <StatCard
          title="Tình Trạng Giao Thông"
          tooltip="Số camera ở trạng thái thông thoáng. Thanh màu thể hiện tỉ lệ xanh/vàng/đỏ."
          headerRight={<ShieldIcon className={cn("size-4", BAD_PCT > 50 ? "text-red-500" : "text-green-500")} />}
          value={
            <span className="flex items-end gap-2">
              {GOOD}
              <span className="text-sm font-normal text-muted-foreground mb-0.5">/ {MOCK_CAMERAS.length} thông thoáng</span>
            </span>
          }
          sub1={
            <div className="flex items-center gap-1.5 mt-1.5">
              {BAD > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">{BAD} ùn tắc</Badge>}
              {MODERATE > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">{MODERATE} trung bình</Badge>}
            </div>
          }
          sub2={
            <>
              <p className="text-[11px] text-muted-foreground mt-1">{BAD_PCT}% camera có tắc nghẽn</p>
              <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-muted">
                <div className="bg-green-500 transition-all rounded-l-full" style={{ width: `${(GOOD / MOCK_CAMERAS.length) * 100}%` }} />
                <div className="bg-yellow-400 transition-all" style={{ width: `${(MODERATE / MOCK_CAMERAS.length) * 100}%` }} />
                <div className="bg-red-500 transition-all rounded-r-full" style={{ width: `${(BAD / MOCK_CAMERAS.length) * 100}%` }} />
              </div>
            </>
          }
        />

        {/* Card 4 — Xu Hướng Mạng Lưới */}
        <StatCard
          title="Xu Hướng Mạng Lưới"
          tooltip="Tỉ lệ % camera đang có xu hướng tăng lưu lượng so với chu kỳ trước"
          headerRight={<TrendingUpIcon className="size-4 text-orange-500" />}
          value={`${TREND_PCT}%`}
          sub1={<p className="text-[11px] text-muted-foreground mt-0.5">Mật độ đang tăng</p>}
          sub2={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">↑ {TREND_UP} tăng</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">↓ {TREND_DOWN} giảm</Badge>
            </div>
          }
        />
      </div>

      {/* ── Section 2: AreaChart + ForecastAccuracy ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* AreaChart — dự báo lưu lượng */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardSectionHeader
              icon={IconChartAreaLine}
              title="Dự báo lưu lượng giao thông"
              iconBg="bg-blue-500/10"
              iconColor="text-blue-600"
              description="Thực tế vs Dự báo — 07:00→18:00 toàn mạng lưới"
              action={
                <span className="text-[11px] text-primary font-medium cursor-pointer hover:underline shrink-0">
                  Xem chi tiết →
                </span>
              }
            />
          </CardHeader>
          <CardContent className="px-2 pt-2 sm:px-4">
            <ChartContainer config={areaConfig} className="h-[230px] w-full">
              <AreaChart data={AREA_CHART_DATA} margin={{ top: 12, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-actual)"   stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--color-actual)"   stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-forecast)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--color-forecast)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 10 }} />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                        <p className="font-medium mb-1.5">{label}</p>
                        {payload.map(p => (
                          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                              <span className="text-muted-foreground">{p.dataKey === "actual" ? "Thực tế" : "Dự báo"}</span>
                            </div>
                            <span className="font-semibold tabular-nums">{p.value ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Area dataKey="actual"   type="monotone" fill="url(#fillActual)"   stroke="var(--color-actual)"   strokeWidth={2} dot={false} connectNulls={false} />
                <Area dataKey="forecast" type="monotone" fill="url(#fillForecast)" stroke="var(--color-forecast)" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </AreaChart>
            </ChartContainer>
            <div className="flex items-center gap-4 justify-center mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 border-t-2" style={{ borderColor: "var(--primary)" }} />
                <span>Thực tế</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--chart-2)" }} />
                <span>Dự báo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ForecastAccuracy card */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardSectionHeader
              icon={IconShieldCheck}
              title="Độ tin cậy dự đoán"
              iconBg="bg-green-500/10"
              iconColor="text-green-600"
              description="Tỷ lệ sai số ≤5 xe theo mốc"
            />
          </CardHeader>
          <CardContent className="flex-1 pb-2">
            {/* Column headers */}
            <div className="flex justify-between items-center pb-1.5 mb-1 border-b border-border">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mốc</span>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">MAE</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground w-10 text-right">Acc</span>
              </div>
            </div>
            <div className="flex flex-col">
              {FORECAST_HORIZONS.map(h => (
                <div key={h.horizon} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-xs font-medium">{h.horizon}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{h.mae}</span>
                    <div className="w-10 flex justify-end">
                      <AccuracyBadge value={h.accuracy} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="py-2.5 px-4">
            <p className="text-[11px] text-muted-foreground">
              Mô hình: <span className="font-medium text-foreground">Random Forest v2.1</span>
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* ── Section 3: Traffic Density BarChart ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardSectionHeader
                icon={IconChartHistogram}
                title="Giao động mật độ giao thông"
                iconBg="bg-violet-500/10"
                iconColor="text-violet-600"
                description="Phân tích lưu lượng trung bình theo chu kỳ thời gian"
              />
            </div>
            <Tabs value={densityTab} onValueChange={v => setDensityTab(v as "hour" | "dow")} className="shrink-0">
              <TabsList className="h-7">
                <TabsTrigger value="hour" className="text-xs px-3 h-6">Hôm nay</TabsTrigger>
                <TabsTrigger value="dow"  className="text-xs px-3 h-6">7 ngày</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <ChartContainer config={barConfig} className="h-[260px] w-full">
            <BarChart
              data={densityTab === "hour" ? BAR_CHART_DATA : DOW_DATA}
              barGap={2}
              margin={{ top: 16, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} height={36} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--foreground))", opacity: 0.05 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                      <p className="font-medium mb-1.5">{label}</p>
                      {payload.map(p => (
                        <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="text-muted-foreground">{p.dataKey === "avg" ? "Trung bình" : "Cao nhất"}</span>
                          </div>
                          <span className="font-semibold tabular-nums">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Bar dataKey="avg" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="avg" position="insideTop" offset={4} style={{ fontSize: 9, fill: "oklch(0.985 0 0)", fontWeight: 700 }} formatter={(v: number) => v === 0 ? "" : String(v)} />
              </Bar>
              <Bar dataKey="max" fill="var(--chart-2)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
          <div className="flex items-center gap-4 justify-center mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-1)]" /><span>Trung bình</span></div>
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-2)] opacity-85" /><span>Cao nhất</span></div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Camera Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardSectionHeader
            icon={CameraIcon}
            title="Nguồn camera trực tiếp"
            iconBg="bg-teal-500/10"
            iconColor="text-teal-600"
            description="Giám sát luồng giao thông thời gian thực"
            badge={
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                {MOCK_CAMERAS.length} camera
              </Badge>
            }
          />
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="pl-4">Camera</TableHead>
                <TableHead className="text-right">Tổng xe</TableHead>
                <TableHead className="hidden md:table-cell text-right">Ô tô</TableHead>
                <TableHead className="hidden md:table-cell text-right">Xe máy</TableHead>
                <TableHead className="hidden sm:table-cell">Trạng Thái</TableHead>
                <TableHead className="hidden sm:table-cell">Xu Hướng</TableHead>
                <TableHead className="hidden lg:table-cell text-center">Dự Báo 5'</TableHead>
                <TableHead className="hidden xl:table-cell text-center">V/C</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_CAMERAS.map(cam => {
                const los = LOS_MAP[cam.status]
                const isWarn = cam.status === "heavy" || cam.status === "congested"
                return (
                  <TableRow key={cam.id} className="hover:bg-accent/40 cursor-pointer text-sm">
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        {isWarn
                          ? <AlertTriangleIcon className="size-3.5 text-red-500 shrink-0" />
                          : <CheckCircle2Icon  className="size-3.5 text-green-500 shrink-0" />
                        }
                        <div>
                          <p className="font-medium text-xs">{cam.id}</p>
                          <p className="text-[11px] text-muted-foreground max-w-[180px] truncate">{cam.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{cam.total}</TableCell>
                    <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground tabular-nums">{cam.car}</TableCell>
                    <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground tabular-nums">{cam.moto}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", los.cls)}>
                        {los.short} – {los.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <TrendBadge trend={cam.trend} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center font-semibold tabular-nums text-xs">
                      <span className={cn(cam.forecast5m > cam.total ? "text-orange-600" : "text-green-600")}>
                        {cam.forecast5m}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center">
                      <span className={cn(
                        "text-xs font-semibold tabular-nums",
                        cam.vc >= 90 ? "text-red-600" : cam.vc >= 70 ? "text-orange-600" : "text-green-600"
                      )}>
                        {cam.vc}%
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── DOW data (7 ngày cuộn) ───────────────────────────────────────────────────
const DOW_DATA = [
  { label: "Thứ 5", avg: 421, max: 554 },
  { label: "Thứ 6", avg: 498, max: 641 },
  { label: "Thứ 7", avg: 312, max: 407 },
  { label: "CN",    avg: 278, max: 361 },
  { label: "Thứ 2", avg: 445, max: 582 },
  { label: "Thứ 3", avg: 463, max: 601 },
  { label: "Thứ 4", avg: 487, max: 623 },
]
