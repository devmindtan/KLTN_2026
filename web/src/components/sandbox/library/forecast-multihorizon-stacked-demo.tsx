/**
 * ForecastMultiHorizonStackedDemo – Rolling Forecast Fan Chart (v3)
 *
 * Tính chất hiển thị:
 * - Trục X = 5 phút/slot; quá khứ ~90 phút + tương lai đúng 60 phút
 * - Quá khứ: 5 horizon bám actual, ngắn = ít sai nhất
 * - Hiện tại: ReferenceLine "Hiện tại", tất cả arm bắt đầu từ actualAtNow
 * - Tương lai: mỗi horizon 1 điểm dự báo tại đúng slot của nó (fan chart)
 * - Đường actualRef (dotted xám): kéo dài từ NOW ra tương lai làm baseline so sánh
 * - Drop lines + delta label tại mỗi điểm dự báo tương lai
 * - Detail table: mặc định NOW, click vào slot bất kỳ để xem chi tiết
 */
import { useState } from "react"
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

// ─── Cấu hình horizon ────────────────────────────────────────────────────────
const HORIZONS = [
  { key: "f5m",  label: "5 phút",  color: "#2563eb", slots: 1,  errorSigma: 1.0 },
  { key: "f10m", label: "10 phút", color: "#9333ea", slots: 2,  errorSigma: 1.8 },
  { key: "f15m", label: "15 phút", color: "#f59e42", slots: 3,  errorSigma: 2.6 },
  { key: "f30m", label: "30 phút", color: "#e11d48", slots: 6,  errorSigma: 3.8 },
  { key: "f60m", label: "60 phút", color: "#059669", slots: 12, errorSigma: 5.5 },
] as const

type HorizonKey = "f5m" | "f10m" | "f15m" | "f30m" | "f60m"

// Quá khứ 90 phút = 18 slots; hiện tại = slot 18; tương lai tối đa 60 phút = 12 slots
const PAST_SLOTS  = 18
const NOW_INDEX   = PAST_SLOTS
const TOTAL_SLOTS = PAST_SLOTS + 12

// ─── Helpers ─────────────────────────────────────────────────────────────────
function seededNoise(i: number, seed: number): number {
  return ((Math.sin(i * 127.1 + seed * 311.7) * 43758.5453) % 1) * 2 - 1
}

const START_MINUTE = 15 * 60 + 30 // 15:30 = slot 0

function slotLabel(i: number): string {
  const m = START_MINUTE + i * 5
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function baseTraffic(i: number): number {
  return Math.round(48 + Math.sin((i + 2) / 5) * 12 + Math.sin((i + 2) / 2.3) * 3)
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const actualAtNow = baseTraffic(NOW_INDEX) + Math.round(seededNoise(NOW_INDEX, 0) * 1.2)

type SlotRow = {
  t: string
  actual: number | null
  actualRef: number | null
  f5m: number | null
  f10m: number | null
  f15m: number | null
  f30m: number | null
  f60m: number | null
}

const mockData: SlotRow[] = Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
  const isFuture = i > NOW_INDEX
  const base = baseTraffic(i)

  const row: SlotRow = {
    t:         slotLabel(i),
    // actualRef: flat dotted line từ NOW ra tương lai (baseline so sánh)
    actual:    isFuture ? null : (i === NOW_INDEX ? actualAtNow : base + Math.round(seededNoise(i, 0) * 1.2)),
    actualRef: i >= NOW_INDEX ? actualAtNow : null,
    f5m: null, f10m: null, f15m: null, f30m: null, f60m: null,
  }

  if (i === NOW_INDEX) {
    // Tại ranh giới "Hiện tại": arm connector = actualAtNow
    HORIZONS.forEach(({ key }) => { (row as Record<string, string | number | null>)[key] = actualAtNow })
  } else if (!isFuture) {
    HORIZONS.forEach(({ key, errorSigma }, hIdx) => {
      (row as Record<string, string | number | null>)[key] = Math.round(base + seededNoise(i, hIdx + 1) * errorSigma)
    })
  } else {
    // Tương lai: mỗi horizon chỉ có đúng 1 điểm tại đúng slot của nó
    HORIZONS.forEach(({ key, slots, errorSigma }, hIdx) => {
      if (i === NOW_INDEX + slots) {
        const drift = seededNoise(i, hIdx + 10) * errorSigma * 1.8
        ;(row as Record<string, string | number | null>)[key] = Math.round(actualAtNow + drift)
      }
    })
  }

  return row
})

// Precompute giá trị dự báo tại từng future slot (dùng cho drop lines + table)
const FUTURE_FORECASTS = HORIZONS.map(({ key, label, color, slots }) => ({
  key, label, color, slots,
  value: mockData[NOW_INDEX + slots][key as HorizonKey] as number,
  delta: (mockData[NOW_INDEX + slots][key as HorizonKey] as number) - actualAtNow,
}))

