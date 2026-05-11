/**
 * Playground: Thiết kế lại trang Analytics — hiển thị đầy đủ dữ liệu model-performance
 * Dùng mock data từ API response thực tế (snapshot ngày 16/03/2026)
 */
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  IconArrowDown, IconArrowUp, IconBrain, IconCamera,
  IconChartBar, IconChartLine, IconClock, IconDatabase,
  IconMinus, IconRefresh, IconShieldCheck, IconTrendingUp,
  IconTarget, IconAlertTriangle, IconCircleCheck,
} from "@tabler/icons-react"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { StatCard } from "@/components/custom/stat-card"

// ─── Mock data từ API response thực (16/03/2026) ────────────────────────────

const MOCK_METRICS = {
  id: "303",
  generated_at: "2026-03-16T07:00:20.798Z",
  period_days: 7,
  overall: {
    mae: 2.07, rmse: 3.05, mape: 12.71,
    accuracy_5xe: 91.9, accuracy_10xe: 98.7, accuracy_15xe: 99.7,
    total_predictions: 110099, verified_predictions: 110099, verification_rate: 100,
    avg_input_samples: 25.4, avg_lag_samples: 25.6, avg_sync_samples: 25.1,
    low_sample_forecasts: 6768, mismatched_syncs: 12468,
    prediction_confidence: { score: 0.8, level: "Medium", avg_input_samples: 25.4, avg_lag_samples: 25.6, low_sample_count: 6768 },
    error_confidence:      { score: 0.75, level: "Medium", avg_sync_samples: 25.1, mismatched_count: 12468 },
  },
  by_horizon: [
    { horizon_minutes: 5,  total_predictions: 22187, avg_error: 1.6,  median_error: 1.18, p95_error: 4.52,  accuracy_5xe: 96.3, accuracy_10xe: 99.8, recommendation: "KEEP",     prediction_confidence: { score: 0.80, level: "Medium" }, error_confidence: { score: 0.75, level: "Medium" } },
    { horizon_minutes: 10, total_predictions: 22134, avg_error: 1.8,  median_error: 1.30, p95_error: 5.17,  accuracy_5xe: 94.5, accuracy_10xe: 99.4, recommendation: "KEEP",     prediction_confidence: { score: 1,    level: "Medium" }, error_confidence: { score: 0.75, level: "Medium" } },
    { horizon_minutes: 15, total_predictions: 22091, avg_error: 1.99, median_error: 1.39, p95_error: 5.99,  accuracy_5xe: 92.3, accuracy_10xe: 99.1, recommendation: "KEEP",     prediction_confidence: { score: 1,    level: "Medium" }, error_confidence: { score: 0.75, level: "Medium" } },
    { horizon_minutes: 30, total_predictions: 21933, avg_error: 2.29, median_error: 1.59, p95_error: 7.00,  accuracy_5xe: 89.9, accuracy_10xe: 98.3, recommendation: "KEEP",     prediction_confidence: { score: 1,    level: "Medium" }, error_confidence: { score: 0.75, level: "Medium" } },
    { horizon_minutes: 60, total_predictions: 21754, avg_error: 2.67, median_error: 1.80, p95_error: 8.18,  accuracy_5xe: 86.5, accuracy_10xe: 97.1, recommendation: "KEEP",     prediction_confidence: { score: 1,    level: "Medium" }, error_confidence: { score: 0.75, level: "Medium" } },
  ],
  camera_ranking: {
    best: [
      { camera_id: "662b7f9f1afb9c00172dca50", predictions_count: 5488, avg_error: 1.32, median_error: 1.00, accuracy_5xe: 98.6, error_percentage: 10.3 },
      { camera_id: "662b86c41afb9c00172dd31c", predictions_count: 5034, avg_error: 1.35, median_error: 1.01, accuracy_5xe: 97.8, error_percentage: 10.9 },
      { camera_id: "5a6065c58576340017d06615", predictions_count: 5200, avg_error: 1.39, median_error: 0.97, accuracy_5xe: 97.3, error_percentage: 14.8 },
      { camera_id: "5d8cd653766c88001718894c", predictions_count: 5619, avg_error: 1.51, median_error: 1.11, accuracy_5xe: 96.4, error_percentage: 10.5 },
      { camera_id: "5d9ddf0f766c880017188c9e", predictions_count: 5485, avg_error: 1.63, median_error: 1.08, accuracy_5xe: 94.7, error_percentage: 13.6 },
    ],
    worst: [
      { camera_id: "5a8256315058170011f6eac9", predictions_count: 5817, avg_error: 3.10, median_error: 2.34, accuracy_5xe: 82.1, error_percentage: 10.2 },
      { camera_id: "649da77ea6068200171a6dd4", predictions_count: 5634, avg_error: 2.82, median_error: 2.03, accuracy_5xe: 84.7, error_percentage: 12.0 },
      { camera_id: "5d9ddec9766c880017188c9c", predictions_count: 5757, avg_error: 2.76, median_error: 2.01, accuracy_5xe: 85.8, error_percentage: 10.6 },
      { camera_id: "662b7ce71afb9c00172dc676", predictions_count: 5750, avg_error: 2.75, median_error: 2.01, accuracy_5xe: 85.6, error_percentage: 11.8 },
      { camera_id: "5d9dde1f766c880017188c98", predictions_count: 5735, avg_error: 2.48, median_error: 1.84, accuracy_5xe: 88.1, error_percentage: 10.8 },
    ],
  },
  data_coverage: {
    total_predictions: 112635, verified: 110099, pending: 2536, verification_rate: 97.7, minutes_since_update: 10.3,
  },
  trend_accuracy: {
    trend_accuracy: 63.4, total_checks: 22167, correct_predictions: 14064,
    correct_increasing: 7194, correct_decreasing: 6870, correct_stable: 0,
    incomplete_groups: 1245, horizon_coverage_pct: 94.5, method: "gti_normalized",
  },
  confidence_distribution: {
    total_records: 112635, verified_records: 110099,
    avg_input_samples: 25.4, avg_lag_samples: 25.6, avg_sync_samples: 25.1,
    high_quality_predictions: 52800, low_quality_predictions: 6768,
    high_quality_percent: 46.9, low_quality_percent: 6.0,
    consistent_syncs: 97631, inconsistent_syncs: 12468,
    consistent_sync_percent: 88.7, inconsistent_sync_percent: 11.3,
  },
  history: [
    { id: 303, generated_at: "2026-03-16T07:00:20Z", overall: { mae: 2.07, rmse: 3.05, mape: 12.71, accuracy_5xe: 91.9, total_predictions: 110099 }, trend_accuracy: { trend_accuracy: 63.4 } },
    { id: 302, generated_at: "2026-03-15T07:00:18Z", overall: { mae: 2.14, rmse: 3.12, mape: 13.10, accuracy_5xe: 91.2, total_predictions: 108431 }, trend_accuracy: { trend_accuracy: 61.8 } },
    { id: 301, generated_at: "2026-03-14T07:00:22Z", overall: { mae: 2.21, rmse: 3.19, mape: 13.54, accuracy_5xe: 90.7, total_predictions: 107654 }, trend_accuracy: { trend_accuracy: 60.5 } },
    { id: 300, generated_at: "2026-03-13T07:00:15Z", overall: { mae: 2.19, rmse: 3.24, mape: 13.08, accuracy_5xe: 90.9, total_predictions: 109021 }, trend_accuracy: { trend_accuracy: 62.1 } },
    { id: 299, generated_at: "2026-03-12T07:00:19Z", overall: { mae: 2.30, rmse: 3.35, mape: 14.20, accuracy_5xe: 89.8, total_predictions: 105832 }, trend_accuracy: { trend_accuracy: 59.7 } },
  ],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN", {
    hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}

