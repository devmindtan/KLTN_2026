"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
  forecasts: {
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  trend: string;
}

interface ChartAreaInteractiveProps {
  cameras: CameraData[];
}


const chartConfig = {
  vehicles: {
    label: "Vehicles",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

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
      console.log("⚠️ [ChartAreaInteractive] No cameras available");
      return [];
    }

    // Log forecasts của tất cả cameras
    // cameras.forEach(cam => {
    //   console.log(`🔮 [Chart] Camera ${cam.shortId} forecasts:`, cam.forecasts);
    // });

    // If "all" is selected, calculate average forecast
    if (selectedCamera === "all") {
      const timeframes = ["5m", "10m", "15m", "30m", "60m"] as const;
      const chartData = timeframes.map((timeframe) => {
        const avgVehicles = cameras.reduce(
          (sum, cam) => sum + (cam.forecasts[timeframe] || 0),
          0
        ) / cameras.length;

        return {
          time: timeframe,
          vehicles: Math.round(avgVehicles),
          label: timeframe === "5m" ? "5 min" :
            timeframe === "10m" ? "10 min" :
              timeframe === "15m" ? "15 min" :
                timeframe === "30m" ? "30 min" : "60 min",
        };
      });

      // console.log("📈 [Chart] Average forecast data:", chartData);
      return chartData;
    }

    // If specific camera is selected
    const camera = cameras.find((cam) => cam.id === selectedCamera);
    if (!camera) {
      // console.log("⚠️ [Chart] Selected camera not found:", selectedCamera);
      return [];
    }

    // console.log(`📈 [Chart] Specific camera ${camera.shortId} selected`);

    const timeframes = ["5m", "10m", "15m", "30m", "60m"] as const;
    const chartData = timeframes.map((timeframe) => ({
      time: timeframe,
      vehicles: Math.round(camera.forecasts[timeframe] || 0),
      label: timeframe === "5m" ? "5 min" :
        timeframe === "10m" ? "10 min" :
          timeframe === "15m" ? "15 min" :
            timeframe === "30m" ? "30 min" : "60 min",
    }));

    // console.log("📈 [Chart] Specific camera forecast data:", chartData);
    return chartData;
  }, [cameras, selectedCamera])

  const filteredData = chartData;
  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Dự báo giao thông</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Dự đoán số lượng phương tiện trong các mốc 5/10/15/30/60 phút
          </span>
          <span className="@[540px]/card:hidden">Next hour forecast</span>
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
                  placeholder="Search camera..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="overflow-y-auto max-h-[300px]">
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
                    No cameras found
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No forecast data available</p>
              <p className="text-sm">Waiting for predictions from AI model...</p>
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillVehicles" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-vehicles)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-vehicles)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                label={{ value: 'Vehicles', angle: -90, position: 'insideLeft' }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Forecast: ${value}`}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="vehicles"
                type="monotone"
                fill="url(#fillVehicles)"
                stroke="var(--color-vehicles)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
