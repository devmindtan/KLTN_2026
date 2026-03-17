/**
 * ForecastRollingChart – Biểu đồ dự báo cuốn chiếu 5 mốc (Rolling Forecast Fan Chart)
 * 
 * DESIGN SANDBOX (Confirmed 15/03/26):
 * - Chart hiển thị: CHỈ forecast "chính thức" từ NOW (5 horizons: 5p, 10p, 15p, 30p, 60p)
 * - Rolling forecasts: KHÔNG hiển thị trên chart, CHỈ trong tooltip/table
 * - Label horizon CỐ ĐỊNH (không đổi theo thời gian): "5 phút", "10 phút", "60 phút"
 * - Tooltip: Hiển thị TẤT CẢ forecasts (chính thức + rolling) với badge "(rolling)"
 * - Table: Chi tiết TẤT CẢ forecasts, mỗi horizon có thể nhiều rows
 * - Quá khứ (≤NOW): Giữ nguyên tất cả forecasts để so sánh với actual
 * - Tương lai (>NOW): Chỉ forecast từ NOW, target slots cố định (NOW+slots)
 * 
 * Sử dụng dữ liệu thật từ API: GET /api/forecast/rolling
 */
import { useMemo, useState, useEffect } from "react"
import { useSocket } from "@/contexts/SocketContext"
import { getForecastRolling } from "@/services/forecast.service"
import type { ForecastRollingResponse } from "@/services/forecast.service"
import { getAllCameras } from "@/services/camera.service"
import type { CameraInfo } from "@/services/camera.service"
import { useLoading } from "@/contexts/LoadingContext"
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectWithSearch } from "@/components/custom/select-with-search"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { TIME_LABEL, FORECAST_TERMS, UI_LABELS } from "@/lib/app-constants"

// ─── Cấu hình horizon — label từ TIME_LABEL trong app-constants ────────────────
const HORIZONS = [
  { key: "f5m",  label: TIME_LABEL["5m"],  color: "#2563eb", slots: 1,  errorSigma: 1.0 },
  { key: "f10m", label: TIME_LABEL["10m"], color: "#9333ea", slots: 2,  errorSigma: 1.8 },
  { key: "f15m", label: TIME_LABEL["15m"], color: "#f59e42", slots: 3,  errorSigma: 2.6 },
  { key: "f30m", label: TIME_LABEL["30m"], color: "#e11d48", slots: 6,  errorSigma: 3.8 },
  { key: "f60m", label: TIME_LABEL["60m"], color: "#059669", slots: 12, errorSigma: 5.5 },
]
// slots = horizon / 5
// DB lưu forecast_for_time = time_bucket + 5min (kết thúc bucket = “NOW”) + horizon
// VD: bảo gọi lúc 09:01, input bucket = 08:55, “now” = 09:00
//     h=5m → target = 09:05 = CLIENT_NOW_INDEX + 1
//     h=10m → target = 09:10 = CLIENT_NOW_INDEX + 2

type HorizonKey = "f5m" | "f10m" | "f15m" | "f30m" | "f60m"

