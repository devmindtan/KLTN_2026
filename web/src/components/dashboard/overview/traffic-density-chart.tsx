"use client";

import * as React from "react";
import { IconChartHistogram } from "@tabler/icons-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { CardSectionHeader } from "@/components/custom/card-section-header";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { SelectWithSearch } from "@/components/custom/select-with-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTrafficPattern,
  type TrafficPatternPoint,
  type PatternType,
} from "@/services/traffic-pattern.service";
import { getAllCameras } from "@/services/camera.service";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile, useIsNarrow } from "@/hooks/use-mobile";
import { DASHBOARD_TERM } from "@/lib/app-constants";
import logger from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────────────────

type TabKey = "hour" | "dow" | "week" | "month";
type PatternData = Record<TabKey, TrafficPatternPoint[]>;

// ─── Fixed slot templates (rolling window cố định N bars) ────────────────────

/** 18 giờ cố định từ 06:00 → 23:00 (tương ứng dữ liệu 6h–midnight) */
const HOUR_SLOTS = Array.from({ length: 18 }, (_, i) =>
  `${String(i + 6).padStart(2, "0")}:00`
);

/** Tên 7 thứ trong tuần — index 0 = Thứ 2 (ISODOW=1) */
const DOW_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];

/** Số tuần cố định trong rolling window */
const WEEK_SLOTS_COUNT = 4;

/**
 * Trả về 7 slot DOW theo thứ tự cuộn: bắt đầu từ ngày hôm nay (= 7 ngày trước VN)
 * đến hôm qua VN. Ví dụ: nếu hôm nay là Thứ 4, slots = [Thứ 4, Thứ 5, Thứ 6, Thứ 7, CN, Thứ 2, Thứ 3]
 */
function buildDowSlots(): string[] {
  const vnNow   = new Date(Date.now() + 7 * 3600 * 1000);
  const todayIso = vnNow.getUTCDay() === 0 ? 7 : vnNow.getUTCDay(); // 1=Mon … 7=Sun
  return Array.from({ length: 7 }, (_, i) => DOW_NAMES[((todayIso - 1 + i) % 7)]);
}

/**
 * Trả về 12 slot tháng theo thứ tự cuộn: bắt đầu từ tháng hiện tại (= tháng này năm ngoái)
 * đến tháng trước VN. Ví dụ: nếu đang là T3/2026, slots = [T3,T4,...,T12,T1,T2]
 */
function buildMonthSlots(): string[] {
  const vnNow      = new Date(Date.now() + 7 * 3600 * 1000);
  const currentM   = vnNow.getUTCMonth() + 1; // 1-12
  return Array.from({ length: 12 }, (_, i) => `T${((currentM - 1 + i) % 12) + 1}`);
}

const EMPTY_POINT = (label: string): TrafficPatternPoint => ({
  label,
  avg_vehicles: 0,
  max_vehicles: 0,
  sample_count: 0,
});

/**
 * Số samples kỳ vọng mỗi slot (10s/ảnh → 360 records/giờ/camera)
 * Dùng để tính % độ phủ dữ liệu thực tế so với lý thuyết
 */
const EXPECTED_SAMPLES: Record<TabKey, number> = {
  hour:  360,               // 1h × 360
  dow:   360 * 18,          // 18h (6h–24h) × 360 = 6480
  week:  360 * 18 * 7,      // 7 ngày × 18h × 360 = 45360
  month: 360 * 18 * 30,     // ~30 ngày × 18h × 360 = 194400
};

/**
 * Merge dữ liệu API vào template slot cố định để đảm bảo luôn có đủ N bar.
 * Slot chưa có dữ liệu sẽ có giá trị 0 (hiển thị bar trống).
 */
