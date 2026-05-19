/**
 * DecisionMaker Component
 * Main orchestrator - clean layout with inline filters and compact stats
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Decision } from '@/services/decisions-types';
import { listDecisions, analyzeDecisions } from '@/services/decisions.service';
import { useSocket } from '@/contexts/SocketContext';
import { DecisionCard } from './decision-card';
import { FilterPanel } from './filter-panel';
import type { FilterState } from './filter-panel';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Inbox,
  Eye,
} from 'lucide-react';

export interface DecisionMakerRef {
  triggerAnalyze: () => void;
}

interface DecisionMakerProps {
  pageSize?: number;
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function StatChip({ icon, label, value, colorClass }: StatChipProps) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorClass}`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      </div>
    </div>
  );
}

export const DecisionMaker = forwardRef<DecisionMakerRef, DecisionMakerProps>(
  function DecisionMaker({ pageSize = 10 }, ref) {
    const { decisionVersion } = useSocket();
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [filters, setFilters] = useState<FilterState>({
      status: ['new', 'reviewed'],
      category: ['congestion', 'predictive', 'optimization', 'quality', 'monitoring'],
      sort_by: 'score',
      sort_order: 'desc',
    });

    const loadDecisions = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await listDecisions({
          status: filters.status.join(','),
          category: filters.category.join(','),
          sort_by: filters.sort_by,
          sort_order: filters.sort_order,
          page,
          limit: pageSize,
        });
        if (result.success) {
          setDecisions(result.data);
          setTotalPages(result.pagination.totalPages);
          setTotalCount(result.pagination.total);
          if (result.status_counts) setStatusCounts(result.status_counts);
        } else {
          setError('Không thể tải danh sách quyết định');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      } finally {
        setLoading(false);
      }
    };

    const handleAnalyze = async () => {
      try {
        setAnalyzing(true);
        setError(null);
        await analyzeDecisions({ time_window: '24h', limit: pageSize });
        await loadDecisions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Phân tích thất bại');
      } finally {
        setAnalyzing(false);
      }
    };

    useImperativeHandle(ref, () => ({ triggerAnalyze: handleAnalyze }));

    const handleDecisionUpdate = (updated: Decision) => {
      setDecisions(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    };

    useEffect(() => { setPage(1); }, [filters]);

    useEffect(() => { loadDecisions(); }, [page, filters]); // eslint-disable-line

    useEffect(() => {
      if (decisionVersion > 0) { setPage(1); loadDecisions(); }
    }, [decisionVersion]); // eslint-disable-line

    return (
      <div className="flex flex-col gap-5">
        {/* Stats row — compact chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip
            icon={<Inbox className="size-4 text-slate-500" />}
            label="Mới"
            value={statusCounts['new'] ?? 0}
            colorClass="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
          />
          <StatChip
            icon={<Eye className="size-4 text-blue-500" />}
            label="Đã xem xét"
            value={statusCounts['reviewed'] ?? 0}
            colorClass="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          />
          <StatChip
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            label="Đã thực hiện"
            value={statusCounts['implemented'] ?? 0}
            colorClass="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          />
          <StatChip
            icon={<EyeOff className="size-4 text-muted-foreground" />}
            label="Đã bỏ qua"
            value={statusCounts['dismissed'] ?? 0}
            colorClass="bg-muted/40 border-border"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Lỗi</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Toolbar: filter + count */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <FilterPanel onFilterChange={setFilters} loading={loading} />
          <div className="flex items-center gap-2 shrink-0">
            {loading && decisions.length > 0 && (
              <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground tabular-nums">
              {loading && !decisions.length ? 'Đang tải...' : `${totalCount} khuyến nghị`}
            </span>
          </div>
        </div>

        {/* Decision list */}
        {loading && !decisions.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-muted-foreground">
            <RefreshCw className="size-7 animate-spin opacity-30" />
            <p className="text-sm">Đang tải danh sách...</p>
          </div>
        ) : decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-muted-foreground">
            <AlertTriangle className="size-8 opacity-30" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Không có khuyến nghị nào</p>
              <p className="text-xs">Thử phân tích lại hoặc thay đổi bộ lọc</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="gap-2"
            >
              <RefreshCw className={`size-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              Phân tích ngay
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {decisions.map(decision => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  onUpdate={handleDecisionUpdate}
                  isLoading={loading}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                >
                  ← Trước
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || loading}
                >
                  Sau →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);