// Phủ ngày từ 07:00 – 23:55 (17h × 12 slots/h = 204 slots)
const START_HOUR  = 7    // Bắt đầu từ 07:00 (data thực tế)

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Chuyển slot index → nhãn giờ HH:MM, tính từ 07:00 (for UI rendering) */
function slotLabel(i: number): string {
  const m = START_HOUR * 60 + i * 5
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

// ─── Data per-camera ──────────────────────────────────────────────────────────
// ─── Data per-camera ──────────────────────────────────────────────────────────
type SlotRow = {
  t: string
  actual: number | null
  actualRef: number | null
  currentRatio: number | null  // V/C ratio % (0-100+), tính cho cả quá khứ và tương lai
  f5m: number | null
  f10m: number | null
  f15m: number | null
  f30m: number | null
  f60m: number | null
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
interface TooltipPayloadEntry { dataKey: string; value: number | null }
interface RollingTooltipProps { 
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  originalData: SlotRow[]  // Original data chứa full forecast values
  nowIndex: number          // Index của slot hiện tại
  chartDataRatioMap: Map<string, number | null>  // currentRatio đã tính đúng từ chartData
}

/** Hiển thị number với 1 chữ số thập phân */
const f1 = (v: number | null | undefined): string => v == null ? "—" : v.toFixed(1)

function RollingTooltip({ active, payload, label, originalData, nowIndex, chartDataRatioMap }: RollingTooltipProps) {
  if (!active || !payload?.length || !label) return null
  
  // Lookup original row để lấy FULL forecast data (chưa transform)
  const originalRow = originalData.find((d) => d.t === label)
  if (!originalRow) return null
  
  // Tìm index của slot được hover
  const hoveredIdx = originalData.findIndex((d) => d.t === label)
  
  const isNow    = hoveredIdx === nowIndex
  const isFuture = hoveredIdx > nowIndex
  const baseline = originalRow.actual ?? originalRow.actualRef ?? null

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[190px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">{label}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
          isNow    ? "text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950/40"
          : isFuture ? "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-700 dark:bg-orange-950/40"
          : "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/40"
        }`}>
          {isNow ? FORECAST_TERMS.CURRENT : isFuture ? FORECAST_TERMS.FUTURE : FORECAST_TERMS.PAST}
        </Badge>
      </div>
      {baseline != null && (
        <div className="flex justify-between text-xs mb-1.5 pb-1.5 border-b border-border">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-gray-900 dark:bg-gray-100" />
            {isFuture ? FORECAST_TERMS.CURRENT : FORECAST_TERMS.ACTUAL}
          </span>
          <span className="font-mono font-semibold">{f1(baseline)} xe</span>
        </div>
      )}
      {HORIZONS.map(({ key, label, color, slots }) => {
        // Đọc trực tiếp từ originalData[hoveredIdx][key]
        // API PIVOT lưu prediction TẠI target slot (forecast_for_time → HH:MM)
        const fVal = originalRow[key as HorizonKey]
        if (fVal == null) return null
        // "Official" = horizon slots khớp với khoảng cách từ NOW đến slot đang hover
        // VD: hoveredIdx = nowIndex+2, f15m (slots=2) → official; f30m (slots=5) → rolling
        const isOfficial = hoveredIdx === nowIndex + slots
        const diff = baseline != null ? fVal - baseline : null
        return (
          <div key={key} className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
              {!isOfficial && (
                <span className="text-[9px] text-muted-foreground">(rolling)</span>
              )}
            </span>
            <span className="font-mono">
              {f1(fVal)} xe
              {diff != null && (
                <span className={`ml-1 text-[10px] ${diff > 0 ? "text-red-500" : diff < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                  ({diff > 0 ? "+" : ""}{diff.toFixed(1)})
                </span>
              )}
            </span>
          </div>
        )
      })}
      {(() => {
        // Dùng chartDataRatioMap thay vì originalRow.currentRatio
        // → tránh hiện 0% cho future slots (vc_ratio = 0 trong API do fallback COALESCE)
        const ratioVal = chartDataRatioMap.get(label) ?? originalRow.currentRatio
        if (ratioVal == null) return null
        const levelLabel = ratioVal <= 30 ? "Thấp" : ratioVal <= 70 ? "Trung bình" : ratioVal <= 100 ? "Cao" : "Quá tải"
        return (
          <div className="flex justify-between text-xs mt-1.5 pt-1.5 border-t border-border">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full bg-violet-500" />
              Mức tải
            </span>
            <span className="font-mono text-violet-500">{f1(ratioVal)}% <span className="text-muted-foreground text-[10px]">({levelLabel})</span></span>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/** Rolling Forecast Fan Chart cho tab Dự báo trên Dashboard */
export function ForecastRollingChart() {
  const [apiData, setApiData] = useState<ForecastRollingResponse | null>(null)
  const [cameraList, setCameraList] = useState<CameraInfo[]>([])
  const [selectedCam, setSelectedCam] = useState("all")
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [zoomLevel, setZoomLevel] = useState(0)
  const { theme } = useTheme()
  const { startLoading, stopLoading } = useLoading()
  const { forecastVersion } = useSocket()

  // Fetch rolling forecast + camera list – re-fetch khi forecastVersion tăng (FORECAST_UPDATED socket)
  useEffect(() => {
    async function loadData() {
      startLoading()
      try {
        const [data, cameras] = await Promise.all([
          getForecastRolling("all"),
          getAllCameras(),
        ])
        setApiData(data)
        setCameraList(cameras)
        // Dùng nowTime từ API (= created_at mới nhất trong DB) thay vì client clock
        const [apiH, apiM] = data.metadata.nowTime.split(":").map(Number)
        const apiMin = apiH * 60 + apiM
        const gridIdx = Math.max(0, Math.floor((apiMin - START_HOUR * 60) / 5))
        setSelectedIdx(Math.min(gridIdx, 203))
      } catch (err) {
        console.error("[ForecastRollingChart] Failed to load data:", err)
      } finally {
        stopLoading()
      }
    }
    loadData()
  }, [startLoading, stopLoading, forecastVersion])

  // Build camera options từ keys của apiData.cameras (cho SelectWithSearch)
  const cameraOptions = useMemo(() => {
    if (!apiData) return []
    const camIds = Object.keys(apiData.cameras).filter((k) => k !== "all")
    return camIds.map((id) => {
      const info = cameraList.find((c) => c.cam_id === id)
      return { value: id, label: info?.display_name ?? id, searchValue: id }
    })
  }, [apiData, cameraList])

  // camData: slots từ API (chỉ có data đến hiện tại), fullGrid được generate tự trong render
  const { camData } = useMemo(() => {
    if (!apiData) {
      return { camData: [] }
    }

    const camera = apiData.cameras[selectedCam]
    if (!camera || !camera.slots || camera.slots.length === 0) {
      // Fallback: dùng "all" network data
      const allCamera = apiData.cameras["all"]
      const data = allCamera?.slots ?? []
      return { camData: data }
    }

    const data = camera.slots
    // Tính nowIndex bằng cách tìm slot theo nowTime string (chính xác hơn dùng metadata index)
    return { camData: data }
  }, [apiData, selectedCam])

  // Loading state
  if (!apiData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">{UI_LABELS.LOADING_FORECAST}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  /** Chuyển camera và reset vị trí chọn về Hiện tại (dùng nowTime từ API) */
  const handleCamChange = (cam: string) => {
    setSelectedCam(cam)
    const [h, m] = apiData.metadata.nowTime.split(":").map(Number)
    const nowMin = h * 60 + m
    setSelectedIdx(Math.min(Math.max(0, Math.floor((nowMin - START_HOUR * 60) / 5)), 203))
  }

  // ─── Tính giờ hiện tại từ API (created_at mới nhất trong DB) ───────────────
  // Không dùng client clock vì có thể đi trước dữ liệu thực tế đã về DB
  const clientNowTime   = apiData.metadata.nowTime  // "HH:MM"
  const [cnH, cnM]      = clientNowTime.split(":").map(Number)
  const clientNowMinute = cnH * 60 + cnM

  // Kiểm tra thời gian dự báo: chỉ hoạt động từ 7:00–24:00
  const nowHour = Math.floor(clientNowMinute / 60)
  const isOutsideForecastTime = clientNowMinute >= 24 * 60 || nowHour < 7

  // Nếu ngoài giờ dự báo, hiển thị thông báo
  if (isOutsideForecastTime) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">⏰ {clientNowMinute >= 24 * 60 ? "Hết thời gian dự báo trong ngày" : "Chưa đến thời gian dự báo"}</p>
            <p className="text-xs text-muted-foreground">Dự báo hoạt động từ 07:00 đến 24:00 hàng ngày</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Build full grid 204 slots (07:00–23:55), merge camData vào ──────────
  // Đảm bảo tương lai luôn có slot placeholder dù API chưa có data
  const apiDataMap = new Map(camData.map((row) => [row.t, row]))
  const fullGrid: SlotRow[] = Array.from({ length: 204 }, (_, i) => {
    const label = slotLabel(i)
    return apiDataMap.get(label) ?? {
      t: label,
      actual: null,
      actualRef: null,
      currentRatio: null,
      f5m: null,
      f10m: null,
      f15m: null,
      f30m: null,
      f60m: null,
    }
  })

  // CLIENT_NOW_INDEX: vị trí slot hiện tại theo giờ thực của máy client
  const CLIENT_NOW_INDEX = Math.max(0, fullGrid.findIndex((s) => s.t === clientNowTime))

  // actualAtNow: tìm lùi slot cuối cùng có actual; fallback f5m nếu sync chưa cập nhật
  const actualAtNow = (() => {
    for (let i = CLIENT_NOW_INDEX; i >= 0; i--) {
      const val = fullGrid[i]?.actual ?? fullGrid[i]?.f5m
      if (val != null) return val
    }
    return null
  })()

  // Set actualRef trên tất cả future placeholder slots (để đường baseline hiện trong chart)
  // Backend đã set actualRef cho slots > API nowIndex, nhưng slots placeholder (frontend-only) chưa có
  if (actualAtNow != null) {
    for (let i = CLIENT_NOW_INDEX + 1; i < fullGrid.length; i++) {
      if (fullGrid[i].actualRef == null) {
        fullGrid[i] = { ...fullGrid[i], actualRef: actualAtNow }
      }
    }
  }

  // Cửa sổ hiển thị: 07:00 đến NOW (hoặc NOW+1h nếu trước 23:00)
  const defaultStartMin = START_HOUR * 60  // 07:00 cố định
  const windowEndMin = clientNowMinute >= 23 * 60
    ? clientNowMinute  // Từ 23:00 trở đi: chỉ đến NOW
    : Math.min(clientNowMinute + 60, 24 * 60 - 5)  // Trước 23:00: NOW + 1h dự báo
  
  // Zoom logic: cắt 10% duration từ bên trái mỗi zoom level
  const fullDuration = windowEndMin - defaultStartMin
  const zoomReduction = Math.floor(fullDuration * 0.1 * zoomLevel)
  const minStartMin = Math.max(clientNowMinute - 60, defaultStartMin)  // Tối thiểu: 1h quá khứ
  const windowStartMin = Math.min(
    defaultStartMin + zoomReduction,
    minStartMin
  )
  
  // Max zoom level: khi windowStartMin đạt minStartMin
  const maxZoomLevel = Math.floor((minStartMin - defaultStartMin) / (fullDuration * 0.1))
  const canZoomIn = zoomLevel < maxZoomLevel
  const canZoomOut = zoomLevel > 0

  const visibleData = fullGrid.filter((row) => {
    const [h, m] = row.t.split(":").map(Number)
    const rowMin = h * 60 + m
    return rowMin >= windowStartMin && rowMin <= windowEndMin
  })

  // Transform data: CHỈ hiển thị forecast "chính thức" trên chart
  // Quá khứ (≤NOW): giữ nguyên tất cả forecasts để so sánh
  // Tương lai (>NOW): chỉ hiển thị forecast TỪ NOW (không hiển thị rolling)

  // nowSlot: snapshot forecast tại slot cuối cùng có data thực (backward từ NOW)
  // KHÔNG dùng fullGrid[CLIENT_NOW_INDEX] trực tiếp vì client clock có thể vượt qua
  // slot cuối API (e.g. data fetch lúc 18:52, render lúc 18:57 → "18:55" là placeholder)
  // → nowSlot.f60m = null → mất dot dù DB có data
  const nowSlot = (() => {
    for (let i = CLIENT_NOW_INDEX; i >= 0; i--) {
      if (fullGrid[i].f5m != null) return fullGrid[i]
    }
    return fullGrid[CLIENT_NOW_INDEX]
  })()

  // Capacity camera hiện tại để tính mức tải tương lai
  const camCapacity = apiData.capacities?.[selectedCam] ?? 100
  const ratioFromForecast = (v: number | null): number | null => {
    if (v == null || camCapacity <= 0) return null
    return Math.round(Math.min(100, v / camCapacity * 100) * 10) / 10
  }
  // Fallback ratio: dùng khi slot tương lai không có bất kỳ forecast nào (flat line)
  const fallbackRatio = ratioFromForecast(actualAtNow)

  // Set official future target indices (5 mốc dự báo từ NOW)
  const officialTargetSet = new Set(HORIZONS.map(({ slots }) => CLIENT_NOW_INDEX + slots))

  const chartData = visibleData.map((row) => {
    const originalIdx = fullGrid.findIndex((d) => d.t === row.t)
    const transformed = { ...row }

    // ── Xử lý horizon lines ──────────────────────────────────────────────────
    // >= CLIENT_NOW_INDEX: bao gồm cả slot NOW (f5m slots=0 target = CLIENT_NOW_INDEX)
    if (originalIdx >= CLIENT_NOW_INDEX) {
      // NOW + tương lai: chỉ giữ forecast tại 5 mốc chính thức
      // KHÔNG fallback nowSlot → dot chỉ hiện khi slot đó thực sự có data trong MV
      HORIZONS.forEach(({ key, slots }) => {
        if (originalIdx === CLIENT_NOW_INDEX + slots) {
          // Giữ nguyên transformed[key] (= fullGrid[slot][key] từ API)
          // Nếu null → MV chưa có prediction này → không hiển dot
          // (không fallback nowSlot thiếu chính xác vị trí)
        } else {
          transformed[key as HorizonKey] = null
        }
      })
    }

    // ── Mức tải (currentRatio) – áp dụng mọi slot ────────────────────────────
    // Ưu tiên: actual → (nếu official future slot) forecast chính thức → rolling nhỏ nhất → fallback
    if (transformed.actual != null) {
      // Có thực tế: tính từ actual / capacity
      transformed.currentRatio = ratioFromForecast(transformed.actual) ?? transformed.currentRatio
    } else if (originalIdx > CLIENT_NOW_INDEX && officialTargetSet.has(originalIdx)) {
      // 5 mốc tương lai chính thức: tính từ forecast chính thức
      const officialVal = HORIZONS.find(({ slots }) => originalIdx === CLIENT_NOW_INDEX + slots)
      const val = officialVal
        ? (transformed[officialVal.key as HorizonKey] ?? nowSlot?.[officialVal.key as HorizonKey] ?? null)
        : null
      transformed.currentRatio = ratioFromForecast(val) ?? fallbackRatio
    } else {
      // Không có actual + không phải official slot:
      // → dùng rolling nhỏ nhất (f5m ưu tiên vì chính xác nhất)
      const bestRolling = row.f5m ?? row.f10m ?? row.f15m ?? row.f30m ?? row.f60m
      transformed.currentRatio = ratioFromForecast(bestRolling) ?? fallbackRatio
    }

    return transformed
  })

  // Dynamic X-axis interval: adjust based on visible data length
  // Shorter window → more labels; longer window → fewer labels
  const len = visibleData.length
  const xAxisInterval = len <= 24 ? 5    // ≤2h: mỗi 30 phút (6 slots)
                      : len <= 72 ? 11   // ≤6h: mỗi 1 giờ (12 slots)
                      : 23                // >6h: mỗi 2 giờ (24 slots)

  // Map t → currentRatio từ chartData (đã tính đúng cho cả slot tương lai)
  // Dùng trong tooltip thay vì đọc từ fullGrid (vc_ratio = 0 cho future slots)
  const chartDataRatioMap = new Map(chartData.map((d) => [d.t, d.currentRatio]))

  // Custom tooltip renderer with original data access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = (props: any) => (
    <RollingTooltip {...props} originalData={fullGrid} nowIndex={CLIENT_NOW_INDEX} chartDataRatioMap={chartDataRatioMap} />
  )

  const handleChartClick = (data: { activeLabel?: string }) => {
    if (!data?.activeLabel) return
    const idx = fullGrid.findIndex((d) => d.t === data.activeLabel)
    if (idx >= 0) setSelectedIdx(idx)
  }

  const selRow        = fullGrid[selectedIdx] ?? fullGrid[CLIENT_NOW_INDEX]
  const isNowOrFuture = selectedIdx >= CLIENT_NOW_INDEX
  const tableBaseline = isNowOrFuture ? actualAtNow : (selRow?.actual ?? actualAtNow)

  type TableRow = { key: string; label: string; color: string; forecasts: Array<{ value: number; delta: number | null; isRolling: boolean }>; targetSlot: string; actual: number | null }
  // Table: cung cấp fallback nowSlot cho trường hợp MV chưa có data (chu kỳ mới nhất)
  // (nowSlot chỉ dùng trong table, không dùng trong chart transform → tránh hiển dot sai)
  const tableRows: TableRow[] = HORIZONS.map(({ key, label, color, slots }) => {
    // Tính target slot từ selected slot (quá khứ) hoặc từ NOW (tương lai)
    const baseSlot = isNowOrFuture ? CLIENT_NOW_INDEX : selectedIdx
    const targetIdx = baseSlot + slots
    
    // Check bounds
    const targetRow = targetIdx < fullGrid.length ? fullGrid[targetIdx] : null
    
    // Lấy giá trị dự báo:
    // API PIVOT lưu prediction TẠI target slot → đọc trực tiếp từ fullGrid[targetIdx][key]
    // VD: f15m (slots=2) → targetIdx = CLIENT_NOW+2 = slot "19:45" HCM
    //     fullGrid["19:45"].f15m = prediction h=15 targeting 12:45 UTC ✓ (khớp FIWARE)
    const forecasts: Array<{ value: number; delta: number | null; isRolling: boolean }> = []
    const fVal = targetRow?.[key as HorizonKey] ?? (isNowOrFuture ? nowSlot?.[key as HorizonKey] : null) ?? null
    if (fVal != null) {
      const delta = tableBaseline != null ? fVal - tableBaseline : null
      forecasts.push({ value: fVal, delta, isRolling: false })
    }
    
    const targetSlot = targetRow ? targetRow.t : "—"
    const actual = targetRow?.actual ?? null
    
    return { key, label, color, forecasts, targetSlot, actual }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{FORECAST_TERMS.ROLLING} – 5 mốc thời gian</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700">Quá khứ</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-700">Tương lai</Badge>
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
              Hiển thị từ 07:00 đến hiện tại (dự báo 60p tương lai đến 23:00). Quá khứ: 5 horizon bám thực tế. Tương lai: <b>tối đa 60 phút</b>.
              <span className="text-primary ml-1">Nhấn vào biểu đồ</span> để xem chi tiết.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Camera selector */}
            <SelectWithSearch
              value={selectedCam}
              onChange={handleCamChange}
              options={cameraOptions}
              defaultOption={{ value: "all", label: "Toàn mạng lưới" }}
              placeholder="Toàn mạng lưới"
              searchPlaceholder="Tìm camera, mã ID..."
              emptyText="Không tìm thấy camera nào"
              size="sm"
              triggerClassName="w-32 sm:w-40"
              ariaLabel="Chọn camera"
            />
            
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border border-border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setZoomLevel((z) => Math.min(z + 1, maxZoomLevel))}
                disabled={!canZoomIn}
                title="Phóng to (Zoom In)"
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setZoomLevel((z) => Math.max(z - 1, 0))}
                disabled={!canZoomOut}
                title="Thu nhỏ (Zoom Out)"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setZoomLevel(0)}
                disabled={zoomLevel === 0}
                title="Đặt lại (Reset)"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </div>
            
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Chart */}
        <div className="w-full h-[300px] relative">
          {/* Label trục phải – HTML tuyệt đối để không đẩy vào chart */}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 10, left: -8, bottom: 4 }}
              onClick={handleChartClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                {HORIZONS.map(({ key, color }) => (
                  <linearGradient key={key} id={`frc-fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

              <ReferenceArea
                x1={slotLabel(CLIENT_NOW_INDEX)}
                x2={slotLabel(203)}
                fill="hsl(var(--muted))"
                fillOpacity={0.2}
              />

              <XAxis dataKey="t" fontSize={11} tick={{ fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={xAxisInterval} />
              <YAxis fontSize={11} tick={{ fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false}
                label={{ value: "Số xe", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis yAxisId="currentRatio" orientation="right" domain={[0, 100]} fontSize={10}
                tick={{ fill: "#8b5cf6" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={36}
              />

              <Tooltip content={renderTooltip} />

              {/* Forecast areas */}
              {[...HORIZONS].reverse().map(({ key, color }) => (
                <Area
                  key={`area-${key}`}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={1.8}
                  fill={`url(#frc-fill-${key})`}
                  connectNulls={false}
                  dot={(props: { cx?: number; cy?: number; payload?: SlotRow }) => {
                    const v = props.payload?.[key as HorizonKey]
                    const t = props.payload?.t
                    // Chỉ hiển thị dot ở tương lai (> NOW), KHÔNG hiển thị delta label
                    if (v != null && t != null && t > slotLabel(CLIENT_NOW_INDEX)) {
                      const cx = props.cx ?? 0
                      const cy = props.cy ?? 0
                      return (
                        <circle
                          key={`fg-${key}-${t}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={color}
                          stroke="var(--background)"
                          strokeWidth={2}
                        />
                      )
                    }
                    return <g key={`empty-${key}-${t ?? "none"}`} />
                  }}
                  legendType="plainline"
                />
              ))}

              {/* Baseline dotted – kéo dài từ NOW ra tương lai làm cơ sở so sánh */}
              <Line
                type="monotone"
                dataKey="actualRef"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
                legendType="plainline"
                name="Hiện tại"
              />

              {/* Current Ratio % line – trục phải (xuyên suốt quá khứ + tương lai) */}
              <Line
                type="monotone"
                dataKey="currentRatio"
                yAxisId="currentRatio"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                connectNulls={true}
                legendType="plainline"
                name="Mức tải %"
              />

              {/* Actual line – render sau cùng để nằm trên đỉnh; màu đen (light) / trắng (dark) */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={theme === "dark" ? "#ffffff" : "#1a1a1a"}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                legendType="plainline"
                name="Thực tế"
              />

              {/* Ranh giới Hiện tại */}
              <ReferenceLine
                x={slotLabel(CLIENT_NOW_INDEX)}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={(props) => {
                  const vb = (props as { viewBox?: { x?: number; y?: number } }).viewBox ?? {}
                  const lineX = vb.x ?? 0
                  const y = (vb.y ?? 0) + 4
                  const labelW = 52
                  return (
                    <g>
                      <rect x={lineX - labelW / 2} y={y} width={labelW} height={17} rx={3}
                        fill="var(--background)" stroke="#6366f1" strokeWidth={0.8} opacity={0.95} />
                      <text x={lineX} y={y + 12} textAnchor="middle" fontSize={11} fill="#6366f1" fontWeight={600}>Hiện tại</text>
                    </g>
                  )
                }}
              />

              <Legend
                verticalAlign="bottom"
                height={40}
                wrapperStyle={{ paddingTop: 8 }}
                iconType="plainline"
                formatter={(v) => {
                  // Recharts formatter nhận name prop, không phải dataKey
                  if (v === "Thực tế")  return <span className="text-[11px]">Thực tế</span>
                  if (v === "Hiện tại") return <span className="text-[11px] text-slate-400">Hiện tại</span>
                  if (v === "Mức tải %") return <span className="text-[11px] text-violet-500">Mức tải %</span>
                  // Horizon areas dùng dataKey làm name (không có name prop)
                  const h = HORIZONS.find((h) => h.key === v)
                  return h ? <span className="text-[11px]">{h.label}</span> : <span className="text-[11px]">{v}</span>
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Detail Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-y-1 px-3 py-2 bg-muted/40 border-b border-border">
            <span className="text-xs font-semibold">
              {isNowOrFuture ? (
                <><span className="hidden sm:inline">Chi tiết dự báo – </span>Từ thời điểm hiện tại</>
              ) : (
                <><span className="hidden sm:inline">Chi tiết dự báo – </span>Slot {selRow.t}</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Baseline: <b className="font-mono">{f1(tableBaseline)} xe</b>
                {isNowOrFuture && <span className="hidden sm:inline text-orange-600 ml-1">(Hiện tại)</span>}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted"
                onClick={() => setSelectedIdx(CLIENT_NOW_INDEX)}
              >
                {selectedIdx === CLIENT_NOW_INDEX ? "📍 Hiện tại" : `⏱ ${selRow.t}`}
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Horizon</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Slot dự báo</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Dự báo (xe)</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Thực tế (xe)</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Δ vs Cơ sở</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ key, label, color, forecasts, targetSlot, actual }) => {
                if (forecasts.length === 0) {
                  // Không có forecast cho horizon này
                  return (
                    <tr key={key} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium">{label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{targetSlot}</td>
                      <td className="px-3 py-2 text-right font-mono">—</td>
                      <td className="px-3 py-2 text-right font-mono">{actual ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">—</td>
                    </tr>
                  )
                }
                
                // Hiển thị TẤT CẢ forecasts (chính thức + rolling)
                return forecasts.map((fc, idx) => (
                  <tr key={`${key}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium">{label}</span>
                        {fc.isRolling && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">rolling</Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{targetSlot}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{f1(fc.value)}</td>
                    <td className="px-3 py-2 text-right font-mono">{idx === 0 ? f1(actual) : ""}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={fc.delta == null ? "text-muted-foreground" : fc.delta > 0 ? "text-red-500" : fc.delta < 0 ? "text-blue-500" : "text-muted-foreground"}>
                        {fc.delta == null ? "—" : fc.delta > 0 ? `+${fc.delta.toFixed(1)}` : fc.delta.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
