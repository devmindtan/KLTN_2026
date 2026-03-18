"use client"

import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { IconChartAreaLine } from "@tabler/icons-react"
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { type TrendInfo } from "@/contexts/SocketContext"

// import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { SelectWithSearch } from "@/components/custom/select-with-search"
import { DASHBOARD_TERM } from "@/lib/app-constants"
// import {
//   ToggleGroup,
//   ToggleGroupItem,
// } from "@/components/ui/toggle-group"

interface CameraData {
  id: string;
  name: string;
  shortId: string;
  totalObjects: number;
  inputValue?: number;  // Giá trị trung bình 5p thực sự dùng làm input dự đoán
  forecasts: {
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  trend: TrendInfo;
  calculation?: {
    capacity: number;    // Capacity camera (để tính vcPct)
    vc_ratio: number;
  };
}

interface ChartAreaInteractiveProps {
  cameras: CameraData[];
}


const chartConfig = {
  vehicles: {
    label: "Dự báo",
    color: "var(--primary)",
  },
  vcPct: {
    label: "Mức tải (%)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

/**
 * Component nhãn % thay đổi — đặt ngoài component chính để reference ổn định, tránh memory leak do Recharts re-mount
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PctChangeLabel = (props: any) => {
  const { x, y, value } = props;
  if (value === undefined || value === null) return null;
  const pct = value as number;
  const color = pct > 0 ? "#f97316" : pct < 0 ? "#22c55e" : "#9ca3af";
  const sign = pct > 0 ? "+" : "";
  return (
    <text x={Number(x)} y={Math.max(Number(y) - 6, 14)} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>
      {sign}{pct}%
    </text>
  );
};

export function ChartAreaInteractive({ cameras }: ChartAreaInteractiveProps) {
  const navigate = useNavigate()
  const { prefix } = useParams<{ prefix: string }>()
  const [selectedCamera, setSelectedCamera] = React.useState<string>("all")

  // Camera options cho SelectWithSearch – searchValue chứa shortId + id để tìm bằng mã ngắn
  const cameraOptions = React.useMemo(
    () => cameras.map((cam) => ({
      value:       cam.id,
      label:       cam.name,
      searchValue: `${cam.shortId} ${cam.id}`,
    })),
    [cameras]
  )

  /**
   * Build chartData trực tiếp từ socket (cameras prop) – không cần gọi rolling API
   * Dữ liệu tự động cập nhật mỗi khi CAMERA_UPDATED socket gửi prediction mới
   */
  const chartData = React.useMemo(() => {
    const timeframes = ["5m", "10m", "15m", "30m", "60m"] as const;
    const labelMap: Record<typeof timeframes[number], string> = {
      "5m": "5 phút", "10m": "10 phút", "15m": "15 phút", "30m": "30 phút", "60m": "60 phút",
    };

    let forecasts: CameraData["forecasts"] | null = null;
    let capacity: number | null = null;
    let currentBase: number | null = null;

    if (selectedCamera === "all") {
      const withData = cameras.filter((c) => c.forecasts);
      if (withData.length === 0) return [];

      // Tính trung bình forecast + capacity từ tất cả cameras
      const sums = { "5m": 0, "10m": 0, "15m": 0, "30m": 0, "60m": 0 };
      let capSum = 0, capCount = 0;
      for (const cam of withData) {
        for (const tf of timeframes) sums[tf] += cam.forecasts[tf] ?? 0;
        if (cam.calculation?.capacity) { capSum += cam.calculation.capacity; capCount++; }
      }
      forecasts = {
        "5m":  sums["5m"]  / withData.length,
        "10m": sums["10m"] / withData.length,
        "15m": sums["15m"] / withData.length,
        "30m": sums["30m"] / withData.length,
        "60m": sums["60m"] / withData.length,
      };
      capacity = capCount > 0 ? capSum / capCount : null;
      const withInput = cameras.filter((c) => c.inputValue != null);
      currentBase = withInput.length > 0
        ? withInput.reduce((s, c) => s + (c.inputValue ?? 0), 0) / withInput.length
        : null;
    } else {
      const cam = cameras.find((c) => c.id === selectedCamera);
      if (!cam) return [];
      forecasts = cam.forecasts;
      capacity = cam.calculation?.capacity ?? null;
      currentBase = cam.inputValue ?? null;
    }

    if (!forecasts) return [];

    return timeframes.map((timeframe) => {
      const vehicles = Math.round(forecasts![timeframe] ?? 0);
      const vcPct = capacity && capacity > 0 ? Math.min(100, Math.round(vehicles / capacity * 100)) : null;
      return {
        time: timeframe,
        vehicles,
        vcPct,
        pctChange: currentBase != null && currentBase > 0
          ? Math.round(((vehicles - currentBase) / currentBase) * 100)
          : null,
        label: labelMap[timeframe],
      };
    });
  }, [cameras, selectedCamera])

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardSectionHeader
              icon={IconChartAreaLine}
              title={DASHBOARD_TERM.chart1.title}
              iconBg="bg-blue-500/10"
              iconColor="text-blue-600"
              description={DASHBOARD_TERM.chart1.description}
              action={
                <button
                  onClick={() => navigate(`/${prefix}/dashboard`, { state: { tab: "forecast" } })}
                  className="text-[11px] text-primary hover:underline underline-offset-2 font-medium shrink-0"
                >
                  Xem chi tiết →
                </button>
              }
            />
          </div>
          <div className="shrink-0">
            <SelectWithSearch
              value={selectedCamera}
              onChange={setSelectedCamera}
              options={cameraOptions}
              defaultOption={{ value: "all", label: "Toàn mạng lưới" }}
              placeholder="Toàn mạng lưới"
              searchPlaceholder="Tìm máy quay, mã ID..."
              emptyText="Không tìm thấy máy quay nào"
              size="default"
              triggerClassName="w-full sm:w-55"
              ariaLabel="Chọn máy quay"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-4">
        {chartData.length === 0 ? (
          <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
            {cameras.length === 0 ? (
              <p className="text-sm font-medium">Đang tải dữ liệu camera...</p>
            ) : (
              <>
                <p className="text-sm font-medium">Không có dữ liệu dự đoán</p>
                <p className="text-xs">Chờ kết quả dự đoán từ model...</p>
              </>
            )}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[240px] w-full"
          >
            <AreaChart data={chartData} margin={{ top: 28, right: -20, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVehicles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-vehicles)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-vehicles)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillVcPct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-vcPct)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-vcPct)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const visibleRows = payload.filter((p) => p.value !== null && p.value !== undefined && p.value !== 0 || p.dataKey === "vehicles");
                  const labelMap: Record<string, string> = { vehicles: "Dự báo", vcPct: "Mức tải" };
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                      <p className="font-medium mb-1.5">{label}</p>
                      {visibleRows.map((p) => (
                        <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="text-muted-foreground">{labelMap[String(p.dataKey)] ?? String(p.dataKey)}</span>
                          </div>
                          <span className="font-semibold tabular-nums">
                            {p.dataKey === "vcPct" ? `${p.value}%` : `${p.value} xe`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="left"
                dataKey="vehicles"
                type="monotone"
                fill="url(#fillVehicles)"
                stroke="var(--color-vehicles)"
                strokeWidth={2}
                dot={false}
              >
                <LabelList dataKey="pctChange" content={PctChangeLabel} />
              </Area>
              {chartData.some((d) => d.vcPct !== null) && (
                <Area
                  yAxisId="right"
                  dataKey="vcPct"
                  type="monotone"
                  fill="url(#fillVcPct)"
                  stroke="var(--color-vcPct)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
        {chartData.length > 0 && (
          <div className="flex items-center gap-4 justify-center mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-5 border-t-2" style={{ borderColor: "var(--primary)" }} />
              <span>Dự báo</span>
            </div>
            {chartData.some((d) => d.vcPct !== null) && (
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: "var(--chart-2)" }} />
                <span>Mức tải V/C (%)</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
