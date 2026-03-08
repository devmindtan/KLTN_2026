"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTrafficPattern,
  type TrafficPatternPoint,
  type PatternType,
} from "@/services/traffic-pattern.service";
import { getAllCameras } from "@/services/camera.service";
import logger from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────────────────

type TabKey = "hour" | "dow" | "week" | "month";
type PatternData = Record<TabKey, TrafficPatternPoint[]>;

const TAB_TO_API: Record<TabKey, PatternType> = {
  hour: "hour",
  dow: "dow",
  week: "week_of_month",
  month: "month",
};

const EMPTY_PATTERN: PatternData = { hour: [], dow: [], week: [], month: [] };

const TAB_CONFIG: Record<TabKey, { label: string; note: string }> = {
  hour:  { label: "Giờ trong ngày",   note: "Hôm nay từ 6:00 · Từng giờ đã hoàn thành" },
  dow:   { label: "Thứ trong tuần",  note: "Tuần này (T2 → hôm qua) · Theo ngày trong tuần" },
  week:  { label: "Tuần trong tháng",  note: "Năm nay · Theo tuần (ngày khởi đầu tuần)" },
  month: { label: "Tháng trong năm", note: "Năm nay (T1 → tháng trước) · Theo tháng" },
};

const chartConfig = {
  avg_vehicles: {
    label: "TB xe / 5 phút",
    color: "var(--chart-1)",
  },
  max_vehicles: {
    label: "Max xe",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

// ─── Sub-component: một BarChart cho 1 tab ───────────────────────────────────

/** Bỏ số 0 đứng đầu trong label "dd/mm" → "d/m" */
function stripLeadingZeros(label: string): string {
  return label.replace(/\b0(\d)/g, "$1");
}

function PatternBarChart({
  data,
  tab,
  isLoading,
  error,
}: {
  data: TrafficPatternPoint[];
  tab: TabKey;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground">
        <p className="text-sm">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground">
        <p className="text-sm">Chưa có dữ liệu lịch sử</p>
      </div>
    );
  }

  // Chuyển đổi label cho tab "week": "02/03" → "2/3"
  const chartData = tab === "week"
    ? data.map((d) => ({ ...d, label: stripLeadingZeros(d.label) }))
    : data;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <BarChart data={chartData} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
          label={{
            value: "",
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
          }}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => `${value}`}
              formatter={(value, name) => [
                `${value} `,
                name === "avg_vehicles" ? "Trung bình" : "Cao nhất",
              ]}
            />
          }
        />
        <Bar
          dataKey="avg_vehicles"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        >
          <LabelList
            dataKey="sample_count"
            position="top"
            style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            formatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
        </Bar>
        <Bar
          dataKey="max_vehicles"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          opacity={0.45}
        />
      </BarChart>
    </ChartContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Biểu đồ cột thể hiện giao động mật độ giao thông theo 4 chiều thời gian:
 * theo giờ, theo ngày trong tuần, theo tuần trong tháng, theo tháng trong năm
 */
export function TrafficDensityChart() {
  const [activeTab, setActiveTab]         = React.useState<TabKey>("hour");
  const [selectedCamera, setSelectedCamera] = React.useState<string>("all");
  const [searchQuery, setSearchQuery]     = React.useState<string>("");
  const [cameraList, setCameraList]       = React.useState<{ id: string; name: string }[]>([]);
  const [patternData, setPatternData]     = React.useState<PatternData>(EMPTY_PATTERN);
  const [timeRanges, setTimeRanges]       = React.useState<Partial<Record<TabKey, { from: string; to: string }>>>({});
  const [isLoading, setIsLoading]         = React.useState(true);
  const [error, setError]                 = React.useState<string | null>(null);

  /** Tải danh sách camera khi mount */
  React.useEffect(() => {
    getAllCameras()
      .then((cameras) =>
        setCameraList(cameras.map((c) => ({ id: c.cam_id, name: c.display_name })))
      )
      .catch((err) => logger.error("[TrafficDensityChart] Load cameras failed:", err));
  }, []);

  /** Tải dữ liệu pattern khi camera thay đổi */
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [hour, dow, week, month] = await Promise.all([
          getTrafficPattern(TAB_TO_API.hour,  selectedCamera),
          getTrafficPattern(TAB_TO_API.dow,   selectedCamera),
          getTrafficPattern(TAB_TO_API.week,  selectedCamera),
          getTrafficPattern(TAB_TO_API.month, selectedCamera),
        ]);
        if (!cancelled) {
          setPatternData({ hour: hour.data, dow: dow.data, week: week.data, month: month.data });
          // time_range từ backend đã là VN local time (UTC+7) cho mọi tab
          setTimeRanges({
            hour:  hour.time_range,
            dow:   dow.time_range,
            week:  week.time_range,
            month: month.time_range,
          });
        }
      } catch {
        if (!cancelled) {
          setPatternData(EMPTY_PATTERN);
          setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [selectedCamera]);

  const filteredCameras = React.useMemo(() => {
    if (!searchQuery.trim()) return cameraList;
    const q = searchQuery.toLowerCase();
    return cameraList.filter((c) => c.name.toLowerCase().includes(q));
  }, [searchQuery, cameraList]);

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Giao động mật độ giao thông</CardTitle>
        <CardDescription>
          Phân tích lưu lượng trung bình theo chu kỳ thời gian ·{" "}
          <span className="text-chart-1 font-medium">■</span> Trung bình &nbsp;
          <span className="text-chart-2 font-medium">■</span> Cao nhất
        </CardDescription>

        {/* Camera Selector */}
        <div className="absolute right-4 top-4">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-64" aria-label="Chọn camera">
              <SelectValue placeholder="Tất cả camera" />
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
                      <span className="truncate max-w-[220px] block">{cam.name}</span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Không tìm thấy camera
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
        >
          <TabsList className="mb-4 w-full grid grid-cols-4">
            {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {TAB_CONFIG[key].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => (
            <TabsContent key={key} value={key}>
              <PatternBarChart
                data={patternData[key]}
                tab={key}
                isLoading={isLoading}
                error={error}
              />
              {!isLoading && !error && timeRanges[key] && (
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {timeRanges[key]!.from} – {timeRanges[key]!.to}
                </p>
              )}
              {!isLoading && !error && !timeRanges[key] && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {TAB_CONFIG[key].note}
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
