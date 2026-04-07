/**
 * Trend Accuracy Card — Độ chính xác xu hướng (GTI) với breakdown per-horizon
 */
import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import {
  IconTrendingUp,
  IconArrowUp,
  IconArrowDown,
  IconMinus,
} from "@tabler/icons-react";

interface TrendAccuracyCardProps {
  trendAccuracy: {
    trend_accuracy: number;
    total_checks: number;
    correct_predictions: number;
    correct_increasing: number;
    correct_decreasing: number;
    correct_stable: number;
    per_horizon?: Array<{
      horizon_minutes: number;
      trend_accuracy: number;
      correct_predictions: number;
      total_checks: number;
      correct_increasing: number;
      correct_decreasing: number;
      correct_stable: number;
    }>;
  };
  periodDays: number;
}

function QualityBadge({
  value,
  thresholds,
}: {
  value: number;
  thresholds: [number, number];
}) {
  if (value >= thresholds[0])
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
      >
        Tốt
      </Badge>
    );
  if (value >= thresholds[1])
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400"
      >
        Trung bình
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
    >
      Cần cải thiện
    </Badge>
  );
}

export function TrendAccuracyCard({
  trendAccuracy,
  periodDays,
}: TrendAccuracyCardProps) {
  const [selectedHorizon, setSelectedHorizon] = React.useState<number>(5);

  const trendOverall = {
    avg_accuracy: trendAccuracy.trend_accuracy ?? 0,
    total_correct: trendAccuracy.correct_predictions ?? 0,
    total_checks: trendAccuracy.total_checks ?? 0,
    correct_increasing: trendAccuracy.correct_increasing ?? 0,
    correct_decreasing: trendAccuracy.correct_decreasing ?? 0,
    correct_stable: trendAccuracy.correct_stable ?? 0,
    from_per_horizon: !!trendAccuracy.per_horizon,
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardSectionHeader
          icon={IconTrendingUp}
          title="Độ chính xác xu hướng"
          iconColor="text-orange-600 dark:text-orange-400"
          iconBg="bg-orange-100 dark:bg-orange-950/40"
          description="Mô hình dự đoán đúng chiều tăng/giảm/ổn định — so với hiện tại, ngưỡng tốt nhất (3xe, 5%)"
          badge={
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-200 bg-slate-50 dark:bg-slate-950/30 dark:text-slate-400"
            >
              {periodDays} ngày gần đây
            </Badge>
          }
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cột 1: Tổng quan */}
          <div className="flex flex-col gap-1.5 justify-center">
            <p className="text-[11px] text-muted-foreground">
              TB. 5 mốc
              {trendOverall.from_per_horizon ? (
                <span className="ml-1 text-green-600 dark:text-green-400">
                  (mới nhất)
                </span>
              ) : (
                <span className="ml-1 text-muted-foreground/50">(cũ)</span>
              )}
            </p>
            <div className="text-4xl font-bold tabular-nums">
              {trendOverall.avg_accuracy}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              {trendOverall.total_correct.toLocaleString("vi-VN")} /{" "}
              {trendOverall.total_checks.toLocaleString("vi-VN")} lần đúng
            </p>
            <div className="w-fit">
              <QualityBadge
                value={trendOverall.avg_accuracy}
                thresholds={[80, 65]}
              />
            </div>
          </div>

          {/* Cột 2: Breakdown tổng */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              Phân tách (tổng)
            </p>
            {[
              {
                label: "Đúng tăng",
                value: trendOverall.correct_increasing,
                icon: IconArrowUp,
                color: "green",
              },
              {
                label: "Đúng giảm",
                value: trendOverall.correct_decreasing,
                icon: IconArrowDown,
                color: "red",
              },
              {
                label: "Đúng ổn định",
                value: trendOverall.correct_stable,
                icon: IconMinus,
                color: "slate",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <div
                  className={`size-7 rounded-md bg-${color}-100 dark:bg-${color}-950/40 flex items-center justify-center shrink-0`}
                >
                  <Icon
                    className={`size-3.5 text-${color}-600 dark:text-${color}-400`}
                  />
                </div>
                <span className="flex-1 text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">
                  {value.toLocaleString("vi-VN")}
                </span>
              </div>
            ))}
          </div>

          {/* Cột 3-4: Per-horizon selector + detail */}
          <div className="space-y-3 col-span-1 sm:col-span-2">
            {trendAccuracy.per_horizon &&
            trendAccuracy.per_horizon.length > 0 ? (
              (() => {
                const horizonData =
                  trendAccuracy.per_horizon!.find(
                    (h) => h.horizon_minutes === selectedHorizon,
                  ) ?? trendAccuracy.per_horizon![0];
                return (
                  <>
                    {/* Selector buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground mr-1">
                        Mốc:
                      </span>
                      {trendAccuracy.per_horizon!.map((h) => (
                        <button
                          key={h.horizon_minutes}
                          onClick={() => setSelectedHorizon(h.horizon_minutes)}
                          className={`text-[11px] px-2.5 py-0.5 rounded-md border font-medium transition-colors ${
                            selectedHorizon === h.horizon_minutes
                              ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300"
                              : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {h.horizon_minutes}m
                        </button>
                      ))}
                    </div>

                    {/* Detail cho mốc đang chọn */}
                    <div className="rounded-md border p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">
                          Mốc {horizonData.horizon_minutes} phút
                        </p>
                        <div className="w-fit">
                          <QualityBadge
                            value={horizonData.trend_accuracy}
                            thresholds={[80, 65]}
                          />
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold tabular-nums">
                          {horizonData.trend_accuracy}%
                        </span>
                        <span className="text-[11px] text-muted-foreground pb-1">
                          {horizonData.correct_predictions.toLocaleString(
                            "vi-VN",
                          )}{" "}
                          / {horizonData.total_checks.toLocaleString("vi-VN")}{" "}
                          lần đúng
                        </span>
                      </div>
                      <Progress
                        value={horizonData.trend_accuracy}
                        className="h-1.5"
                      />
                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                        {[
                          {
                            label: "Tăng",
                            value: horizonData.correct_increasing,
                            icon: IconArrowUp,
                            color: "green",
                          },
                          {
                            label: "Giảm",
                            value: horizonData.correct_decreasing,
                            icon: IconArrowDown,
                            color: "red",
                          },
                          {
                            label: "Ổn định",
                            value: horizonData.correct_stable,
                            icon: IconMinus,
                            color: "slate",
                          },
                        ].map(({ label, value, icon: Icon, color }) => (
                          <div
                            key={label}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <Icon
                              className={`size-3.5 text-${color}-600 dark:text-${color}-400`}
                            />
                            <span className="text-xs font-semibold tabular-nums">
                              {value.toLocaleString("vi-VN")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Snapshot cũ — chạy lại model-performance để có dữ liệu
                per-horizon.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
