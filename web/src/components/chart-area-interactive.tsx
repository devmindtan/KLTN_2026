"use client"

import * as React from "react"
import logger from "@/lib/logger"
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { type TrendInfo } from "@/contexts/SocketContext"

// import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
    label: "Phương tiện",
    color: "hsl(var(--chart-1))",
  },
  vcPct: {
    label: "Mức tải (%)",
    color: "hsl(var(--chart-2))",
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
  const [selectedCamera, setSelectedCamera] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState<string>("")

  // Filter cameras based on search query
  const filteredCameras = React.useMemo(() => {
    if (!searchQuery.trim()) return cameras;
    
    const query = searchQuery.toLowerCase();
    return cameras.filter(cam => 
      cam.name.toLowerCase().includes(query) ||
      cam.shortId.toLowerCase().includes(query) ||
      cam.id.toLowerCase().includes(query)
    );
  }, [cameras, searchQuery]);

  // Transform forecast data to chart format
  const chartData = React.useMemo(() => {
    // console.log("📊 [ChartAreaInteractive] Cameras received:", cameras.length);

    if (cameras.length === 0) {
      logger.log("⚠️ [ChartAreaInteractive] Không có camera nào");
      return [];
    }

    // If "all" is selected, calculate average forecast
    if (selectedCamera === "all") {
      const hasInputData = cameras.some(cam => cam.inputValue !== undefined);
      const currentBase = hasInputData
        ? cameras.reduce((sum, cam) => sum + (cam.inputValue ?? 0), 0) / cameras.filter(cam => cam.inputValue !== undefined).length
        : null;
      const timeframes = ["5m", "10m", "15m", "30m", "60m"] as const;
      const chartData = timeframes.map((timeframe) => {
        const avgVehicles = cameras.reduce(
          (sum, cam) => sum + (cam.forecasts[timeframe] || 0),
          0
        ) / cameras.length;
        const vehicles = Math.round(avgVehicles);
        return {
          time: timeframe,
          vehicles,
          vcPct: null as number | null,
          pctChange: (currentBase !== null && currentBase > 0)
            ? Math.round(((vehicles - currentBase) / currentBase) * 100)
            : null,
          label: timeframe === "5m" ? "5 phút" :
            timeframe === "10m" ? "10 phút" :
              timeframe === "15m" ? "15 phút" :
                timeframe === "30m" ? "30 phút" : "60 phút",
        };
      });

      return chartData;
    }

    // If specific camera is selected
    const camera = cameras.find((cam) => cam.id === selectedCamera);
    if (!camera) return [];

    const currentBase = camera.inputValue !== undefined ? camera.inputValue : null;
    const camCapacity = camera.calculation?.capacity ?? 0;
    const timeframes = ["5m", "10m", "15m", "30m", "60m"] as const;
    const chartData = timeframes.map((timeframe) => {
      const vehicles = Math.round(camera.forecasts[timeframe] || 0);
      return {
        time: timeframe,
        vehicles,
        vcPct: camCapacity > 0 ? Math.round(vehicles / camCapacity * 100) : null,
        pctChange: (currentBase !== null && currentBase > 0)
          ? Math.round(((vehicles - currentBase) / currentBase) * 100)
          : null,
        label: timeframe === "5m" ? "5 phút" :
          timeframe === "10m" ? "10 phút" :
            timeframe === "15m" ? "15 phút" :
              timeframe === "30m" ? "30 phút" : "60 phút",
      };
    });

    return chartData;
  }, [cameras, selectedCamera])

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Dự báo lưu lượng giao thông</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Dự đoán số lượng phương tiện trong các mốc 5/10/15/30/60 phút
          </span>
          <span className="@[540px]/card:hidden">Giờ dự đoán tiếp theo</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger
              className="w-65"
              aria-label="Select camera"
            >
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[400px]">
              <div className="sticky top-0 z-10 bg-background p-2 border-b">
                <input
                  type="text"
                  placeholder="Tìm kiếm camera..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="overflow-y-auto scrollbar max-h-[300px]">
                <SelectItem value="all" className="rounded-lg">
                  Tất cả camera (trung bình)
                </SelectItem>
                {filteredCameras.length > 0 ? (
                  filteredCameras.map((cam) => (
                    <SelectItem key={cam.id} value={cam.id} className="rounded-lg">
                      {cam.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Không tìm thấy camera nào
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-4">
        {chartData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">Không có dữ liệu dự đoán nào</p>
              <p className="text-sm">Đợi kết quả dự đoán từ model...</p>
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[300px] w-full"
          >
            <AreaChart data={chartData} margin={{ top: 28, right: -10, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVehicles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-vehicles)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-vehicles)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                label={{ value: 'Phương tiện', angle: -90, position: 'insideLeft', offset: 10 }}
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
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Mốc: ${value}`}
                    indicator="dot"
                    formatter={(value, name) =>
                      name === "vcPct"
                        ? [`${value}%`, " mức tải"]
                        : [`${value}`, " phương tiện"]
                    }
                  />
                }
              />
              <Area
                yAxisId="left"
                dataKey="vehicles"
                type="monotone"
                fill="url(#fillVehicles)"
                stroke="var(--color-vehicles)"
              >
                <LabelList dataKey="pctChange" content={PctChangeLabel} />
              </Area>
              {chartData.some((d) => d.vcPct !== null) && (
                <Area
                  yAxisId="right"
                  dataKey="vcPct"
                  type="monotone"
                  fill="var(--color-vcPct)"
                  fillOpacity={0.15}
                  stroke="var(--color-vcPct)"
                  strokeDasharray="4 2"
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
