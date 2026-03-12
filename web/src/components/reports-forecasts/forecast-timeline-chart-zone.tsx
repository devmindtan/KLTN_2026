/**
 * ForecastTimelineChartZone – Chart thuần (không card) dự báo vs thực tế 24h
 * 3 series: predicted (area dashed) + actual (area solid) + vcPct (line phải)
 * ReferenceLine đánh dấu "Hiện tại", tô nhạt vùng tương lai
 */
import {
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { TimelinePoint } from "./reports-types"

const CHART_CONFIG: ChartConfig = {
  predicted: { label: "Dự báo",    color: "var(--primary)"   },
  actual:    { label: "Thực tế",   color: "var(--chart-2)"   },
  vcPct:     { label: "Mức tải V/C", color: "var(--chart-4)" },
} satisfies ChartConfig

interface ForecastTimelineChartZoneProps {
  /** Dữ liệu timeline (mảng TimelinePoint có vcPct) */
  data: TimelinePoint[]
  /**
   * Giờ hiện tại dùng làm ReferenceLine ("17:00").
   * Nếu undefined — không vẽ reference line.
   */
  nowHour?: string
  /** Chiều cao chart, mặc định 260px */
  height?: number
  /** Ẩn/hiện series mức tải V/C (đường phải), mặc định true */
  showVcPct?: boolean
  /** Class bổ sung cho ChartContainer */
  className?: string
}

/**
 * Chỉ phần chart (không bọc Card) — dùng nhúng vào bất kỳ CardContent nào.
 * Trục trái: số lượng phương tiện (predicted + actual).
 * Trục phải: mức tải V/C % (vcPct) — hiển thị khi showVcPct=true và có dữ liệu.
 */
export function ForecastTimelineChartZone({
  data,
  nowHour,
  height = 260,
  showVcPct = true,
  className,
}: ForecastTimelineChartZoneProps) {
  const hasVcPct = showVcPct && data.some((d) => d.vcPct != null)

  // Xác định điểm bắt đầu vùng tương lai để tô nền nhạt
  const futureStart = data.find((d) => d.isFuture)?.hour

  return (
    <>
      <ChartContainer
        config={CHART_CONFIG}
        className={cn("w-full", className)}
        style={{ height }}
      >
        <ComposedChart
          data={data}
          margin={{ top: 24, right: hasVcPct ? 8 : 4, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ftcz-predicted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-predicted)" stopOpacity={0.2}  />
              <stop offset="95%" stopColor="var(--color-predicted)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="ftcz-actual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-actual)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} strokeDasharray="3 3" />

          {/* ── Trục X ── */}
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickMargin={6}
            interval={1}
          />

          {/* ── Trục trái: số xe ── */}
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickMargin={4}
          />

          {/* ── Trục phải: V/C % ── */}
          {hasVcPct && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickMargin={4}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
          )}

          {/* ── Tô nhạt vùng tương lai ── */}
          {futureStart && (
            <ReferenceArea
              yAxisId="left"
              x1={futureStart}
              x2={data[data.length - 1].hour}
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          )}

          {/* ── ReferenceLine "Hiện tại" ── */}
          {nowHour && (
            <ReferenceLine
              yAxisId="left"
              x={nowHour}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{
                value: "Hiện tại",
                position: "top",
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
          )}

          {/* ── Ngưỡng V/C 100% ── */}
          {hasVcPct && (
            <ReferenceLine
              yAxisId="right"
              y={100}
              stroke="hsl(var(--destructive))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          )}

          {/* ── Tooltip ── */}
          <ChartTooltip
            cursor={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const point = data.find((d) => d.hour === label)
              const predicted = payload.find((p) => p.dataKey === "predicted")
              const actual    = payload.find((p) => p.dataKey === "actual")
              const vcRow     = payload.find((p) => p.dataKey === "vcPct")
              const isFuture  = point?.isFuture ?? false

              const errPct = predicted?.value != null && actual?.value != null
                ? Math.abs(
                    ((actual.value as number) - (predicted.value as number)) /
                    (predicted.value as number) * 100
                  ).toFixed(1)
                : null

              const vcVal = vcRow?.value as number | undefined
              const vcColor = vcVal == null ? undefined
                : vcVal >= 90 ? "#ef4444"
                : vcVal >= 70 ? "#f97316"
                : "#22c55e"

              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[160px]">
                  <p className="font-medium mb-1.5">{label}</p>

                  {/* Dự báo */}
                  {predicted && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ background: predicted.color }} />
                        <span className="text-muted-foreground">Dự báo</span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {(predicted.value as number).toLocaleString("vi-VN")} xe
                      </span>
                    </div>
                  )}

                  {/* Thực tế — ẩn nếu tương lai */}
                  {actual && !isFuture && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ background: actual.color }} />
                        <span className="text-muted-foreground">Thực tế</span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {actual.value != null
                          ? `${(actual.value as number).toLocaleString("vi-VN")} xe`
                          : "—"}
                      </span>
                    </div>
                  )}

                  {isFuture && (
                    <p className="text-xs text-muted-foreground mt-0.5">Chưa có dữ liệu thực tế</p>
                  )}

                  {/* V/C ratio */}
                  {vcVal != null && (
                    <div className="flex items-center justify-between gap-3 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ background: vcColor }} />
                        <span className="text-muted-foreground">Mức tải V/C</span>
                      </div>
                      <span className="font-semibold tabular-nums" style={{ color: vcColor }}>
                        {vcVal}%
                      </span>
                    </div>
                  )}

                  {/* Sai số */}
                  {errPct && !isFuture && (
                    <div className="mt-1.5 pt-1.5 border-t text-xs flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Sai số</span>
                      <span
                        className={cn(
                          "font-semibold",
                          parseFloat(errPct) <= 5  ? "text-green-600"  :
                          parseFloat(errPct) <= 15 ? "text-yellow-600" : "text-red-600"
                        )}
                      >
                        {errPct}%
                      </span>
                    </div>
                  )}
                </div>
              )
            }}
          />

          {/* ── Area: Thực tế (solid, trước để predicted đè lên) ── */}
          <Area
            yAxisId="left"
            dataKey="actual"
            type="monotone"
            stroke="var(--color-actual)"
            fill="url(#ftcz-actual)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />

          {/* ── Area: Dự báo (dashed) ── */}
          <Area
            yAxisId="left"
            dataKey="predicted"
            type="monotone"
            stroke="var(--color-predicted)"
            fill="url(#ftcz-predicted)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
          />

          {/* ── Line: Mức tải V/C (trục phải, màu chart-4) ── */}
          {hasVcPct && (
            <Line
              yAxisId="right"
              dataKey="vcPct"
              type="monotone"
              stroke="var(--color-vcPct)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </ComposedChart>
      </ChartContainer>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: "var(--primary)" }} />
          <span>Dự báo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 border-t-2" style={{ borderColor: "var(--chart-2)" }} />
          <span>Thực tế</span>
        </div>
        {hasVcPct && (
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 border-t-2" style={{ borderColor: "var(--chart-4)" }} />
            <span>Mức tải V/C (%)</span>
          </div>
        )}
      </div>
    </>
  )
}
