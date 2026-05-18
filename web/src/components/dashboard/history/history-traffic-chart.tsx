"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { IconHistory } from "@tabler/icons-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { SelectWithSearch } from "@/components/custom/select-with-search";
import { getAllCameras } from "@/services/camera.service";
import type { CameraInfo } from "@/services/camera.service";
import {
  getTrafficHistory,
  vnDateOffset,
  dateToRelativeLabel,
  minuteToLabel,
  getCurrentVnMinute,
  DEFAULT_HISTORY_SERIES,
  type TrafficHistorySlot,
} from "@/services/traffic-history.service";
import { useTheme } from "@/contexts/ThemeContext";
import logger from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeriesData {
  key: string;
  label: string;
  color: string;
  date: string;
  slots: TrafficHistorySlot[];
  loading: boolean;
  error: boolean;
}

type MergedRow = {
  minuteOfDay: number;
  label: string;
  [seriesKey: string]: number | string | null;
};

// ─── Palette cố định cho 5 series (4 mặc định + 1 custom) ────────────────────
// Dùng hex literals — CSS vars không resolve được trong SVG stroke attribute của Recharts
const SERIES_COLORS = [
  "#2563eb", // today    — blue
  "#16a34a", // yesterday — green
  "#ea580c", // week1    — orange
  "#9333ea", // week2    — purple
  "#db2777", // custom   — pink
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge tất cả series vào 252 rows (5-phút từ 03:00 → 23:55) cho LineChart.
 * Mỗi row có `{key}_actual` (thực đo) và `{key}_forecast` (dự báo) per series.
 */
function mergeSeriesRows(seriesList: SeriesData[]): MergedRow[] {
  const rows: MergedRow[] = [];
  for (let i = 0; i < 252; i++) {
    const m = 180 + i * 5;   // minute 180 = 03:00, step 5
    const row: MergedRow = { minuteOfDay: m, label: minuteToLabel(m) };
    for (const s of seriesList) {
      const slot = s.slots[i]; // slots được sắp xếp thứ tự 03:00’23:55 từ backend
      row[`${s.key}_actual`]   = slot?.actual   ?? null;
      row[`${s.key}_forecast`] = slot?.forecast ?? null;
    }
    rows.push(row);
  }
  return rows;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  dataKey: string;
  value: number | null;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  seriesList: SeriesData[];
  showForecast?: boolean;
}

function HistoryTooltip({ active, payload, label, seriesList, showForecast = false }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Group payload items by series key (strip _actual / _forecast suffix)
  const grouped = new Map<string, { actual?: number | null; forecast?: number | null }>();
  for (const item of payload) {
    const dk = item.dataKey as string;
    const isActual   = dk.endsWith("_actual");
    const isForecast = dk.endsWith("_forecast");
    if (!isActual && !isForecast) continue;
    const key = isActual ? dk.slice(0, -7) : dk.slice(0, -9);
    if (!grouped.has(key)) grouped.set(key, {});
    const entry = grouped.get(key)!;
    if (isActual) entry.actual = item.value as number | null;
    else          entry.forecast = item.value as number | null;
  }

  const hasAny = [...grouped.values()].some(
    (g) => g.actual != null || g.forecast != null
  );
  if (!hasAny) return null;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[175px]">
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      {[...grouped.entries()].map(([key, vals]) => {
        const series = seriesList.find((s) => s.key === key);
        if (!series) return null;
        return (
          <div key={key} className="mb-2 last:mb-0">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-0.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: series.color }} />
              <span className="text-foreground">{series.label}</span>
            </div>
            {vals.actual != null && (
              <div className="flex justify-between text-xs pl-3.5">
                <span className="text-muted-foreground">Thực tế</span>
                <span className="font-semibold text-foreground ml-3 tabular-nums">{vals.actual} xe</span>
              </div>
            )}
            {showForecast && vals.forecast != null && (
              <div className="flex justify-between text-xs pl-3.5">
                <span className="text-muted-foreground">Dự báo</span>
                <span className="font-semibold ml-3 tabular-nums" style={{ color: series.color }}>{vals.forecast} xe</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Biểu đồ lịch sử lưu lượng giao thông — kiểu stock/bitcoin chart
 * So sánh nhiều ngày trên cùng trục giờ (Hôm nay, Hôm qua, 7 ngày trước, 14 ngày trước + custom)
 */
export function HistoryTrafficChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState("all");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    new Set(DEFAULT_HISTORY_SERIES.map((s) => s.key))
  );

  // Custom date series (thêm ngày so sánh tùy chọn)
  const [customDate, setCustomDate] = useState("");
  const [customSeries, setCustomSeries] = useState<SeriesData | null>(null);
  // Ẩn đường dự báo mặc định — tránh trùng lặp với tab Dự báo
  const [showForecast, setShowForecast] = useState(false);

  // Tạo series list từ DEFAULT_HISTORY_SERIES + custom
  const [seriesMap, setSeriesMap] = useState<Map<string, SeriesData>>(() => {
    const map = new Map<string, SeriesData>();
    DEFAULT_HISTORY_SERIES.forEach((s, i) => {
      map.set(s.key, {
        key: s.key,
        label: s.label,
        color: SERIES_COLORS[i],
        date: vnDateOffset(s.offset),
        slots: [],
        loading: true,
        error: false,
      });
    });
    return map;
  });

  // ── Load cameras ────────────────────────────────────────────────────────────
  useEffect(() => {
    getAllCameras()
      .then(setCameras)
      .catch((e) => logger.error("[HistoryTrafficChart] cameras error:", e));
  }, []);

  // ── Load dữ liệu cho tất cả default series ──────────────────────────────────
  const loadSeries = useCallback(
    async (key: string, date: string) => {
      setSeriesMap((prev) => {
        const updated = new Map(prev);
        const entry = updated.get(key);
        if (entry) updated.set(key, { ...entry, loading: true, error: false });
        return updated;
      });
      try {
        const res = await getTrafficHistory(date, cameraId);
        setSeriesMap((prev) => {
          const updated = new Map(prev);
          const entry = updated.get(key);
          if (entry) {
            updated.set(key, {
              ...entry,
              slots: res.data,
              loading: false,
              error: false,
            });
          }
          return updated;
        });
      } catch {
        setSeriesMap((prev) => {
          const updated = new Map(prev);
          const entry = updated.get(key);
          if (entry) updated.set(key, { ...entry, loading: false, error: true });
          return updated;
        });
      }
    },
    [cameraId]
  );

  // Load lại toàn bộ khi cameraId đổi
  useEffect(() => {
    DEFAULT_HISTORY_SERIES.forEach((s) => {
      loadSeries(s.key, vnDateOffset(s.offset));
    });
    // Reset custom series cùng camera
    if (customSeries) {
      loadCustomDate(customSeries.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  // ── Load custom date ─────────────────────────────────────────────────────────
  const loadCustomDate = useCallback(
    async (date: string) => {
      const label = dateToRelativeLabel(date);
      const key = "custom";
      const newEntry: SeriesData = {
        key,
        label,
        color: SERIES_COLORS[4],
        date,
        slots: [],
        loading: true,
        error: false,
      };
      setCustomSeries(newEntry);
      setVisibleKeys((prev) => new Set([...prev, key]));
      try {
        const res = await getTrafficHistory(date, cameraId);
        setCustomSeries((prev) =>
          prev ? { ...prev, slots: res.data, loading: false } : null
        );
      } catch {
        setCustomSeries((prev) =>
          prev ? { ...prev, loading: false, error: true } : null
        );
      }
    },
    [cameraId]
  );

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDate(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      loadCustomDate(val);
    }
  };

  const removeCustomDate = () => {
    setCustomDate("");
    setCustomSeries(null);
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.delete("custom");
      return next;
    });
  };

  // ── Build combined series list ───────────────────────────────────────────────
  const allSeries: SeriesData[] = [
    ...Array.from(seriesMap.values()),
    ...(customSeries ? [customSeries] : []),
  ];

  const visibleSeries = allSeries.filter((s) => visibleKeys.has(s.key));
  const chartRows = mergeSeriesRows(visibleSeries);

  // ── Stats tóm tắt mỗi series (cao điểm + TB) ─────────────────────────────
  type SeriesStat = {
    key: string; color: string; label: string;
    peakValue: number; peakTime: string; avg: number;
  };
  const seriesStats: SeriesStat[] = visibleSeries
    .filter((s) => !s.loading && !s.error)
    .map((s) => {
      const loaded = s.slots.filter((sl) => sl.actual !== null);
      if (loaded.length === 0) return null;
      const peak = loaded.reduce((best, sl) => (sl.actual! > best.actual! ? sl : best));
      const avg  = loaded.reduce((sum, sl) => sum + sl.actual!, 0) / loaded.length;
      return {
        key: s.key, color: s.color, label: s.label,
        peakValue: peak.actual!, peakTime: peak.label,
        avg: Math.round(avg * 10) / 10,
      };
    })
    .filter((x): x is SeriesStat => x !== null);

  // ── "Hiện tại" reference line — chỉ hiển thị khi series "today" đang visible ──────────
  const nowMinute = getCurrentVnMinute();
  const showNowLine = visibleKeys.has("today") && nowMinute >= 180 && nowMinute <= 1435;
  const nowLabel = minuteToLabel(nowMinute);

  // ── Camera options ───────────────────────────────────────────────────────────
  const cameraOptions = cameras.map((c) => ({ value: c.cam_id, label: c.display_name }));

  const isAnyLoading = allSeries.some((s) => s.loading);

  // ── Axis style ───────────────────────────────────────────────────────────────
  const axisColor = isDark ? "#6b7280" : "#9ca3af";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardSectionHeader
          icon={IconHistory}
          title="Lịch sử lưu lượng giao thông"
          description="So sánh xu hướng lưu lượng theo 5 phút qua các ngày (03:00 – 23:55) — biểu đồ kiểu tài chính"
          badge={
            isAnyLoading ? (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Đang tải...
              </Badge>
            ) : null
          }
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Camera selector */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Camera</Label>
            <SelectWithSearch
              defaultOption={{ value: "all", label: "Tất cả camera" }}
              options={cameraOptions}
              value={cameraId}
              onChange={setCameraId}
              placeholder="Chọn camera..."
              triggerClassName="w-48"
            />
          </div>

          {/* Custom date picker */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Thêm ngày so sánh</Label>
            <div className="flex gap-1.5 items-center">
              <input
                type="date"
                value={customDate}
                onChange={handleCustomDateChange}
                max={vnDateOffset(-1)}
                className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {customSeries && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-muted-foreground"
                  onClick={removeCustomDate}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

          {/* Series toggles + forecast toggle */}
          <div className="flex flex-wrap gap-3 items-center ml-auto">
            {allSeries.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <Checkbox
                  id={`series-${s.key}`}
                  checked={visibleKeys.has(s.key)}
                  onCheckedChange={(checked) => {
                    setVisibleKeys((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(s.key);
                      else next.delete(s.key);
                      return next;
                    });
                  }}
                  style={{ accentColor: s.color }}
                  className="size-3.5"
                />
                <label
                  htmlFor={`series-${s.key}`}
                  className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                >
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                  {s.loading && (
                    <span className="text-[10px] text-muted-foreground/60">(đang tải)</span>
                  )}
                  {s.error && (
                    <span className="text-[10px] text-destructive">(lỗi)</span>
                  )}
                </label>
              </div>
            ))}
            {/* Divider + forecast toggle */}
            <div className="w-px h-4 bg-border/60 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="show-forecast"
                checked={showForecast}
                onCheckedChange={(v) => setShowForecast(!!v)}
                className="size-3.5"
              />
              <label
                htmlFor="show-forecast"
                className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
              >
                <svg width="14" height="5" className="inline">
                  <line x1="0" y1="2.5" x2="14" y2="2.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                </svg>
                Dự báo
              </label>
            </div>
          </div>
        </div>

        {/* ── Stats cards tóm tắt ────────────────────────────────────────── */}
        {seriesStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {seriesStats.map((stat) => (
              <div
                key={stat.key}
                className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ background: stat.color }} />
                  <span className="text-[10px] font-medium text-muted-foreground truncate">{stat.label}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Cao điểm</span>
                    <span className="font-semibold tabular-nums">{stat.peakValue} xe</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Lúc</span>
                    <span className="font-semibold tabular-nums text-primary">{stat.peakTime}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">TB/5ph</span>
                    <span className="font-semibold tabular-nums">{stat.avg} xe</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Chart ────────────────────────────────────────────────────────── */}
        {visibleSeries.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Chọn ít nhất 1 ngày để hiển thị biểu đồ
          </div>
        ) : isAnyLoading && visibleSeries.every((s) => s.slots.length === 0) ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <>
            {/* Chú giải kiểu đường */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="2"/></svg>
                Thực tế
              </span>
              {showForecast && (
                <span className="flex items-center gap-1">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="2" strokeDasharray="4 2"/></svg>
                  Dự báo
                </span>
              )}
              {showNowLine && (
                <span className="flex items-center gap-1">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
                  Hiện tại ({nowLabel})
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart
                data={chartRows}
                margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
              >
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                  axisLine={false}
                  interval={11}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<HistoryTooltip seriesList={visibleSeries} showForecast={showForecast} />}
                  cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: "4 2" }}
                />
                {showNowLine && (
                  <ReferenceLine
                    x={nowLabel}
                    stroke="#ef4444"
                    strokeDasharray="3 2"
                    strokeWidth={1.5}
                    label={{ value: "Hiện tại", position: "top", fontSize: 9, fill: "#ef4444" }}
                  />
                )}
                {visibleSeries.flatMap((s) => [
                  <Line
                    key={`${s.key}_actual`}
                    type="monotone"
                    dataKey={`${s.key}_actual`}
                    stroke={s.color}
                    strokeWidth={s.key === "today" ? 2.5 : 1.8}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />,
                  ...(showForecast ? [
                    <Line
                      key={`${s.key}_forecast`}
                      type="monotone"
                      dataKey={`${s.key}_forecast`}
                      stroke={s.color}
                      strokeWidth={1.2}
                      strokeDasharray="4 2"
                      strokeOpacity={0.65}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />,
                  ] : []),
                ])}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {/* ── Date labels ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
          {allSeries.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-medium">{s.label}</span>
              <span>({s.date})</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