function buildSlottedData(data: TrafficPatternPoint[], tab: TabKey): TrafficPatternPoint[] {
  if (tab === "hour") {
    return HOUR_SLOTS.map((slot) => data.find((d) => d.label === slot) ?? EMPTY_POINT(slot));
  }
  if (tab === "dow") {
    return buildDowSlots().map((slot) => data.find((d) => d.label === slot) ?? EMPTY_POINT(slot));
  }
  if (tab === "month") {
    return buildMonthSlots().map((slot) => data.find((d) => d.label === slot) ?? EMPTY_POINT(slot));
  }
  if (tab === "week") {
    // Tuần dùng label ngày thực tế → lấy N tuần gần nhất, pad đầu nếu thiếu
    const sliced = data.slice(-WEEK_SLOTS_COUNT);
    while (sliced.length < WEEK_SLOTS_COUNT) {
      sliced.unshift(EMPTY_POINT("-"));
    }
    return sliced;
  }
  return data;
}

const TAB_TO_API: Record<TabKey, PatternType> = {
  hour: "hour",
  dow: "dow",
  week: "week_of_month",
  month: "month",
};

const EMPTY_PATTERN: PatternData = { hour: [], dow: [], week: [], month: [] };

const TAB_CONFIG: Record<TabKey, { label: string; shortLabel: string; note: string }> = {
  hour:  { label: "Giờ trong ngày",   shortLabel: "Giờ",   note: "Hôm nay từ 6:00 · Từng giờ đã hoàn thành" },
  dow:   { label: "Thứ trong tuần",   shortLabel: "Thứ",   note: "7 ngày gần nhất (cuộn) · Theo ngày trong tuần" },
  week:  { label: "Tuần trong tháng", shortLabel: "Tuần",  note: "4 tuần hoàn chỉnh gần nhất (cuộn) · Theo tuần" },
  month: { label: "Tháng trong năm",  shortLabel: "Tháng", note: "12 tháng hoàn chỉnh gần nhất (cuộn) · Theo tháng" },
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

function PatternBarChart({
  data,
  tab,
  totalCameras,
  isLoading,
  error,
  isMobile,
  isNarrow,
}: {
  data: TrafficPatternPoint[];
  tab: TabKey;
  totalCameras: number;
  isLoading: boolean;
  error: string | null;
  isMobile: boolean;
  isNarrow: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // Màu label thực tế theo theme (không dùng CSS var vì Recharts SVG không re-evaluate khi class thay đổi)
  const labelColor = isDark ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";

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

  // Luôn sử dụng full slot template (N bars cố định); slot trống có giá trị = 0
  const chartData = buildSlottedData(data, tab);

  // Tính % độ phủ sample thực tế / kỳ vọng cho mỗi slot
  const expectedSamples = EXPECTED_SAMPLES[tab];
  const chartDataWithPct = chartData.map((d) => ({
    ...d,
    samplePct:
      totalCameras > 0 && expectedSamples > 0 && d.sample_count > 0
        ? Math.min(100, Math.round((d.sample_count / totalCameras / expectedSamples) * 100))
        : 0,
  }));

  // Mobile: tab "month" chỉ hiển thị 10 tháng gần nhất (bỏ 2 tháng cũ nhất)
  const displayData = tab === "month" && isMobile
    ? chartDataWithPct.slice(-10)
    : chartDataWithPct;

  // Kiểm tra có ít nhất 1 slot có dữ liệu thực
  const hasData = displayData.some((d) => d.avg_vehicles > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground">
        <p className="text-sm">Chưa có dữ liệu lịch sử</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
      <BarChart data={displayData} barGap={2} margin={isMobile ? { top: 20, right: 4, bottom: 0, left: -20 } : { top: 20, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          height={isMobile ? 0 : 44}
          tick={isMobile ? false : (tickProps) => {
            const { x, y, payload } = tickProps;
            const item = displayData.find((d) => d.label === payload.value);
            const pct = item?.samplePct ?? 0;
            const pctColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
            const labelFill = isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)";
            return (
              <g transform={`translate(${x},${y})`}>
                <text textAnchor="middle" style={{ fill: labelFill, fontSize: 11 }} dy={12}>
                  {payload.value}
                </text>
                {!isNarrow && pct > 0 && (
                  <text textAnchor="middle" style={{ fill: pctColor, fontSize: 9, fontWeight: 700 }} dy={26}>
                    ({pct}%)
                  </text>
                )}
              </g>
            );
          }}
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
          cursor={{ fill: "hsl(var(--foreground))", opacity: 0.05 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0]?.payload as typeof displayData[number];
            const pct = item?.samplePct ?? 0;
            const pctColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
            return (
              <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                <p className="font-medium mb-1.5">{label}</p>
                {payload.map((p) => (
                  <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="text-muted-foreground">{p.dataKey === "avg_vehicles" ? "Trung bình" : "Cao nhất"}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{p.value}</span>
                  </div>
                ))}
                {pct > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t text-xs flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Độ phủ mẫu</span>
                    <span className="font-semibold" style={{ color: pctColor }}>{pct}%</span>
                  </div>
                )}
              </div>
            );
          }}
        />
        {/* Bar trung bình – label avg hiển thị bên trong đỉnh bar, ẩn dưới 950px */}
        <Bar
          dataKey="avg_vehicles"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        >
          {!isNarrow && (
            <LabelList
              dataKey="avg_vehicles"
              position="insideTop"
              offset={4}
              style={{ fontSize: 9, fill: labelColor, fontWeight: 700 }}
              formatter={(v: number) => v === 0 ? "" : `${Math.round(v)}`}
            />
          )}
        </Bar>
        {/* Bar cao nhất – ẩn label dưới 950px */}
        <Bar
          dataKey="max_vehicles"
          fill="var(--chart-2)"
          fillOpacity={0.9}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        >
          {!isNarrow && (
            <LabelList
              dataKey="max_vehicles"
              position="insideTop"
              offset={4}
              style={{ fontSize: 9, fill: labelColor, fontWeight: 700 }}
              formatter={(v: number) =>
                v === 0 ? "" : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
          )}
        </Bar>
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
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();
  const [activeTab, setActiveTab]         = React.useState<TabKey>("hour");
  const [selectedCamera, setSelectedCamera] = React.useState<string>("all");
  const [cameraList, setCameraList]       = React.useState<{ id: string; name: string }[]>([]);
  const [patternData, setPatternData]         = React.useState<PatternData>(EMPTY_PATTERN);
  const [timeRanges, setTimeRanges]           = React.useState<Partial<Record<TabKey, { from: string; to: string }>>>({});
  const [totalCamerasPerTab, setTotalCamerasPerTab] = React.useState<Partial<Record<TabKey, number>>>({});
  const [isLoading, setIsLoading]             = React.useState(true);
  const [error, setError]                     = React.useState<string | null>(null);

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
          setTotalCamerasPerTab({
            hour:  hour.meta.total_cameras,
            dow:   dow.meta.total_cameras,
            week:  week.meta.total_cameras,
            month: month.meta.total_cameras,
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

  const cameraOptions = React.useMemo(
    () => cameraList.map((c) => ({ value: c.id, label: c.name })),
    [cameraList]
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardSectionHeader
              icon={IconChartHistogram}
              title={DASHBOARD_TERM.chart2.title}
              iconBg="bg-violet-500/10"
              iconColor="text-violet-600"
              description={DASHBOARD_TERM.chart2.description}
            />
          </div>

          {/* Camera Selector */}
          <div className="shrink-0">
            <SelectWithSearch
              value={selectedCamera}
              onChange={setSelectedCamera}
              options={cameraOptions}
              defaultOption={{ value: "all", label: "Toàn mạng lưới" }}
              placeholder="Toàn mạng lưới"
              searchPlaceholder="Tìm kiếm máy quay..."
              emptyText="Không tìm thấy máy quay"
              triggerClassName="w-full sm:w-55"
              ariaLabel="Chọn máy quay"
            />
          </div>
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
                <span className="hidden sm:inline">{TAB_CONFIG[key].label}</span>
                <span className="sm:hidden">{TAB_CONFIG[key].shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => (
            <TabsContent key={key} value={key}>
              <PatternBarChart
                data={patternData[key]}
                tab={key}
                totalCameras={totalCamerasPerTab[key] ?? 1}
                isLoading={isLoading}
                error={error}
                isMobile={isMobile}
                isNarrow={isNarrow}
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
