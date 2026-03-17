import * as React from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getLatestModelMetrics,
  getModelMetricsHistory,
  type CameraRankingItem,
  type ModelMetricsHistoryRow,
} from "@/services/model-metrics.service";
import { getAllCameras } from "@/services/camera.service";
import {
  IconAlertTriangle, IconArrowDown, IconArrowUp, IconBrain,
  IconCamera, IconChartBar, IconChartLine, IconCircleCheck,
  IconClock, IconDatabase, IconMinus, IconRefresh,
  IconShieldCheck, IconTarget, IconTrendingUp,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { StatCard } from "@/components/custom/stat-card";
import { useLoading } from "@/contexts/LoadingContext";
import { getTimeLabel } from "@/lib/app-constants";
import { clearApiCache } from "@/lib/apiFetch";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Định dạng thời gian sang chuỗi vi-VN
 */
function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN", {
    hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

/** Badge mức độ tin cậy: High / Medium / Low */
function ConfidenceBadge({ level }: { level: string }) {
  if (level === "High")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Cao</Badge>;
  if (level === "Medium")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Trung bình</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Thấp</Badge>;
}

/** Badge chất lượng theo ngưỡng tùy chỉnh */
function QualityBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  if (value >= thresholds[0])
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Tốt</Badge>;
  if (value >= thresholds[1])
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Trung bình</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Cần cải thiện</Badge>;
}

/** Badge MAE: Tốt / Trung bình / Kém */
function MaeBadge({ value }: { value: number }) {
  const color = value < 5 ? "green" : value <= 10 ? "yellow" : "red";
  const label = value < 5 ? "Tốt" : value <= 10 ? "Trung bình" : "Kém";
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}>{label}</Badge>;
}

/** Badge MAPE: Xuất sắc / Tốt / Cần cải thiện */
function MapeBadge({ value }: { value: number }) {
  const color = value < 10 ? "green" : value <= 20 ? "green" : "red";
  const label = value < 10 ? "Xuất sắc" : value <= 20 ? "Tốt" : "Cần cải thiện";
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}>{label}</Badge>;
}