function getTimeLabel(key: string) {
  const map: Record<string, string> = { "5m": "5 phút", "10m": "10 phút", "15m": "15 phút", "30m": "30 phút", "60m": "60 phút" }
  return map[key] ?? key
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  if (level === "High")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Cao</Badge>
  if (level === "Medium")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Trung bình</Badge>
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Thấp</Badge>
}

function QualityBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  if (value >= thresholds[0])
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Tốt</Badge>
  if (value >= thresholds[1])
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Trung bình</Badge>
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Cần cải thiện</Badge>
}

function MaeBadge({ value }: { value: number }) {
  const color = value < 5 ? "green" : value <= 10 ? "yellow" : "red"
  const label = value < 5 ? "Tốt" : value <= 10 ? "Trung bình" : "Kém"
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}>{label}</Badge>
}

function MapeBadge({ value }: { value: number }) {
  const color = value < 10 ? "green" : value <= 20 ? "yellow" : "red"
  const label = value < 10 ? "Xuất sắc" : value <= 20 ? "Tốt" : "Cần cải thiện"
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-${color}-700 border-${color}-200 bg-${color}-50 dark:bg-${color}-950/30 dark:text-${color}-400`}>{label}</Badge>
}

function RecommendBadge({ value }: { value?: string }) {
  if (value === "KEEP")     return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Giữ lại</Badge>
  if (value === "OPTIONAL") return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">Tùy chọn</Badge>
  if (value === "DROP")     return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">Loại bỏ</Badge>
  return <span className="text-xs text-muted-foreground">—</span>
}

// ─── Camera rank row ─────────────────────────────────────────────────────────

function CameraRankRow({ item, rank }: { item: typeof MOCK_METRICS.camera_ranking.best[0]; rank: number }) {
  const shortId = item.camera_id.slice(-6)
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b last:border-0 hover:bg-accent/40 transition-colors">
      <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">#{rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">Camera ...{shortId}</p>
        <p className="text-[10px] text-muted-foreground">ID: ...{shortId} • {item.predictions_count.toLocaleString("vi-VN")} dự đoán</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">MAE: {item.avg_error} xe</p>
        <p className="text-[10px] text-muted-foreground">Acc≤5xe: {item.accuracy_5xe}% • Lỗi%: {item.error_percentage}%</p>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

/** Playground: Thiết kế lại Analytics với đầy đủ trường từ model-performance service */
export function PgAnalyticsNew() {
  const { overall, by_horizon, camera_ranking, data_coverage, trend_accuracy: trend, confidence_distribution: dist } = MOCK_METRICS

  return (
    <div className="space-y-4">

      {/* ── Fake header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconChartBar className="size-4 text-primary" />
          <span className="text-sm font-semibold">Phân tích hiệu suất dự đoán</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">
            <IconClock className="size-3 mr-1" />
            {fmtDate(MOCK_METRICS.generated_at)}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-200 bg-slate-50 dark:bg-slate-950/30 dark:text-slate-400">
            <IconDatabase className="size-3 mr-1" />
            {data_coverage.minutes_since_update}ph trước
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconRefresh className="size-3.5" />
          Làm mới
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — Stats 4+4
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="MAE (Sai số trung bình)"
          value={`${overall.mae} xe`}
          headerRight={<IconTarget className="size-4 text-blue-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">RMSE: {overall.rmse} xe</p>}
          sub2={<div className="mt-1.5"><MaeBadge value={overall.mae} /></div>}
        />
        <StatCard
          title="MAPE (Sai số %)"
          value={`${overall.mape}%`}
          headerRight={<IconBrain className="size-4 text-purple-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">Bỏ qua actual &lt; 5 xe</p>}
          sub2={<div className="mt-1.5"><MapeBadge value={overall.mape} /></div>}
        />
        <StatCard
          title="Accuracy ≤5xe"
          value={`${overall.accuracy_5xe}%`}
          headerRight={<IconCircleCheck className="size-4 text-green-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">Sai số trong phạm vi ±5 xe</p>}
          sub2={<div className="mt-1.5"><QualityBadge value={overall.accuracy_5xe} thresholds={[90, 75]} /></div>}
        />
        <StatCard
          title="Accuracy ≤10xe"
          value={`${overall.accuracy_10xe}%`}
          headerRight={<IconChartLine className="size-4 text-emerald-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">≤15xe: {overall.accuracy_15xe}%</p>}
          sub2={<div className="mt-1.5"><QualityBadge value={overall.accuracy_10xe} thresholds={[97, 90]} /></div>}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Xu hướng GTI"
          value={`${trend.trend_accuracy}%`}
          headerRight={<IconTrendingUp className="size-4 text-orange-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">{trend.correct_predictions.toLocaleString("vi-VN")}/{trend.total_checks.toLocaleString("vi-VN")} lần đúng</p>}
          sub2={<div className="mt-1.5"><QualityBadge value={trend.trend_accuracy} thresholds={[80, 65]} /></div>}
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
          sub1={<p className="text-[11px] text-muted-foreground mt-1">Chờ sync: {data_coverage.pending.toLocaleString("vi-VN")}</p>}
          sub2={<div className="mt-1.5"><QualityBadge value={overall.verification_rate} thresholds={[95, 80]} /></div>}
        />
        <StatCard
          title="Mẫu đầu vào (avg)"
          value={`${overall.avg_input_samples}`}
          headerRight={<IconCamera className="size-4 text-sky-500" />}
          sub1={<p className="text-[11px] text-muted-foreground mt-1">LAG: {overall.avg_lag_samples} • Sync: {overall.avg_sync_samples}</p>}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — Data Coverage
      ═══════════════════════════════════════════════════════ */}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
            <div><p className="text-[11px] text-muted-foreground">Tổng dự đoán</p><p className="text-xl font-bold tabular-nums">{data_coverage.total_predictions.toLocaleString("vi-VN")}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Đã xác minh</p><p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{data_coverage.verified.toLocaleString("vi-VN")}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Chờ đồng bộ</p><p className="text-xl font-bold tabular-nums text-yellow-600 dark:text-yellow-400">{data_coverage.pending.toLocaleString("vi-VN")}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Sync cuối</p><p className="text-xl font-bold tabular-nums">{data_coverage.minutes_since_update}ph trước</p></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Tỷ lệ xác minh ({data_coverage.verification_rate}%)</span>
              <span className="font-medium tabular-nums">{data_coverage.verified.toLocaleString("vi-VN")} / {data_coverage.total_predictions.toLocaleString("vi-VN")}</span>
            </div>
            <Progress value={data_coverage.verification_rate} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — Confidence (2-col)
      ═══════════════════════════════════════════════════════ */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Prediction Confidence */}
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
              Ngưỡng: cả hai ≥30 và chênh lệch &lt;20% → <span className="text-green-600 dark:text-green-400 font-medium">Cao</span> · &lt;40% → <span className="text-yellow-600 dark:text-yellow-400 font-medium">Trung bình</span>
            </div>
          </CardContent>
        </Card>

        {/* Error Confidence */}
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

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — GTI Trend Accuracy
      ═══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardSectionHeader
            icon={IconTrendingUp}
            title="Độ chính xác xu hướng (GTI-based)"
            iconColor="text-orange-600 dark:text-orange-400"
            iconBg="bg-orange-100 dark:bg-orange-950/40"
            description="GTI = tổng có trọng số 5 horizon / max_capacity × 100%. So sánh với current_ratio, ngưỡng ±5%"
            badge={
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">
                {trend.method}
              </Badge>
            }
          />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Big number */}
            <div className="flex flex-col gap-1.5 justify-center">
              <p className="text-[11px] text-muted-foreground">Độ chính xác xu hướng</p>
              <div className="text-4xl font-bold tabular-nums">{trend.trend_accuracy}%</div>
              <p className="text-[11px] text-muted-foreground">{trend.correct_predictions.toLocaleString("vi-VN")} / {trend.total_checks.toLocaleString("vi-VN")} lần đúng</p>
              <QualityBadge value={trend.trend_accuracy} thresholds={[80, 65]} />
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">Phân tách xu hướng</p>
              {[
                { label: "Đúng tăng", value: trend.correct_increasing, icon: IconArrowUp, color: "green" },
                { label: "Đúng giảm", value: trend.correct_decreasing, icon: IconArrowDown, color: "red" },
                { label: "Đúng ổn định", value: trend.correct_stable, icon: IconMinus, color: "slate" },
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

            {/* GTI quality indicators */}
            <div className="space-y-2.5 col-span-1 sm:col-span-2">
              <p className="text-[11px] font-medium text-muted-foreground">Chất lượng tính toán GTI</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-2.5 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Nhóm thiếu horizon</p>
                  <p className="text-lg font-bold tabular-nums text-yellow-600 dark:text-yellow-400">{trend.incomplete_groups?.toLocaleString("vi-VN")}</p>
                  <p className="text-[10px] text-muted-foreground">nhóm &lt;5 horizon → weight normalized</p>
                </div>
                <div className="rounded-md border p-2.5 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Horizon coverage</p>
                  <p className="text-lg font-bold tabular-nums">{trend.horizon_coverage_pct}%</p>
                  <p className="text-[10px] text-muted-foreground">trung bình % horizon có sẵn</p>
                </div>
              </div>
              <Progress value={trend.horizon_coverage_pct} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {(trend.horizon_coverage_pct ?? 0) >= 80
                  ? "✓ Horizon coverage đủ tốt — trend_accuracy đáng tin cậy"
                  : "⚠ Horizon coverage thấp — trend_accuracy cần xem xét thêm"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — Horizon Table
      ═══════════════════════════════════════════════════════ */}
      <Card>
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
              {by_horizon.map((row) => (
                <TableRow key={row.horizon_minutes}>
                  <TableCell className="font-medium text-xs">{getTimeLabel(`${row.horizon_minutes}m`)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.total_predictions.toLocaleString("vi-VN")}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">{row.avg_error} xe</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.median_error} xe</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.p95_error} xe</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">{row.accuracy_5xe}%</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.accuracy_10xe}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge level={row.prediction_confidence.level} />
                      <span className="text-[10px] text-muted-foreground tabular-nums">{(row.prediction_confidence.score * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge level={row.error_confidence.level} />
                      <span className="text-[10px] text-muted-foreground tabular-nums">{(row.error_confidence.score * 100).toFixed(0)}%</span>
                    </div>
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
            {camera_ranking.best.map((item, i) => <CameraRankRow key={item.camera_id} item={item} rank={i + 1} />)}
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
            {camera_ranking.worst.map((item, i) => <CameraRankRow key={item.camera_id} item={item} rank={i + 1} />)}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — Confidence Distribution
      ═══════════════════════════════════════════════════════ */}
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
            badge={<Badge variant="outline" className="text-[10px] px-1.5 py-0">{MOCK_METRICS.history.length} bản ghi</Badge>}
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
                <TableHead className="text-xs text-right">Trend GTI</TableHead>
                <TableHead className="text-xs text-right">Dự đoán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_METRICS.history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs">{fmtDate(row.generated_at)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.overall.mae} xe</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.overall.rmse} xe</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.overall.mape}%</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">{row.overall.accuracy_5xe}%</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.trend_accuracy.trend_accuracy}%</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.overall.total_predictions.toLocaleString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
