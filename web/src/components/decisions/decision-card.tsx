/**
 * DecisionCard Component — v2
 * Nâng cấp để hiển thị confidence data-driven từ backend mới:
 *  - confidence_breakdown (method, final)
 *  - capacity_p90, stddev_vc, model_mape, hist_7d_count, recent_sample_count
 *  - minutes_since_update với màu sắc trạng thái
 *  - Visual confidence bar thay vì chỉ số thuần
 *  - Alert khi confidence thấp (<50) hoặc model MAPE cao
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Decision } from '@/services/decisions-types';
import {
  DECISION_CATEGORY_INFO,
  DECISION_CATEGORY_DESCRIPTION,
  DECISION_STATUS_INFO,
  SCORE_FIELD_INFO,
  getScorePriorityColor,
} from '@/services/decisions-types';
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  reviewDecision,
  implementDecision,
  dismissDecision,
} from '@/services/decisions.service';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  ListChecks,
  FlaskConical,
  Activity,
  Database,
  Timer,
} from 'lucide-react';

interface DecisionCardProps {
  decision: Decision;
  onUpdate?: (updated: Decision) => void;
  isLoading?: boolean;
}

const ACTOR_LABEL: Record<string, string> = {
  technician: 'Kỹ thuật viên',
  driver: 'Tài xế',
  system: 'Hệ thống',
};

const TIME_LABEL: Record<string, string> = {
  immediate: 'Ngay lập tức',
  soon: 'Sớm',
  planned: 'Theo kế hoạch',
};

const TIME_BADGE_COLOR: Record<string, string> = {
  immediate: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

// ─── Evidence rendering ────────────────────────────────────────────────────

const EVIDENCE_LABELS: Record<string, string> = {
  predicted_vc: 'V/C dự báo',
  horizon_minutes: 'Thời gian dự báo',
  forecast_for_time: 'Thời điểm dự báo',
  input_value: 'Giá trị đầu vào',
  input_sample_count: 'Số mẫu đầu vào',
  vc_ratio: 'Tỷ lệ V/C',
  total_objects: 'Số phương tiện',
  capacity: 'Sức chứa (max 7d)',
  capacity_p90: 'Sức chứa (p90 7d)',
  stddev_7d: 'Độ lệch chuẩn 7d',
  stddev_vc: 'Độ lệch chuẩn V/C',
  status: 'Trạng thái',
  last_update: 'Cập nhật cuối',
  minutes_since_update: 'Chưa có dữ liệu',
  location: 'Vị trí',
  recent_sample_count: 'Mẫu gần đây (10ph)',
  hist_sample_count: 'Mẫu lịch sử 7d',
  hist_7d_count: 'Quan sát 7d',
  model_mape_24h: 'MAPE mô hình 24h',
  mape: 'MAPE trung bình',
  mape_p25: 'MAPE P25',
  mape_p75: 'MAPE P75',
  mape_spread_iqr: 'Biến động MAPE (IQR)',
  rmse: 'RMSE',
  sample_count: 'Số cặp đo lường',
  avg_input_samples: 'Mẫu TB đầu vào',
  alert_threshold_minutes: 'Ngưỡng cảnh báo',
};

// Fields that should be rendered by special components instead of the generic row
const SKIP_GENERIC_KEYS = new Set([
  '_generated_at', '_analyzer', '_confidence_score',
  'confidence_breakdown',
]);

function formatEvidenceValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if ((key.includes('vc') || key === 'vc_ratio' || key === 'predicted_vc') && value <= 1.5)
      return `${(value * 100).toFixed(1)}%`;
    if (key.includes('mape') || key === 'mape_spread_iqr') return `${value.toFixed(1)}%`;
    if (key.includes('minute') || key === 'horizon_minutes' || key === 'alert_threshold_minutes')
      return `${Math.round(value)} phút`;
    if (key === 'stddev_vc' || key === 'stddev_7d') return value.toFixed(3);
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'string' && value.length > 40) return value.slice(0, 40) + '…';
  return String(value);
}

// ─── Confidence bar ────────────────────────────────────────────────────────

function ConfidenceBar({ value, method }: { value: number; method?: string }) {
  const tier =
    value >= 75 ? { label: 'Cao', color: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' }
    : value >= 50 ? { label: 'Vừa', color: 'text-amber-600', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' }
    : { label: 'Thấp', color: 'text-red-600', bar: 'bg-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' };

  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${tier.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={`size-3.5 ${tier.color}`} />
          <span className="text-xs font-semibold">Độ tin cậy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold tabular-nums ${tier.color}`}>{Math.round(value)}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${tier.color} ${tier.bg}`}>
            {tier.label}
          </span>
        </div>
      </div>
      <Progress value={value} className="h-1.5" />
      {method && (
        <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{method}</p>
      )}
    </div>
  );
}

// ─── Freshness indicator ───────────────────────────────────────────────────

function FreshnessIndicator({ minutes }: { minutes: number }) {
  const isStale = minutes > 15;
  const isVeryStale = minutes > 60;
  const display = minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${Math.round(minutes)}ph`;

  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border
      ${isVeryStale
        ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
        : isStale
        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
      }`
    }>
      <Timer className="size-3 shrink-0" />
      <span>Cập nhật {display} trước</span>
    </div>
  );
}

// ─── MAPE quality badge ────────────────────────────────────────────────────

function MapeBadge({ mape }: { mape: number }) {
  const isBad = mape >= 40;
  const isWarn = mape >= 25;
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border
      ${isBad
        ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
        : isWarn
        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
        : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/30 dark:border-slate-700 dark:text-slate-400'
      }`
    }>
      <Activity className="size-3 shrink-0" />
      <span>MAPE {mape.toFixed(1)}%</span>
    </div>
  );
}

// ─── ScorePill ─────────────────────────────────────────────────────────────

function ScorePill({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm font-semibold tabular-nums">{Math.round(value)}</span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function DecisionCard({ decision, onUpdate }: DecisionCardProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { role, getToken } = useAuth();
  const isTechnician = role === 'technician';

  const categoryInfo = DECISION_CATEGORY_INFO[decision.category];
  const statusInfo = DECISION_STATUS_INFO[decision.status];

  const priorityBg =
    decision.score_compound >= 75 ? 'bg-red-500'
    : decision.score_compound >= 50 ? 'bg-orange-400'
    : 'bg-emerald-500';

  // Extract new evidence fields added by upgraded backend
  const ev = decision.evidence ?? {};
  const confidenceBreakdown = ev.confidence_breakdown as { method?: string; final?: number } | undefined;
  const minutesSince = ev.minutes_since_update as number | undefined;
  const modelMape = ev.model_mape_24h as number | undefined;
  const recentSamples = ev.recent_sample_count as number | undefined;

  // Low-confidence warning: show a subtle indicator on the card
  const isLowConfidence = decision.score_confidence < 50;

  const handleReview = async () => {
    const token = getToken();
    if (!token) { toast.error('Phiên đăng nhập hết hiệu lực', { description: 'Vui lòng đăng nhập lại' }); return; }
    try {
      setActionLoading(true);
      const result = await reviewDecision(decision.id, { status: 'reviewed' }, token);
      onUpdate?.(result.data);
      toast.success('Đã đánh dấu xem xét', { description: decision.title, duration: 3000 });
    } catch (error) {
      toast.error('Không thể xem xét quyết định', { description: error instanceof Error ? error.message : 'Kiểm tra quyền hoặc kết nối' });
    } finally { setActionLoading(false); }
  };

  const handleImplement = async () => {
    const token = getToken();
    if (!token) { toast.error('Phiên đăng nhập hết hiệu lực', { description: 'Vui lòng đăng nhập lại' }); return; }
    try {
      setActionLoading(true);
      const result = await implementDecision(decision.id, undefined, token);
      onUpdate?.(result.data);
      setModalOpen(false);
      toast.success('Đã đánh dấu thực hiện', { description: decision.title, duration: 3000 });
    } catch (error) {
      toast.error('Không thể thực hiện quyết định', { description: error instanceof Error ? error.message : 'Kiểm tra quyền hoặc kết nối' });
    } finally { setActionLoading(false); }
  };

  const handleDismiss = async () => {
    const token = getToken();
    if (!token) { toast.error('Phiên đăng nhập hết hiệu lực', { description: 'Vui lòng đăng nhập lại' }); return; }
    try {
      setActionLoading(true);
      await dismissDecision(decision.id, token);
      onUpdate?.({ ...decision, status: 'dismissed' });
      setModalOpen(false);
      toast.info('Đã bỏ qua quyết định', { description: decision.title, duration: 2500 });
    } catch (error) {
      toast.error('Không thể bỏ qua quyết định', { description: error instanceof Error ? error.message : 'Kiểm tra quyền hoặc kết nối' });
    } finally { setActionLoading(false); }
  };

  const ActionButtons = ({ size = 'sm' }: { size?: 'sm' | 'default' }) => (
    <div className="flex items-center gap-2">
      {isTechnician && decision.status === 'new' && (
        <>
          <Button size={size} variant="outline" onClick={handleReview} disabled={actionLoading} className="gap-1.5">
            <Eye className="size-3.5" /> Xem xét
          </Button>
          <Button size={size} onClick={handleImplement} disabled={actionLoading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-3.5" /> Thực hiện
          </Button>
          <Button size={size} variant="ghost" onClick={handleDismiss} disabled={actionLoading} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <XCircle className="size-3.5" /> Bỏ qua
          </Button>
        </>
      )}
      {isTechnician && decision.status === 'reviewed' && (
        <>
          <Button size={size} onClick={handleImplement} disabled={actionLoading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-3.5" /> Thực hiện
          </Button>
          <Button size={size} variant="ghost" onClick={handleDismiss} disabled={actionLoading} className="gap-1.5 text-muted-foreground">
            <XCircle className="size-3.5" /> Bỏ qua
          </Button>
        </>
      )}
      {decision.status === 'implemented' && (
        <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
          <CheckCircle2 className="size-4" /> Đã thực hiện
        </span>
      )}
      {decision.status === 'dismissed' && (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <XCircle className="size-4" /> Đã bỏ qua
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* ── Compact Card ──────────────────────────────────────────────── */}
      <div className="group relative flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md">
        {/* Priority stripe */}
        <div className={`w-1 shrink-0 ${priorityBg}`} />

        <div className="flex flex-1 items-center gap-4 px-4 py-3 min-w-0">
          {/* Score badge */}
          <div className={`shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center ${getScorePriorityColor(decision.score_compound)}`}>
            <span className="text-base font-bold tabular-nums leading-none">{Math.round(decision.score_compound)}</span>
            <span className="text-[9px] opacity-60 mt-0.5">điểm</span>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-sm">{categoryInfo.icon}</span>
              <Badge variant="secondary" className={`text-xs px-1.5 py-0 h-5 ${categoryInfo.color}`}>
                {categoryInfo.label}
              </Badge>
              <Badge variant="secondary" className={`text-xs px-1.5 py-0 h-5 ${statusInfo.color}`}>
                {statusInfo.label}
              </Badge>
              {/* Low-confidence warning pill */}
              {isLowConfidence && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="size-2.5" /> Tin cậy thấp
                </span>
              )}
            </div>
            <p className="text-sm font-medium leading-snug truncate">{decision.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{decision.recommendation}</p>
          </div>

          {/* Score pills + confidence bar (md+) */}
          <div className="hidden md:flex items-center divide-x shrink-0">
            <div className="px-3">
              <ScorePill label="Ảnh hưởng" value={decision.score_impact} icon={<TrendingUp className="size-3" />} />
            </div>
            {/* Confidence pill — colored by tier */}
            <div className="px-3">
              <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
                <ShieldCheck className={`size-3 ${
                  decision.score_confidence >= 75 ? 'text-emerald-500'
                  : decision.score_confidence >= 50 ? 'text-amber-500'
                  : 'text-red-400'
                }`} />
                <span className={`text-sm font-semibold tabular-nums ${
                  decision.score_confidence >= 75 ? 'text-emerald-600'
                  : decision.score_confidence >= 50 ? 'text-amber-600'
                  : 'text-red-600'
                }`}>{Math.round(decision.score_confidence)}</span>
                <span className="text-[10px] text-muted-foreground leading-none">Tin cậy</span>
              </div>
            </div>
            <div className="px-3">
              <ScorePill label="Cấp bách" value={decision.score_urgency} icon={<Zap className="size-3" />} />
            </div>
          </div>

          {/* Data freshness chip — only if evidence has it */}
          {minutesSince !== undefined && (
            <div className="hidden lg:block shrink-0">
              <FreshnessIndicator minutes={minutesSince} />
            </div>
          )}

          {/* Timestamp */}
          <div className="hidden xl:flex items-center gap-1 shrink-0 text-xs text-muted-foreground tabular-nums">
            <Clock className="size-3" />
            {new Date(decision.generated_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-1.5">
            {(decision.status === 'new' || decision.status === 'reviewed') ? (
              <ActionButtons size="sm" />
            ) : (
              <ActionButtons size="sm" />
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Xem chi tiết"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogDescription className="sr-only">
              Chi tiết quyết định điều phối giao thông và các hành động xử lý.
            </DialogDescription>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span>{categoryInfo.icon}</span>
              <Badge variant="secondary" className={`text-xs ${categoryInfo.color}`}>{categoryInfo.label}</Badge>
              <Badge variant="secondary" className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
            </div>
            <DialogTitle className="text-base leading-snug">{decision.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">

            {/* ── Score bar ─────────────────────────────────────────── */}
            <div className="grid grid-cols-4 divide-x rounded-xl border overflow-hidden">
              <div className={`flex flex-col items-center py-3 ${getScorePriorityColor(decision.score_compound)}`}>
                <span className="text-xl font-bold tabular-nums">{Math.round(decision.score_compound)}</span>
                <span className="text-[11px] opacity-70 mt-0.5">Tổng điểm</span>
              </div>
              <div className="flex flex-col items-center py-3">
                <span className="text-lg font-semibold tabular-nums">{Math.round(decision.score_impact)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Ảnh hưởng</span>
              </div>
              {/* Confidence cell — colored */}
              <div className={`flex flex-col items-center py-3 ${
                decision.score_confidence >= 75 ? 'bg-emerald-50 dark:bg-emerald-950/20'
                : decision.score_confidence >= 50 ? 'bg-amber-50 dark:bg-amber-950/20'
                : 'bg-red-50 dark:bg-red-950/20'
              }`}>
                <span className={`text-lg font-semibold tabular-nums ${
                  decision.score_confidence >= 75 ? 'text-emerald-700 dark:text-emerald-400'
                  : decision.score_confidence >= 50 ? 'text-amber-700 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
                }`}>{Math.round(decision.score_confidence)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Tin cậy</span>
              </div>
              <div className="flex flex-col items-center py-3">
                <span className="text-lg font-semibold tabular-nums">{Math.round(decision.score_urgency)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Cấp bách</span>
              </div>
            </div>

            {/* ── Score explanations ────────────────────────────────── */}
            <TooltipProvider>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ý nghĩa điểm số</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['compound', 'impact', 'confidence', 'urgency'] as const).map(key => {
                    const info = SCORE_FIELD_INFO[key];
                    const raw = key === 'compound' ? decision.score_compound
                      : key === 'impact' ? decision.score_impact
                      : key === 'confidence' ? decision.score_confidence
                      : decision.score_urgency;
                    const val = Math.round(raw);
                    const tier = info.thresholds.find(t => val >= t.min) ?? info.thresholds[info.thresholds.length - 1];
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <span className={`text-xs font-semibold tabular-nums ${tier.color}`}>{val}</span>
                            <span className="text-xs text-muted-foreground">{info.label}</span>
                            <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${tier.color} bg-current/5`}>{tier.label}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                          <p className="font-medium mb-1">{info.label}</p>
                          {info.formula && <p className="text-muted-foreground mb-1 font-mono text-[10px]">{info.formula}</p>}
                          <p>{info.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </TooltipProvider>

            {/* ── Confidence breakdown (NEW) ────────────────────────── */}
            <ConfidenceBar
              value={decision.score_confidence}
              method={confidenceBreakdown?.method}
            />

            {/* ── Data quality indicators row ───────────────────────── */}
            {(minutesSince !== undefined || modelMape !== undefined || recentSamples !== undefined) && (
              <div className="flex flex-wrap gap-2">
                {minutesSince !== undefined && (
                  <FreshnessIndicator minutes={minutesSince} />
                )}
                {modelMape !== undefined && (
                  <MapeBadge mape={modelMape} />
                )}
                {recentSamples !== undefined && (
                  <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/30 dark:border-slate-700 dark:text-slate-400">
                    <Database className="size-3 shrink-0" />
                    <span>{recentSamples} mẫu gần đây</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Category description ──────────────────────────────── */}
            <div className="rounded-lg border-l-2 px-3 py-2.5 bg-muted/20" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{categoryInfo.icon}</span>
                <p className="text-xs font-semibold">{categoryInfo.label}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {DECISION_CATEGORY_DESCRIPTION[decision.category]}
              </p>
            </div>

            {/* ── Recommendation ────────────────────────────────────── */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Khuyến nghị</p>
              <p className="text-sm leading-relaxed">{decision.recommendation}</p>
            </div>

            {/* ── Rationale ─────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phân tích</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{decision.rationale}</p>
            </div>

            {/* ── Evidence ──────────────────────────────────────────── */}
            {decision.evidence && Object.values(decision.evidence).some(v => v !== null && v !== undefined && v !== '') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bằng chứng</p>
                </div>
                <div className="rounded-lg border bg-muted/40 divide-y">
                  {Object.entries(decision.evidence).map(([key, value]) => {
                    if (SKIP_GENERIC_KEYS.has(key)) return null;
                    if (typeof value === 'object' && value !== null) {
                      // confidence_breakdown already rendered above; skip other objects
                      return null;
                    }
                    const formatted = formatEvidenceValue(key, value);
                    if (!formatted) return null;

                    // Highlight MAPE rows that are concerning
                    const isMapeWarn = key.includes('mape') && typeof value === 'number' && value >= 25;

                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between px-3 py-2 text-sm ${
                          isMapeWarn ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        <span className="text-muted-foreground">{EVIDENCE_LABELS[key] ?? key}</span>
                        <span className={`font-medium tabular-nums ${
                          isMapeWarn ? 'text-amber-700 dark:text-amber-400' : ''
                        }`}>
                          {formatted}
                          {isMapeWarn && <AlertTriangle className="inline ml-1 size-3 text-amber-500" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Action items ───────────────────────────────────────── */}
            {decision.action_items && decision.action_items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hành động đề xuất</p>
                </div>
                <div className="space-y-2">
                  {decision.action_items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{item.action}</p>
                        {(item.actor || item.timeToAction) && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {item.actor && (
                              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                {ACTOR_LABEL[item.actor] ?? item.actor}
                              </span>
                            )}
                            {item.timeToAction && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIME_BADGE_COLOR[item.timeToAction] ?? 'bg-muted text-muted-foreground'}`}>
                                {TIME_LABEL[item.timeToAction] ?? item.timeToAction}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Feedback ───────────────────────────────────────────── */}
            {decision.feedback && (
              <div className="rounded-lg border-l-2 border-muted-foreground/40 bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">{decision.feedback}</p>
              </div>
            )}

            <Separator />

            {/* ── Footer ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {new Date(decision.generated_at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              <ActionButtons size="default" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}