/** Badge khuyến nghị horizon: KEEP / OPTIONAL / DROP */
function RecommendBadge({ value }: { value?: string }) {
  if (value === "KEEP")     return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Giữ lại</Badge>;
  if (value === "OPTIONAL") return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Tùy chọn</Badge>;
  if (value === "DROP")     return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Loại bỏ</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

/** Dòng camera trong bảng ranking */
function CameraRankRow({
  item, rank, cameraNameMap,
}: {
  item: CameraRankingItem;
  rank: number;
  cameraNameMap: Record<string, string>;
}) {
  const displayName = cameraNameMap[item.camera_id] ?? `Camera ...${item.camera_id.slice(-6)}`;
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b last:border-0 hover:bg-accent/40 transition-colors">
      <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">#{rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{displayName}</p>
        <p className="text-[10px] text-muted-foreground">ID: ...{item.camera_id.slice(-6)} • {item.predictions_count.toLocaleString("vi-VN")} dự đoán</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">MAE: {item.avg_error} xe</p>
        <p className="text-[10px] text-muted-foreground">Acc≤5xe: {item.accuracy_5xe}% • Lỗi%: {item.error_percentage}%</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

/** Trang phân tích hiệu suất mô hình dự đoán lưu lượng */
export default function PredictiveAnalytics() {
  const [latestMetrics, setLatestMetrics] = React.useState<ModelMetricsHistoryRow | null>(null);
  const [historyMetrics, setHistoryMetrics] = React.useState<ModelMetricsHistoryRow[]>([]);
  const [cameraNameMap, setCameraNameMap] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [selectedTrendHorizon, setSelectedTrendHorizon] = React.useState<number>(5);
  const location = useLocation();
  const { startLoading, stopLoading } = useLoading();

  // Scroll tới anchor khi data đã tải xong
  React.useEffect(() => {
    if (!isLoading && location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isLoading, location.hash]);

  React.useEffect(() => {
    let isMounted = true;

    /**
     * Tải dữ liệu metrics mới nhất và lịch sử cho trang analytics
     */
    async function loadAnalyticsData() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        startLoading();

        const [latest, history, cameras] = await Promise.all([
          getLatestModelMetrics(),
          getModelMetricsHistory(20),
          getAllCameras(),
        ]);

        if (!isMounted) return;
        setLatestMetrics(latest);
        setHistoryMetrics(history);

        if (Array.isArray(cameras)) {
          const nextMap = cameras.reduce<Record<string, string>>((acc, camera) => {
            acc[camera.cam_id] = camera.display_name;
            return acc;
          }, {});
          setCameraNameMap(nextMap);
        }
      } catch {
        if (isMounted) setErrorMessage("Không thể tải dữ liệu phân tích từ máy chủ");
      } finally {
        stopLoading();
        if (isMounted) setIsLoading(false);
      }
    }

    loadAnalyticsData();
    return () => { isMounted = false; };
  }, [startLoading, stopLoading, refreshKey]);

  const overall       = latestMetrics?.overall;
  const trend         = latestMetrics?.trend_accuracy;
  const dataCoverage  = latestMetrics?.data_coverage;
  const dist          = latestMetrics?.confidence_distribution;
  const latestGeneratedAt = latestMetrics ? fmtDate(latestMetrics.generated_at) : "-";

  /** Trung bình đơn giản qua 5 mốc, tính từ per_horizon nếu có */
  const trendOverall = React.useMemo(() => {
    const ph = trend?.per_horizon;
    if (!ph || ph.length === 0) {
      return {
        avg_accuracy: trend?.trend_accuracy ?? 0,
        total_correct: trend?.correct_predictions ?? 0,
        total_checks: trend?.total_checks ?? 0,
        correct_increasing: trend?.correct_increasing ?? 0,
        correct_decreasing: trend?.correct_decreasing ?? 0,
        correct_stable: trend?.correct_stable ?? 0,
        from_per_horizon: false,
      };
    }
    return {
      avg_accuracy: Math.round(ph.reduce((s, h) => s + h.trend_accuracy, 0) / ph.length * 10) / 10,
      total_correct: ph.reduce((s, h) => s + h.correct_predictions, 0),
      total_checks:  ph.reduce((s, h) => s + h.total_checks, 0),
      correct_increasing: ph.reduce((s, h) => s + h.correct_increasing, 0),
      correct_decreasing: ph.reduce((s, h) => s + h.correct_decreasing, 0),
      correct_stable:     ph.reduce((s, h) => s + h.correct_stable, 0),
      from_per_horizon: true,
    };
  }, [trend]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconChartBar className="w-5 h-5" />}
        title="Phân tích Hiệu suất Dự đoán"
        description="Đánh giá độ chính xác mô hình theo mốc thời gian, camera và xu hướng lưu lượng"
      >
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">
          <IconClock className="size-3 mr-1" />
          {latestGeneratedAt}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearApiCache(/\/api\/model-metrics|\/api\/cameras/);
            setRefreshKey(k => k + 1);
          }}
          disabled={isLoading}
          className="gap-1.5"
        >
          <IconRefresh className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </PageHeader>

      {!isLoading && errorMessage && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !errorMessage && !latestMetrics && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu metrics. Hãy chạy model-performance để tạo snapshot lịch sử.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !errorMessage && latestMetrics && overall && trend && (
        <>
          {/* ═══════════════════════════════════════════════════════
              SECTION 1 — Stats 4+4
          ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="MAE (Sai số trung bình)"
              value={`${overall.mae} xe`}
              headerRight={<IconTarget className="size-4 text-blue-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">RMSE: {overall.rmse} xe</p>}
              sub2={<div className="mt-1.5 w-fit"><MaeBadge value={overall.mae} /></div>}
            />
            <StatCard
              title="MAPE (Sai số %)"
              value={`${overall.mape}%`}
              headerRight={<IconBrain className="size-4 text-purple-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">Bỏ qua actual &lt; 5 xe</p>}
              sub2={<div className="mt-1.5 w-fit"><MapeBadge value={overall.mape} /></div>}
            />
            <StatCard
              title="Accuracy ≤5xe"
              value={`${overall.accuracy_5xe}%`}
              headerRight={<IconCircleCheck className="size-4 text-green-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">Sai số trong phạm vi ±5 xe</p>}
              sub2={<div className="mt-1.5 w-fit"><QualityBadge value={overall.accuracy_5xe} thresholds={[90, 75]} /></div>}
            />
            <StatCard
              title="Accuracy ≤10xe"
              value={`${overall.accuracy_10xe}%`}
              headerRight={<IconChartLine className="size-4 text-emerald-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">≤15xe: {overall.accuracy_15xe}%</p>}
              sub2={<div className="mt-1.5 w-fit"><QualityBadge value={overall.accuracy_10xe} thresholds={[97, 90]} /></div>}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Độ chính xác xu hướng"
              value={`${trendOverall.avg_accuracy}%`}
              headerRight={<IconTrendingUp className="size-4 text-orange-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">{trendOverall.total_correct.toLocaleString("vi-VN")}/{trendOverall.total_checks.toLocaleString("vi-VN")} lần đúng</p>}
              sub2={<div className="mt-1.5 w-fit"><QualityBadge value={trendOverall.avg_accuracy} thresholds={[80, 65]} /></div>}
            />
            <StatCard
              title="Tổng dự đoán"
              value={overall.total_predictions.toLocaleString("vi-VN")}
              headerRight={<IconDatabase className="size-4 text-slate-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">Đã xác minh: {overall.verified_predictions.toLocaleString("vi-VN")}</p>}
            />
            <StatCard
              title="Tỷ lệ xác minh"
              value={`${overall.verification_rate}%`}
              headerRight={<IconShieldCheck className="size-4 text-teal-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">Chờ sync: {(dataCoverage?.pending ?? 0).toLocaleString("vi-VN")}</p>}
              sub2={<div className="mt-1.5 w-fit"><QualityBadge value={overall.verification_rate} thresholds={[95, 80]} /></div>}
            />
            <StatCard
              title="Mẫu đầu vào (avg)"
              value={`${overall.avg_input_samples ?? "—"}`}
              headerRight={<IconCamera className="size-4 text-sky-500" />}
              sub1={<p className="text-[11px] text-muted-foreground mt-1">LAG: {overall.avg_lag_samples ?? "—"} • Sync: {overall.avg_sync_samples ?? "—"}</p>}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 2 — Data Coverage
          ═══════════════════════════════════════════════════════ */}
          {dataCoverage && (
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardSectionHeader
                  icon={IconDatabase}
                  title="Mức bao phủ dữ liệu"
                  iconColor="text-blue-600 dark:text-blue-400"
                  iconBg="bg-blue-100 dark:bg-blue-950/40"
                  description="Trạng thái đồng bộ actual_value trong kỳ phân tích"
                />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div><p className="text-[11px] text-muted-foreground">Tổng dự đoán</p><p className="text-xl font-bold tabular-nums">{dataCoverage.total_predictions.toLocaleString("vi-VN")}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Đã xác minh</p><p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{dataCoverage.verified.toLocaleString("vi-VN")}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Chờ đồng bộ</p><p className="text-xl font-bold tabular-nums text-yellow-600 dark:text-yellow-400">{dataCoverage.pending.toLocaleString("vi-VN")}</p></div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tỷ lệ xác minh ({dataCoverage.verification_rate}%)</span>
                    <span className="font-medium tabular-nums">{dataCoverage.verified.toLocaleString("vi-VN")} / {dataCoverage.total_predictions.toLocaleString("vi-VN")}</span>
                  </div>
                  <Progress value={dataCoverage.verification_rate} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════
              SECTION 3 — Confidence (2-col)
          ═══════════════════════════════════════════════════════ */}
          {overall.prediction_confidence && overall.error_confidence && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardSectionHeader
                    icon={IconTrendingUp}
                    title="Độ tin cậy dự đoán"
                    iconColor="text-purple-600 dark:text-purple-400"
                    iconBg="bg-purple-100 dark:bg-purple-950/40"
                    description="Input samples vs LAG samples"
                    badge={<ConfidenceBadge level={overall.prediction_confidence.level} />}
                  />
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Điểm tin cậy</span>
                    <span className="text-2xl font-bold tabular-nums">{(overall.prediction_confidence.score * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={overall.prediction_confidence.score * 100} className="h-2" />
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold tabular-nums">{overall.prediction_confidence.avg_input_samples}</p>
                      <p className="text-[10px] text-muted-foreground">avg Input</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums">{overall.prediction_confidence.avg_lag_samples}</p>
                      <p className="text-[10px] text-muted-foreground">avg LAG</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">{overall.prediction_confidence.low_sample_count.toLocaleString("vi-VN")}</p>
                      <p className="text-[10px] text-muted-foreground">Chất lượng thấp</p>
                    </div>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/30 text-[10px] text-muted-foreground">
                    Ngưỡng: cả hai ≥30 và chênh lệch &lt;20% → <span className="text-green-600 dark:text-green-400 font-medium">Cao</span> · &lt;40% hoặc &lt;30 mẫu → <span className="text-yellow-600 dark:text-yellow-400 font-medium">Trung bình</span> (điểm bị giảm do thiếu mẫu)
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardSectionHeader
                    icon={IconAlertTriangle}
                    title="Độ tin cậy sai số"
                    iconColor="text-orange-600 dark:text-orange-400"
                    iconBg="bg-orange-100 dark:bg-orange-950/40"
                    description="Input samples vs Sync samples"
                    badge={<ConfidenceBadge level={overall.error_confidence.level} />}
                  />
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Điểm tin cậy</span>
                    <span className="text-2xl font-bold tabular-nums">{(overall.error_confidence.score * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={overall.error_confidence.score * 100} className="h-2" />
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold tabular-nums">{overall.error_confidence.avg_sync_samples}</p>
                      <p className="text-[10px] text-muted-foreground">avg Sync samples</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">{overall.error_confidence.mismatched_count.toLocaleString("vi-VN")}</p>
                      <p className="text-[10px] text-muted-foreground">Không khớp (&gt;5 mẫu)</p>
                    </div>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/30 text-[10px] text-muted-foreground">
                    Ngưỡng: |diff| ≤5 và ≥30 → <span className="text-green-600 font-medium">Cao</span> (0.95) · |diff| ≤5 &lt;30 → <span className="text-yellow-600 font-medium">Trung bình</span> (0.75) · |diff| &gt;5 → <span className="text-red-600 font-medium">Thấp</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              SECTION 4 — Trend Accuracy (5p)
          ═══════════════════════════════════════════════════════ */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardSectionHeader
                icon={IconTrendingUp}
                title="Độ chính xác xu hướng"
                iconColor="text-orange-600 dark:text-orange-400"
                iconBg="bg-orange-100 dark:bg-orange-950/40"
                description="Mô hình dự đoán đúng chiều tăng/giảm/ổn định — so với baseline input_value, ngưỡng GREATEST(3xe, 5%)"
                badge={
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-200 bg-slate-50 dark:bg-slate-950/30 dark:text-slate-400">
                    {latestMetrics.period_days} ngày gần đây
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
                    {trendOverall.from_per_horizon
                      ? <span className="ml-1 text-green-600 dark:text-green-400">(live)</span>
                      : <span className="ml-1 text-muted-foreground/50">(snapshot cũ)</span>}
                  </p>
                  <div className="text-4xl font-bold tabular-nums">{trendOverall.avg_accuracy}%</div>
                  <p className="text-[11px] text-muted-foreground">{trendOverall.total_correct.toLocaleString("vi-VN")} / {trendOverall.total_checks.toLocaleString("vi-VN")} lần đúng</p>
                  <div className="w-fit"><QualityBadge value={trendOverall.avg_accuracy} thresholds={[80, 65]} /></div>
                </div>

                {/* Cột 2: Breakdown tổng */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Phân tách (tổng)</p>
                  {[
                    { label: "Đúng tăng",    value: trendOverall.correct_increasing, icon: IconArrowUp,   color: "green" },
                    { label: "Đúng giảm",    value: trendOverall.correct_decreasing, icon: IconArrowDown, color: "red"   },
                    { label: "Đúng ổn định", value: trendOverall.correct_stable,     icon: IconMinus,     color: "slate" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <div className={`size-7 rounded-md bg-${color}-100 dark:bg-${color}-950/40 flex items-center justify-center shrink-0`}>
                        <Icon className={`size-3.5 text-${color}-600 dark:text-${color}-400`} />
                      </div>
                      <span className="flex-1 text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">{value.toLocaleString("vi-VN")}</span>
                    </div>
                  ))}
                </div>

                {/* Cột 3-4: Per-horizon selector + detail */}
                <div className="space-y-3 col-span-1 sm:col-span-2">
                  {trend.per_horizon && trend.per_horizon.length > 0 ? (() => {
                    const horizonData = trend.per_horizon!.find(h => h.horizon_minutes === selectedTrendHorizon)
                      ?? trend.per_horizon![0];
                    return (
                      <>
                        {/* Selector buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground mr-1">Mốc:</span>
                          {trend.per_horizon!.map((h) => (
                            <button
                              key={h.horizon_minutes}
                              onClick={() => setSelectedTrendHorizon(h.horizon_minutes)}
                              className={`text-[11px] px-2.5 py-0.5 rounded-md border font-medium transition-colors ${
                                selectedTrendHorizon === h.horizon_minutes
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
                            <p className="text-[11px] text-muted-foreground">Mốc {horizonData.horizon_minutes} phút</p>
                            <div className="w-fit"><QualityBadge value={horizonData.trend_accuracy} thresholds={[80, 65]} /></div>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold tabular-nums">{horizonData.trend_accuracy}%</span>
                            <span className="text-[11px] text-muted-foreground pb-1">{horizonData.correct_predictions.toLocaleString("vi-VN")} / {horizonData.total_checks.toLocaleString("vi-VN")} lần đúng</span>
                          </div>
                          <Progress value={horizonData.trend_accuracy} className="h-1.5" />
                          <div className="grid grid-cols-3 gap-2 pt-0.5">
                            {[
                              { label: "Tăng",    value: horizonData.correct_increasing, icon: IconArrowUp,   color: "green" },
                              { label: "Giảm",    value: horizonData.correct_decreasing, icon: IconArrowDown, color: "red"   },
                              { label: "Ổn định", value: horizonData.correct_stable,     icon: IconMinus,     color: "slate" },
                            ].map(({ label, value, icon: Icon, color }) => (
                              <div key={label} className="flex flex-col items-center gap-0.5">
                                <Icon className={`size-3.5 text-${color}-600 dark:text-${color}-400`} />
                                <span className="text-xs font-semibold tabular-nums">{value.toLocaleString("vi-VN")}</span>
                                <span className="text-[10px] text-muted-foreground">{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <p className="text-[11px] text-muted-foreground">Snapshot cũ — chạy lại model-performance để có dữ liệu per-horizon.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════
              SECTION 5 — Horizon Table
          ═══════════════════════════════════════════════════════ */}
          <Card id="horizon-comparison">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardSectionHeader
                icon={IconChartBar}
                title="Hiệu suất theo mốc thời gian"
                iconColor="text-blue-600 dark:text-blue-400"
                iconBg="bg-blue-100 dark:bg-blue-950/40"
                description="5 horizon: 5m / 10m / 15m / 30m / 60m — bao gồm confidence và khuyến nghị"
              />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Mốc</TableHead>
                    <TableHead className="text-xs text-right">Dự đoán</TableHead>
                    <TableHead className="text-xs text-right">MAE</TableHead>
                    <TableHead className="text-xs text-right">Median</TableHead>
                    <TableHead className="text-xs text-right">P95</TableHead>
                    <TableHead className="text-xs text-right">Acc≤5xe</TableHead>
                    <TableHead className="text-xs text-right">Acc≤10xe</TableHead>
                    <TableHead className="text-xs">Tin cậy dự đoán</TableHead>
                    <TableHead className="text-xs">Tin cậy sai số</TableHead>
                    <TableHead className="text-xs">Khuyến nghị</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestMetrics.by_horizon.map((row) => (
                    <TableRow key={row.horizon_minutes}>
                      <TableCell className="font-medium text-xs">{getTimeLabel(`${row.horizon_minutes}m`)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.total_predictions.toLocaleString("vi-VN")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">{row.avg_error} xe</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.median_error} xe</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.p95_error} xe</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">{row.accuracy_5xe}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.accuracy_10xe}%</TableCell>
                      <TableCell>
                        {row.prediction_confidence ? (
                          <div className="flex items-center gap-1.5">
                            <ConfidenceBadge level={row.prediction_confidence.level} />
                            <span className="text-[10px] text-muted-foreground tabular-nums">{(row.prediction_confidence.score * 100).toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.error_confidence ? (
                          <div className="flex items-center gap-1.5">
                            <ConfidenceBadge level={row.error_confidence.level} />
                            <span className="text-[10px] text-muted-foreground tabular-nums">{(row.error_confidence.score * 100).toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><RecommendBadge value={row.recommendation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════
              SECTION 6 — Camera Ranking (2-col)
          ═══════════════════════════════════════════════════════ */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardSectionHeader
                  icon={IconCamera}
                  title="Top camera chính xác nhất"
                  iconColor="text-green-600 dark:text-green-400"
                  iconBg="bg-green-100 dark:bg-green-950/40"
                  description="MAE thấp nhất — ≥50 dự đoán"
                />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {latestMetrics.camera_ranking.best.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 pb-4">Chưa có dữ liệu</p>
                ) : (
                  latestMetrics.camera_ranking.best.map((item, i) => (
                    <CameraRankRow key={item.camera_id} item={item} rank={i + 1} cameraNameMap={cameraNameMap} />
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardSectionHeader
                  icon={IconCamera}
                  title="Camera cần cải thiện nhất"
                  iconColor="text-red-600 dark:text-red-400"
                  iconBg="bg-red-100 dark:bg-red-950/40"
                  description="MAE cao nhất — ≥50 dự đoán"
                />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {latestMetrics.camera_ranking.worst.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 pb-4">Chưa có dữ liệu</p>
                ) : (
                  latestMetrics.camera_ranking.worst.map((item, i) => (
                    <CameraRankRow key={item.camera_id} item={item} rank={i + 1} cameraNameMap={cameraNameMap} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 7 — Confidence Distribution
          ═══════════════════════════════════════════════════════ */}
          {dist && (
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardSectionHeader
                  icon={IconShieldCheck}
                  title="Phân phối chất lượng dữ liệu"
                  iconColor="text-teal-600 dark:text-teal-400"
                  iconBg="bg-teal-100 dark:bg-teal-950/40"
                  description="Tỷ lệ dự đoán high/low quality và mức độ nhất quán sync"
                />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-xs font-medium">Chất lượng dự đoán (input + lag ≥ 30)</p>
                    {[
                      { label: `Chất lượng cao — ${dist.high_quality_predictions.toLocaleString("vi-VN")}`, value: dist.high_quality_percent },
                      { label: `Chất lượng thấp — ${dist.low_quality_predictions.toLocaleString("vi-VN")}`, value: dist.low_quality_percent },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium tabular-nums">{value}%</span>
                        </div>
                        <Progress value={value} className="h-1.5" />
                      </div>
                    ))}
                    <div className="rounded-md border p-2.5 grid grid-cols-3 text-center gap-2">
                      <div><p className="text-xs font-semibold">{dist.avg_input_samples}</p><p className="text-[10px] text-muted-foreground">avg Input</p></div>
                      <div><p className="text-xs font-semibold">{dist.avg_lag_samples}</p><p className="text-[10px] text-muted-foreground">avg LAG</p></div>
                      <div><p className="text-xs font-semibold">{dist.avg_sync_samples}</p><p className="text-[10px] text-muted-foreground">avg Sync</p></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium">Nhất quán sync (|input − sync| ≤ 5)</p>
                    {[
                      { label: `Nhất quán — ${dist.consistent_syncs.toLocaleString("vi-VN")}`, value: dist.consistent_sync_percent },
                      { label: `Không khớp — ${dist.inconsistent_syncs.toLocaleString("vi-VN")}`, value: dist.inconsistent_sync_percent },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium tabular-nums">{value}%</span>
                        </div>
                        <Progress value={value} className="h-1.5" />
                      </div>
                    ))}
                    <div className="rounded-md border p-2.5 grid grid-cols-2 text-center gap-2">
                      <div><p className="text-xs font-semibold">{dist.total_records.toLocaleString("vi-VN")}</p><p className="text-[10px] text-muted-foreground">Tổng records</p></div>
                      <div><p className="text-xs font-semibold">{dist.verified_records.toLocaleString("vi-VN")}</p><p className="text-[10px] text-muted-foreground">Đã verified</p></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════
              SECTION 8 — History Table
          ═══════════════════════════════════════════════════════ */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardSectionHeader
                icon={IconClock}
                title="Lịch sử snapshot"
                iconColor="text-slate-600 dark:text-slate-400"
                iconBg="bg-slate-100 dark:bg-slate-950/40"
                description="Snapshot gần nhất — mỗi lần chạy model-performance tạo 1 snapshot"
                badge={<Badge variant="outline" className="text-[10px] px-1.5 py-0">{historyMetrics.length} bản ghi</Badge>}
              />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Thời điểm</TableHead>
                    <TableHead className="text-xs text-right">MAE</TableHead>
                    <TableHead className="text-xs text-right">RMSE</TableHead>
                    <TableHead className="text-xs text-right">MAPE</TableHead>
                    <TableHead className="text-xs text-right">Acc≤5xe</TableHead>
                    <TableHead className="text-xs text-right">Xu hướng</TableHead>
                    <TableHead className="text-xs text-right">Dự đoán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMetrics.slice(0, 10).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{fmtDate(row.generated_at)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.overall?.mae ?? 0} xe</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.overall?.rmse ?? 0} xe</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.overall?.mape ?? 0}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">{row.overall?.accuracy_5xe ?? 0}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.trend_accuracy?.trend_accuracy ?? 0}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{(row.overall?.total_predictions ?? 0).toLocaleString("vi-VN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