// ─── Tooltip ─────────────────────────────────────────────────────────────────
interface TooltipPayloadEntry { dataKey: string; value: number | null }
interface RollingTooltipProps { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }

function RollingTooltip({ active, payload, label }: RollingTooltipProps) {
  if (!active || !payload?.length) return null
  const isNow     = label === slotLabel(NOW_INDEX)
  const isFuture  = label != null && label > slotLabel(NOW_INDEX)
  const actualEntry = payload.find((p) => p.dataKey === "actual")
  const refEntry    = payload.find((p) => p.dataKey === "actualRef")
  const baseline    = actualEntry?.value ?? refEntry?.value ?? null

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[190px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">{label}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
          isNow    ? "text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950/40"
          : isFuture ? "text-orange-700 border-orange-200 bg-orange-50"
          : "text-emerald-700 border-emerald-200 bg-emerald-50"
        }`}>
          {isNow ? "Hiện tại" : isFuture ? "Tương lai" : "Quá khứ"}
        </Badge>
      </div>
      {baseline != null && (
        <div className="flex justify-between text-xs mb-1.5 pb-1.5 border-b border-border">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-gray-900 dark:bg-gray-100" />
            {isFuture ? "Thực tế (tại NOW)" : "Thực tế"}
          </span>
          <span className="font-mono font-semibold">{baseline} xe</span>
        </div>
      )}
      {HORIZONS.map(({ key, label: hlabel, color }) => {
        const entry = payload.find((p) => p.dataKey === key)
        if (!entry || entry.value == null) return null
        const diff = baseline != null ? entry.value - baseline : null
        return (
          <div key={key} className="flex justify-between text-xs mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              {hlabel}
            </span>
            <span className="font-mono">
              {entry.value} xe
              {diff != null && (
                <span className={`ml-1 text-[10px] ${diff > 0 ? "text-red-500" : diff < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                  ({diff > 0 ? "+" : ""}{diff})
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ForecastMultiHorizonStackedDemo() {
  // selectedIdx: slot đang được chọn; mặc định = NOW (hiển thị 5 dự báo future)
  const [selectedIdx, setSelectedIdx] = useState<number>(NOW_INDEX)

  const handleChartClick = (data: { activeLabel?: string }) => {
    if (!data?.activeLabel) return
    const idx = mockData.findIndex((d) => d.t === data.activeLabel)
    if (idx >= 0) setSelectedIdx(idx)
  }

  const selRow          = mockData[selectedIdx]
  const isNowOrFuture   = selectedIdx >= NOW_INDEX
  const tableBaseline   = isNowOrFuture ? actualAtNow : (selRow.actual ?? actualAtNow)

  type TableRow = { key: string; label: string; color: string; value: number | null; delta: number | null; targetSlot: string }
  const tableRows: TableRow[] = HORIZONS.map(({ key, label, color, slots }) => {
    const value: number | null = isNowOrFuture
      ? (mockData[NOW_INDEX + slots][key as HorizonKey] as number)
      : (selRow[key as HorizonKey] as number | null)
    const targetSlot = isNowOrFuture ? slotLabel(NOW_INDEX + slots) : selRow.t
    const delta = value != null ? value - tableBaseline : null
    return { key, label, color, value, delta, targetSlot }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Rolling Forecast – Dự báo cuốn chiếu 5 mốc</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quá khứ (~90 phút): 5 horizon bám actual. Tương lai: <b>max 60 phút</b>, mỗi horizon 1 điểm, xòe quạt từ "Hiện tại".
              Đường chấm xám = baseline để đọc delta. <span className="text-primary">Click vào chart</span> để xem chi tiết bảng.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">Quá khứ</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30">Tương lai</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* ─── Chart ─── */}
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={mockData}
              margin={{ top: 8, right: 20, left: -8, bottom: 4 }}
              onClick={handleChartClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                {HORIZONS.map(({ key, color }) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

              {/* Vùng tương lai */}
              <ReferenceArea
                x1={slotLabel(NOW_INDEX)}
                x2={slotLabel(TOTAL_SLOTS)}
                fill="hsl(var(--muted))"
                fillOpacity={0.45}
              />

              {/* Highlight slot được chọn */}
              <ReferenceArea
                x1={slotLabel(selectedIdx)}
                x2={slotLabel(selectedIdx)}
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
              />

              <XAxis dataKey="t" fontSize={11} tick={{ fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={5} />
              <YAxis fontSize={11} tick={{ fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false}
                label={{ value: "Số xe", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "var(--muted-foreground)" }}
              />

              <Tooltip content={<RollingTooltip />} />

              {/* ─── Drop lines từ điểm dự báo xuống actualRef baseline ─── */}
              {FUTURE_FORECASTS.map(({ key, color, slots, value }) => (
                <ReferenceLine
                  key={`drop-${key}`}
                  segment={[
                    { x: slotLabel(NOW_INDEX + slots), y: value },
                    { x: slotLabel(NOW_INDEX + slots), y: actualAtNow },
                  ]}
                  stroke={color}
                  strokeDasharray="3 2"
                  strokeWidth={1.2}
                  strokeOpacity={0.75}
                />
              ))}

              {/* ─── Forecast areas (horizon dài vẽ trước → ở dưới) ─── */}
              {[...HORIZONS].reverse().map(({ key, color }) => (
                <Area
                  key={`area-${key}`}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={1.8}
                  fill={`url(#fill-${key})`}
                  connectNulls={false}
                  dot={(props: { cx?: number; cy?: number; payload?: SlotRow }) => {
                    const v = props.payload?.[key as HorizonKey]
                    const t = props.payload?.t
                    if (v != null && t != null && t > slotLabel(NOW_INDEX + 1)) {
                      const delta = v - actualAtNow
                      const cx = props.cx ?? 0
                      const cy = props.cy ?? 0
                      const labelY = delta >= 0 ? cy - 14 : cy + 20
                      return (
                        <g key={`fg-${key}-${t}`}>
                          <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--background)" strokeWidth={2} />
                          <text x={cx} y={labelY} textAnchor="middle" fontSize={10} fill={color} fontWeight={700}>
                            {delta >= 0 ? `+${delta}` : delta}
                          </text>
                        </g>
                      )
                    }
                    return <g key={`empty-${key}-${t ?? key}`} />
                  }}
                  legendType="none"
                />
              ))}

              {/* ─── Actual line ─── */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--foreground))"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                legendType="plainline"
                name="Thực tế"
              />

              {/* ─── Actual reference: dotted flat line vào tương lai (render sau areas → nằm trên) ─── */}
              <Line
                type="monotone"
                dataKey="actualRef"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
                legendType="none"
              />

              {/* ─── Ranh giới "Hiện tại" ─── */}
              <ReferenceLine
                x={slotLabel(NOW_INDEX)}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{ value: "Hiện tại", position: "insideTopRight", fontSize: 11, fill: "#6366f1", fontWeight: 600 }}
              />

              <Legend
                verticalAlign="bottom"
                height={32}
                iconType="plainline"
                formatter={(v) => {
                  if (v === "actual") return <span className="text-[11px]">Thực tế</span>
                  const h = HORIZONS.find((h) => h.key === v)
                  return h ? <span className="text-[11px]">{h.label}</span> : v
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ─── Detail Table ─── */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
            <span className="text-xs font-semibold">
              {isNowOrFuture ? "Chi tiết dự báo – Từ thời điểm Hiện tại" : `Chi tiết dự báo – Slot ${selRow.t}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Baseline: <b className="font-mono">{tableBaseline} xe</b>
                {isNowOrFuture && <span className="text-orange-600 ml-1">(NOW)</span>}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted"
                onClick={() => setSelectedIdx(NOW_INDEX)}
              >
                {selectedIdx === NOW_INDEX ? "📍 Hiện tại" : `⏱ ${selRow.t}`}
              </Badge>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Horizon</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Slot dự báo</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Dự báo (xe)</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Δ vs Baseline</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Sai lệch %</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ key, label, color, value, delta, targetSlot }) => {
                const pct = delta != null && tableBaseline !== 0
                  ? ((delta / tableBaseline) * 100).toFixed(1)
                  : null
                return (
                  <tr key={key} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium">{label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{targetSlot}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{value ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {delta != null
                        ? <span className={delta > 0 ? "text-red-500" : delta < 0 ? "text-blue-500" : "text-muted-foreground"}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {pct != null
                        ? <span className={parseFloat(pct) > 0 ? "text-red-500" : parseFloat(pct) < 0 ? "text-blue-500" : "text-muted-foreground"}>
                            {parseFloat(pct) > 0 ? `+${pct}%` : `${pct}%`}
                          </span>
                        : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Chú giải ─── */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="flex gap-1.5">
            <span className="shrink-0">🎯</span>
            <span><b>Horizon ngắn (5m):</b> sai số nhỏ, arm gần actual nhất, tự tin cao.</span>
          </div>
          <div className="flex gap-1.5">
            <span className="shrink-0">📐</span>
            <span><b>Drop lines + Δ:</b> đường chấm dọc nối điểm dự báo xuống baseline, số trên = chênh lệch.</span>
          </div>
          <div className="flex gap-1.5">
            <span className="shrink-0">🖱️</span>
            <span><b>Click chart:</b> chọn slot bất kỳ để xem chi tiết trong bảng. Badge → reset về NOW.</span>
          </div>
          <div className="flex gap-1.5">
            <span className="shrink-0">📊</span>
            <span><b>Đường chấm xám:</b> actual kéo dài vào future làm baseline đọc delta trực quan.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

