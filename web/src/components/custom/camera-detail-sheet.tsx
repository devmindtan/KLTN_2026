/**
 * Sheet hiển thị thông tin chi tiết + dự báo của một camera giao thông.
 * Shared component dùng chung cho monitoring page và dashboard data-table.
 * Controlled component: mở/đóng bằng props open/onOpenChange.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusBadge } from "@/components/monitoring/camera-utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { IconCar, IconMotorbike } from "@tabler/icons-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSocket, type CameraData } from "@/contexts/SocketContext";
import { TIME_LABEL, TRAFFIC_TERMS, FORECAST_TERMS, getTrendLabel } from "@/lib/app-constants";

const forecastChartConfig = {
  vehicles: { label: "Dự báo (xe)", color: "var(--primary)" },
  vcPct:    { label: "Mức tải (%)",  color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Nhãn % thay đổi so với baseline – module-level để tránh Recharts re-mount */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PctForecastLabel = (props: any) => {
  const { x, y, value } = props;
  if (value === null || value === undefined) return null;
  const pct = value as number;
  const color = pct > 0 ? "#f97316" : pct < 0 ? "#22c55e" : "#9ca3af";
  const sign  = pct > 0 ? "+" : "";
  return (
    <text x={Number(x)} y={Math.max(Number(y) - 8, 14)} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
      {sign}{pct}%
    </text>
  );
};

