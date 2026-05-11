/**
 * Stats 4+4 cards — Metrics tổng quan (MAE, MAPE, Accuracy, Trend, etc.)
 */
import { StatCard } from "@/components/custom/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  IconTarget,
  IconBrain,
  IconCircleCheck,
  IconChartLine,
  IconTrendingUp,
  IconDatabase,
  IconShieldCheck,
  IconCamera,
} from "@tabler/icons-react";
import type { ModelMetricsHistoryRow } from "@/services/model-metrics.service";

// ─── Badge helpers ───────────────────────────────────────────────────────────

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

function MaeBadge({ value }: { value: number }) {
  const color = value < 5 ? "green" : value <= 10 ? "yellow" : "red";
  const label = value < 5 ? "Tốt" : value <= 10 ? "Trung bình" : "Kém";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}
    >
      {label}
    </Badge>
  );
}

function MapeBadge({ value }: { value: number }) {
  const color = value < 10 ? "green" : value <= 20 ? "green" : "red";
  const label = value < 10 ? "Xuất sắc" : value <= 20 ? "Tốt" : "Cần cải thiện";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}
    >
      {label}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface OverviewStatsProps {
  metrics: ModelMetricsHistoryRow;
  dataCoverage?: {
    total_predictions: number;
    verified: number;
    pending: number;
    verification_rate: number;
  } | null;
}

export function OverviewStats({ metrics, dataCoverage }: OverviewStatsProps) {
  const overall = metrics.overall;
  const trend = metrics.trend_accuracy;
  if (!overall || !trend) return null;

  // Use data_coverage.verification_rate for consistency with pending count
  const verificationRate =
    dataCoverage?.verification_rate ?? overall.verification_rate;
  const pendingCount = dataCoverage?.pending ?? 0;

  const trendOverall = {
    avg_accuracy: trend.trend_accuracy ?? 0,
    total_correct: trend.correct_predictions ?? 0,
    total_checks: trend.total_checks ?? 0,
  };

  return (
    <>
      {/* Row 1: MAE, MAPE, Acc≤5xe, Acc≤10xe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="MAE (Sai số trung bình)"
          value={`${overall.mae} xe`}
          headerRight={<IconTarget className="size-4 text-blue-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              RMSE: {overall.rmse} xe
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <MaeBadge value={overall.mae} />
            </div>
          }
        />
        <StatCard
          title="MAPE (Sai số %)"
          value={`${overall.mape}%`}
          headerRight={<IconBrain className="size-4 text-purple-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              Bỏ qua thực tế &lt; 5 xe
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <MapeBadge value={overall.mape} />
            </div>
          }
        />
        <StatCard
          title="Accuracy ≤5xe"
          value={`${overall.accuracy_5xe}%`}
          headerRight={<IconCircleCheck className="size-4 text-green-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              Sai số trong phạm vi ±5 xe
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <QualityBadge
                value={overall.accuracy_5xe}
                thresholds={[90, 75]}
              />
            </div>
          }
        />
        <StatCard
          title="Accuracy ≤10xe"
          value={`${overall.accuracy_10xe}%`}
          headerRight={<IconChartLine className="size-4 text-emerald-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              ≤15xe: {overall.accuracy_15xe}%
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <QualityBadge
                value={overall.accuracy_10xe}
                thresholds={[97, 90]}
              />
            </div>
          }
        />
      </div>

      {/* Row 2: Trend, Tổng dự đoán, Tỷ lệ xác minh, Mẫu avg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Độ chính xác xu hướng"
          value={`${trendOverall.avg_accuracy}%`}
          headerRight={<IconTrendingUp className="size-4 text-orange-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              {trendOverall.total_correct.toLocaleString("vi-VN")}/
              {trendOverall.total_checks.toLocaleString("vi-VN")} lần đúng
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <QualityBadge
                value={trendOverall.avg_accuracy}
                thresholds={[80, 65]}
              />
            </div>
          }
        />
        <StatCard
          title="Tổng dự đoán"
          value={overall.total_predictions.toLocaleString("vi-VN")}
          headerRight={<IconDatabase className="size-4 text-slate-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              Đã xác minh:{" "}
              {overall.verified_predictions.toLocaleString("vi-VN")}
            </p>
          }
        />
        <StatCard
          title="Tỷ lệ xác minh"
          value={`${verificationRate}%`}
          headerRight={<IconShieldCheck className="size-4 text-teal-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              Chờ đồng bộ: {pendingCount.toLocaleString("vi-VN")}
            </p>
          }
          sub2={
            <div className="mt-1.5 w-fit">
              <QualityBadge value={verificationRate} thresholds={[95, 80]} />
            </div>
          }
        />
        <StatCard
          title="Mẫu đầu vào (trung bình)"
          value={`${overall.avg_input_samples ?? "—"}`}
          headerRight={<IconCamera className="size-4 text-sky-500" />}
          sub1={
            <p className="text-[11px] text-muted-foreground mt-1">
              Quá khứ: {overall.avg_lag_samples ?? "—"} • Đồng bộ:{" "}
              {overall.avg_sync_samples ?? "—"}
            </p>
          }
        />
      </div>
    </>
  );
}
