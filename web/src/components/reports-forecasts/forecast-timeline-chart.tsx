/**
 * ForecastTimelineChart – Zone 2: AreaChart dự báo vs thực tế 24h
 * Series "predicted" (strokeDasharray) + "actual" (solid)
 * ReferenceLine đánh dấu "Hiện tại", tô vùng tương lai
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { IconChartAreaLine } from "@tabler/icons-react";
import { useState } from "react";
import type { TimelinePoint } from "./reports-types";
import { MOCK_TIMELINE } from "./reports-types";

const CHART_CONFIG: ChartConfig = {
  predicted: { label: "Dự báo",  color: "var(--primary)" },
  actual:    { label: "Thực tế", color: "var(--chart-2)" },
} satisfies ChartConfig;

const CAMERAS = [
  { id: "all",    name: "Toàn mạng lưới" },
  { id: "cam-01", name: "Cầu Sài Gòn" },
  { id: "cam-02", name: "Ngã tư Đinh Tiên Hoàng" },
];

const NOW_HOUR = "17:00"; // trong thực tế dùng new Date()

interface Props {
  data?: TimelinePoint[];
}

/** Biểu đồ AreaChart 24h dự báo vs thực tế */
export function ForecastTimelineChart({ data = MOCK_TIMELINE }: Props) {
  const [selectedCam, setSelectedCam] = useState("all");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconChartAreaLine className="size-4 text-primary" />
            Dự báo lưu lượng theo giờ
          </CardTitle>
          <Select value={selectedCam} onValueChange={setSelectedCam}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMERAS.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ChartContainer config={CHART_CONFIG} className="h-[240px] w-full">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 28, bottom: 0 }}>
            <defs>
              <linearGradient id="fillPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-predicted)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-predicted)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-actual)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={6}
              interval={1}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={4} />

            {/* Đường dọc "Hiện tại" */}
            <ReferenceLine
              x={NOW_HOUR}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: "Hiện tại", position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />

            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const predicted = payload.find(p => p.dataKey === "predicted");
                const actual    = payload.find(p => p.dataKey === "actual");
                const isFuture  = (data.find(d => d.hour === label))?.isFuture;
                const errPct    = predicted?.value && actual?.value
                  ? Math.abs(((actual.value as number) - (predicted.value as number)) / (predicted.value as number) * 100).toFixed(1)
                  : null;
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[150px]">
                    <p className="font-medium mb-1.5">{label}</p>
                    {predicted && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full shrink-0" style={{ background: predicted.color }} />
                          <span className="text-muted-foreground">Dự báo</span>
                        </div>
                        <span className="font-semibold tabular-nums">{(predicted.value as number).toLocaleString("vi-VN")} xe</span>
                      </div>
                    )}
                    {actual && !isFuture && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full shrink-0" style={{ background: actual.color }} />
                          <span className="text-muted-foreground">Thực tế</span>
                        </div>
                        <span className="font-semibold tabular-nums">
                          {actual.value != null ? `${(actual.value as number).toLocaleString("vi-VN")} xe` : "—"}
                        </span>
                      </div>
                    )}
                    {isFuture && (
                      <p className="text-xs text-muted-foreground mt-1">Chưa có dữ liệu thực tế</p>
                    )}
                    {errPct && !isFuture && (
                      <div className="mt-1.5 pt-1.5 border-t text-xs flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Sai số</span>
                        <span className={parseFloat(errPct) <= 5 ? "text-green-600 font-semibold" : parseFloat(errPct) <= 15 ? "text-yellow-600 font-semibold" : "text-red-600 font-semibold"}>
                          {errPct}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Area
              dataKey="actual"
              type="monotone"
              stroke="var(--color-actual)"
              fill="url(#fillActual)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Area
              dataKey="predicted"
              type="monotone"
              stroke="var(--color-predicted)"
              fill="url(#fillPredicted)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>

        {/* Legend thủ công */}
        <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: "var(--primary)" }} />
            <span>Dự báo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 border-t-2" style={{ borderColor: "var(--chart-2)" }} />
            <span>Thực tế</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
