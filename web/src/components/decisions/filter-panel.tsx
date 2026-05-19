/**
 * FilterPanel Component
 * Compact horizontal filter bar with popover for advanced options
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { DecisionCategory, DecisionStatus } from '@/services/decisions-types';
import { DECISION_CATEGORY_INFO, DECISION_STATUS_INFO } from '@/services/decisions-types';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  loading?: boolean;
}

export interface FilterState {
  status: DecisionStatus[];
  category: DecisionCategory[];
  sort_by: 'score' | 'urgency' | 'created_at';
  sort_order: 'asc' | 'desc';
}

const DEFAULT_FILTERS: FilterState = {
  status: ['new', 'reviewed'],
  category: ['congestion', 'predictive', 'optimization', 'quality', 'monitoring'],
  sort_by: 'score',
  sort_order: 'desc',
};

const SORT_LABELS: Record<FilterState['sort_by'], string> = {
  score: 'Điểm số',
  urgency: 'Cấp bách',
  created_at: 'Mới nhất',
};

export function FilterPanel({ onFilterChange, loading = false }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [open, setOpen] = useState(false);

  const update = (partial: Partial<FilterState>) => {
    const next = { ...filters, ...partial };
    setFilters(next);
    onFilterChange(next);
  };

  const toggleStatus = (s: DecisionStatus) => {
    const next = filters.status.includes(s)
      ? filters.status.filter(x => x !== s)
      : [...filters.status, s];
    update({ status: next });
  };

  const toggleCategory = (c: DecisionCategory) => {
    const next = filters.category.includes(c)
      ? filters.category.filter(x => x !== c)
      : [...filters.category, c];
    update({ category: next });
  };

  const allStatuses = Object.keys(DECISION_STATUS_INFO) as DecisionStatus[];
  const allCategories = Object.keys(DECISION_CATEGORY_INFO) as DecisionCategory[];

  const isDefault =
    filters.status.length === allStatuses.length &&
    filters.category.length === allCategories.length &&
    filters.sort_by === 'score' &&
    filters.sort_order === 'desc';

  const activeCount =
    (filters.status.length !== allStatuses.length ? 1 : 0) +
    (filters.category.length !== allCategories.length ? 1 : 0) +
    (filters.sort_by !== 'score' || filters.sort_order !== 'desc' ? 1 : 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status quick filters */}
      <div className="flex items-center gap-1 flex-wrap">
        {allStatuses.map(s => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            disabled={loading}
            className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-all border ${
              filters.status.includes(s)
                ? `${DECISION_STATUS_INFO[s].color} border-transparent`
                : 'bg-transparent border-border text-muted-foreground opacity-60 hover:opacity-80'
            }`}
          >
            {DECISION_STATUS_INFO[s].label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

      {/* Sort indicator */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={loading}>
            <SlidersHorizontal className="size-3" />
            {SORT_LABELS[filters.sort_by]}
            {filters.sort_order === 'asc' ? ' ↑' : ' ↓'}
            {activeCount > 0 && (
              <Badge className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-blue-600 text-white rounded-full">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className="size-3 ml-0.5 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-4 space-y-4" align="start">
          {/* Category filter */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loại quyết định</p>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map(c => (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  disabled={loading}
                  className={`h-6 px-2 rounded text-xs font-medium transition-all ${
                    filters.category.includes(c)
                      ? `${DECISION_CATEGORY_INFO[c].color}`
                      : 'bg-muted text-muted-foreground opacity-50 hover:opacity-70'
                  }`}
                >
                  {DECISION_CATEGORY_INFO[c].icon} {DECISION_CATEGORY_INFO[c].label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sắp xếp theo</p>
            <div className="flex gap-1.5">
              {(['score', 'urgency', 'created_at'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => update({ sort_by: s })}
                  disabled={loading}
                  className={`flex-1 h-7 rounded-lg text-xs font-medium transition-all ${
                    filters.sort_by === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Sort order */}
          <div className="flex gap-1.5">
            {(['desc', 'asc'] as const).map(o => (
              <button
                key={o}
                onClick={() => update({ sort_order: o })}
                disabled={loading}
                className={`flex-1 h-7 rounded-lg text-xs font-medium transition-all ${
                  filters.sort_order === o
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {o === 'desc' ? '↓ Cao xuống thấp' : '↑ Thấp lên cao'}
              </button>
            ))}
          </div>

          {/* Reset */}
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                onFilterChange(DEFAULT_FILTERS);
              }}
            >
              <X className="size-3" /> Xóa bộ lọc
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}