interface CameraDetailSheetProps {
  camera: CameraData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Sheet chi tiết camera: ảnh, trạng thái, V/C bar, biểu đồ dự báo, thông số kỹ thuật */
export function CameraDetailSheet({ camera, open, onOpenChange }: CameraDetailSheetProps) {
  const isMobile = useIsMobile();
  const { cameraInfoMap } = useSocket();
  const cameraInfo = cameraInfoMap[camera.shortId];

  const capacity = camera.calculation?.capacity ?? 0;
  const baseline = camera.inputValue ?? camera.totalObjects;
  const forecastData = [
    { time: TIME_LABEL["5m"],  vehicles: Math.round(camera.forecasts["5m"]),  vcPct: capacity > 0 ? Math.round(camera.forecasts["5m"]  / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((camera.forecasts["5m"]  - baseline) / baseline * 100) : null },
    { time: TIME_LABEL["10m"], vehicles: Math.round(camera.forecasts["10m"]), vcPct: capacity > 0 ? Math.round(camera.forecasts["10m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((camera.forecasts["10m"] - baseline) / baseline * 100) : null },
    { time: TIME_LABEL["15m"], vehicles: Math.round(camera.forecasts["15m"]), vcPct: capacity > 0 ? Math.round(camera.forecasts["15m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((camera.forecasts["15m"] - baseline) / baseline * 100) : null },
    { time: TIME_LABEL["30m"], vehicles: Math.round(camera.forecasts["30m"]), vcPct: capacity > 0 ? Math.round(camera.forecasts["30m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((camera.forecasts["30m"] - baseline) / baseline * 100) : null },
    { time: TIME_LABEL["60m"], vehicles: Math.round(camera.forecasts["60m"]), vcPct: capacity > 0 ? Math.round(camera.forecasts["60m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((camera.forecasts["60m"] - baseline) / baseline * 100) : null },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto scrollbar w-full sm:max-w-xl">
        <SheetHeader className="gap-1">
          <SheetTitle>{camera.name}</SheetTitle>
          <SheetDescription>
           {camera.shortId} • Thông tin chi tiết và dự đoán lưu lượng giao thông
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-4 text-sm">
          {/* Camera Image */}
          {camera.imageUrl && (
            <div className="rounded-lg border overflow-hidden">
              <img
                src={camera.imageUrl}
                alt={`Camera ${camera.shortId}`}
                className="w-full h-55 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EImage Not Available%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
          )}

          <Separator />

          {/* Vehicle Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <Label className="text-xs text-muted-foreground">{TRAFFIC_TERMS.VEHICLE_COUNT}</Label>
              <div className="text-2xl font-bold tabular-nums">{camera.totalObjects}</div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <IconCar className="size-3.5 text-blue-500 shrink-0" />
                  <span className="text-sm font-semibold tabular-nums">{camera.carCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconMotorbike className="size-3.5 text-orange-500 shrink-0" />
                  <span className="text-sm font-semibold tabular-nums">{camera.motorbikeCount}</span>
                </div>
              </div>
            </div>
            {camera.inputValue !== undefined && (
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs text-muted-foreground">Trung bình {TIME_LABEL["5m"]} trước</Label>
                <div className="text-2xl font-bold tabular-nums">{Math.round(camera.inputValue)}</div>
              </div>
            )}
          </div>

          {/* Trạng thái hiện tại + dự báo 5p */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Trạng Thái Hiện Tại</Label>
              {getStatusBadge(camera.status.current)}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Dự Báo {TIME_LABEL["5m"]}</Label>
              {getStatusBadge(camera.status.forecast)}
            </div>
          </div>

          {/* V/C ratio bars: hiện tại + dự báo 5p */}
          {(camera.calculation || camera.realtimeData) && (
            <>
              <Separator />
              <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-3">
                {camera.realtimeData && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mức tải hiện tại</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {Math.round(camera.realtimeData.current_volume)} / {Math.round(camera.realtimeData.capacity)} xe
                        <span className="ml-1 text-muted-foreground">({Math.round(camera.realtimeData.vc_ratio * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          camera.realtimeData.vc_ratio < 0.60 ? "bg-green-500" :
                          camera.realtimeData.vc_ratio < 0.75 ? "bg-emerald-400" :
                          camera.realtimeData.vc_ratio < 0.85 ? "bg-yellow-400" :
                          camera.realtimeData.vc_ratio < 1.0  ? "bg-orange-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(camera.realtimeData.vc_ratio * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {camera.calculation && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mức tải dự báo 5p</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {Math.round(camera.calculation.predicted_volume)} / {Math.round(camera.calculation.capacity)} xe
                        <span className="ml-1 text-muted-foreground">({Math.round(camera.calculation.vc_ratio * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          camera.calculation.vc_ratio < 0.60 ? "bg-green-500" :
                          camera.calculation.vc_ratio < 0.75 ? "bg-emerald-400" :
                          camera.calculation.vc_ratio < 0.85 ? "bg-yellow-400" :
                          camera.calculation.vc_ratio < 1.0  ? "bg-orange-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(camera.calculation.vc_ratio * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">{FORECAST_TERMS.FORECAST_FULL}</Label>
                <ChartContainer config={forecastChartConfig} className="h-[200px]">
                  <AreaChart
                    accessibilityLayer
                    data={forecastData}
                    margin={{ left: -30, right: -20, top: 28, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
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
                        const labelMap: Record<string, string> = { vehicles: "Dự báo", vcPct: "Mức tải" };
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                            <p className="font-medium mb-1.5">{label}</p>
                            {payload.map((p) => (
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
                    <Area yAxisId="left" dataKey="vehicles" type="monotone" fill="var(--color-vehicles)" fillOpacity={0.4} stroke="var(--color-vehicles)">
                      <LabelList dataKey="pctChange" content={PctForecastLabel} />
                    </Area>
                    {capacity > 0 && (
                      <Area yAxisId="right" dataKey="vcPct" type="monotone" fill="var(--color-vcPct)" fillOpacity={0.15} stroke="var(--color-vcPct)" strokeDasharray="4 2" />
                    )}
                  </AreaChart>
                </ChartContainer>
              </div>
              <Separator />
            </>
          )}

          {/* Forecast Values */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Dự đoán số lượng {TRAFFIC_TERMS.VEHICLES.toLowerCase()}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["5m", "15m", "60m"] as const).map((k, i) => (
                <div key={k} className="flex flex-col gap-1 rounded-md border p-2">
                  <span className="text-[10px] text-muted-foreground">{[TIME_LABEL["5m"], TIME_LABEL["15m"], TIME_LABEL["60m"]][i]}</span>
                  <span className="text-lg font-semibold tabular-nums">{Math.round(camera.forecasts[k])}</span>
                  {capacity > 0 && <span className="text-xs text-muted-foreground">{Math.round(camera.forecasts[k] / capacity * 100)}% mức tải</span>}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Xu hướng</Label>
                <Badge variant="outline" className="flex gap-1">
                  {camera.trend.direction === "increasing" ? (
                    <TrendingUpIcon className="size-3 text-orange-500" />
                  ) : camera.trend.direction === "decreasing" ? (
                    <TrendingDownIcon className="size-3 text-green-500" />
                  ) : null}
                  {getTrendLabel(camera.trend.direction)}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1.5 border border-blue-200 dark:border-blue-800">
                💡 {camera.trend.direction === "increasing"
                  ? `GTI (${camera.trend.gti?.toFixed(1)}%) cao hơn hiện tại (${camera.trend.current_ratio?.toFixed(1)}%) → xu hướng tăng`
                  : camera.trend.direction === "decreasing"
                  ? `GTI (${camera.trend.gti?.toFixed(1)}%) thấp hơn hiện tại (${camera.trend.current_ratio?.toFixed(1)}%) → xu hướng giảm`
                  : `GTI (${camera.trend.gti?.toFixed(1)}%) ổn định so với hiện tại (${camera.trend.current_ratio?.toFixed(1)}%)`}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Cập nhật lần cuối</Label>
              <span className="text-xs">{camera.lastUpdated ? new Date(camera.lastUpdated).toLocaleString("vi-VN") : "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Dự đoán lần cuối</Label>
              <span className="text-xs">{camera.lastPredicted ? new Date(camera.lastPredicted).toLocaleString("vi-VN") : "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mã Camera</Label>
              <span className="font-mono text-xs">{camera.shortId}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Tên đường</Label>
              <span className="text-xs text-right break-words max-w-[60%]">{camera.name}</span>
            </div>
            {cameraInfo?.location && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tọa độ</Label>
                <span className="text-xs text-right break-all font-mono max-w-[60%]">{cameraInfo.location}</span>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">Đóng</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
