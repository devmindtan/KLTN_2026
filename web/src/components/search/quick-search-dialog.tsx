/**
 * Dialog tìm kiếm nhanh hiển thị từ SiteHeader.
 * Dùng chung search-types.ts với trang /search — chỉ cần sửa search-types.ts để cập nhật cả hai nơi.
 * Mở bằng nút trên header hoặc phím tắt Ctrl+K.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconX, IconClock, IconArrowRight } from "@tabler/icons-react";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { smartMatch, calculateRelevanceScore } from "@/lib/search-utils";
import { getAllCameras } from "@/services/camera.service";
import { getAllModelVersions } from "@/services/model.service";
import { getHelpArticles } from "@/services/help.service";
import {
  type ResultType,
  type SearchResult,
  LOS_LABELS,
  MOCK_REPORT_FORECAST,
  TAB_CONFIG,
  LS_KEY,
  MAX_HISTORY,
  getTypeMeta,
  buildCameraResults,
  buildModelResults,
  buildDocResults,
} from "@/components/search/search-types";
import { ResultItem } from "@/components/search/result-item";
import { ResultSkeleton } from "@/components/search/result-skeleton";
import { DetailSheet } from "@/components/search/detail-sheet";

/** Số kết quả tối đa hiển thị mỗi nhóm trong quick dialog */
const MAX_PER_GROUP = 4;

export function QuickSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate   = useNavigate();
  const { routePrefix } = useAuth();
  const { processedCameras } = useSocket();

  const [query,      setQuery]      = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [cameraResults, setCameraResults] = useState<SearchResult[]>([]);
  const [modelResults,  setModelResults]  = useState<SearchResult[]>([]);
  const [docResults,    setDocResults]    = useState<SearchResult[]>([]);
  const [dataLoaded,    setDataLoaded]    = useState(false);

  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  /** Tạo URL tương thích technician prefix */
  const navTo = useCallback(
    (page: string, params = "") =>
      routePrefix ? `/${routePrefix}/${page}${params}` : `/${page}${params}`,
    [routePrefix],
  );

  const processedMap = useMemo(() => new Map(
    processedCameras.map(c => [c.shortId, {
      totalObjects: c.totalObjects,
      status:       c.status.current,
      lastUpdated:  c.lastUpdated,
    }])
  ), [processedCameras]);

  /** Load dữ liệu lần đầu khi dialog mở */
  useEffect(() => {
    if (!open || dataLoaded) return;
    let cancelled = false;
    Promise.all([getAllCameras(), getAllModelVersions(), getHelpArticles()])
      .then(([cameras, allVersions, articles]) => {
        if (cancelled) return;
        setCameraResults(buildCameraResults(cameras, processedMap));
        setModelResults(buildModelResults(Object.values(allVersions).flat()));
        setDocResults(buildDocResults(articles));
        setDataLoaded(true);
      })
      .catch(() => { if (!cancelled) setDataLoaded(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Cập nhật realtime khi socket push dữ liệu mới */
  useEffect(() => {
    if (!dataLoaded || cameraResults.length === 0) return;
    setCameraResults(prev =>
      prev.map(r => {
        const rt = processedMap.get(r.id);
        if (!rt) return { ...r, status: "offline" as const, badge: "Offline", badgeVariant: "secondary" as const, subtitle: "Không có dữ liệu real-time", meta: "Offline" };
        const isWarn = rt.status === "heavy" || rt.status === "congested";
        return {
          ...r,
          status:       (isWarn ? "warning" : "online") as SearchResult["status"],
          badge:        isWarn ? "Cảnh báo" : "Trực tuyến",
          badgeVariant: (isWarn ? "destructive" : "default") as SearchResult["badgeVariant"],
          subtitle:     `${rt.totalObjects} xe • ${LOS_LABELS[rt.status] ?? rt.status}`,
          meta:         `Cập nhật: ${new Date(rt.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
        };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedCameras, dataLoaded]);

  /** Debounce 300ms */
  useEffect(() => {
    if (!query.trim()) { setDebouncedQ(""); setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(() => { setDebouncedQ(query.trim()); setIsSearching(false); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  /** Focus input khi dialog mở */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setDebouncedQ("");
    }
  }, [open]);

  const pushHistory = useCallback((term: string) => {
    setHistory(prev => {
      const next = [term, ...prev.filter(x => x !== term)].slice(0, MAX_HISTORY);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeHistory = useCallback((term: string) => {
    setHistory(prev => {
      const next = prev.filter(x => x !== term);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleClose = () => onOpenChange(false);

  const handleNavigate = useCallback((url: string) => {
    navigate(url);
    handleClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleSelect = useCallback((r: SearchResult) => {
    if (r.type === "camera" || r.type === "model") {
      setSelected(r);
      return;
    }
    if (r.type === "doc") {
      pushHistory(r.title);
      handleNavigate(navTo("documentation", `?doc=${r.details?.section_key}`));
      return;
    }
    handleClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNavigate, pushHistory]);

  const handleSearchTerm = useCallback((term: string) => {
    pushHistory(term);
    handleNavigate(navTo("search", `?q=${encodeURIComponent(term)}`));
  }, [handleNavigate, navTo, pushHistory]);

  /** Tổng hợp results */
  const allResults: SearchResult[] = useMemo(
    () => [...cameraResults, ...modelResults, ...MOCK_REPORT_FORECAST, ...docResults],
    [cameraResults, modelResults, docResults],
  );

  const filteredResults = useMemo(() => {
    if (!debouncedQ) return [];
    
    // Filter với smart search
    const filtered = allResults.filter(r => 
      smartMatch(r.title, debouncedQ) ||
      smartMatch(r.subtitle, debouncedQ) ||
      smartMatch(r.meta, debouncedQ)
    );
    
    // Sort theo relevance score
    return filtered.sort((a, b) => {
      const scoreA = Math.max(
        calculateRelevanceScore(a.title, debouncedQ),
        calculateRelevanceScore(a.subtitle, debouncedQ),
        calculateRelevanceScore(a.meta, debouncedQ)
      );
      const scoreB = Math.max(
        calculateRelevanceScore(b.title, debouncedQ),
        calculateRelevanceScore(b.subtitle, debouncedQ),
        calculateRelevanceScore(b.meta, debouncedQ)
      );
      return scoreB - scoreA;
    });
  }, [allResults, debouncedQ]);

  const hasQuery    = debouncedQ.length > 0 || isSearching;
  const totalCount  = filteredResults.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-xl p-0 gap-0 overflow-hidden [&>button]:hidden"
          aria-describedby={undefined}
        >
          {/* ── Search input ── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b relative">
            <IconSearch className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && query.trim()) handleSearchTerm(query.trim());
                if (e.key === "Escape") handleClose();
              }}
              placeholder="Tìm camera, mô hình, tài liệu..."
              className="border-0 shadow-none focus-visible:ring-0 h-8 px-0 text-sm"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono shrink-0">
              Esc
            </kbd>
          </div>

          <div className="overflow-y-auto max-h-[420px] scrollbar">
            {/* ── Không có query: lịch sử tìm kiếm ── */}
            {!hasQuery && (
              <div className="p-3 space-y-1">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nhập từ khoá để tìm kiếm
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Tìm kiếm gần đây</span>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          localStorage.removeItem(LS_KEY);
                          setHistory([]);
                        }}
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    {history.map(term => (
                      <div
                        key={term}
                        className="group flex items-center justify-between rounded-md hover:bg-accent px-2 py-1.5 transition-colors"
                      >
                        <button
                          className="flex items-center gap-2 flex-1 text-sm text-left"
                          onClick={() => handleSearchTerm(term)}
                        >
                          <IconClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{term}</span>
                        </button>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded"
                          onClick={() => removeHistory(term)}
                        >
                          <IconX className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Loading ── */}
            {hasQuery && isSearching && (
              <div className="p-3">
                <ResultSkeleton />
              </div>
            )}

            {/* ── Không có kết quả ── */}
            {hasQuery && !isSearching && filteredResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <IconSearch className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Không tìm thấy kết quả nào</p>
                <p className="text-xs text-muted-foreground">cho &ldquo;{debouncedQ}&rdquo;</p>
              </div>
            )}

            {/* ── Có kết quả: nhóm theo type, max MAX_PER_GROUP mỗi nhóm ── */}
            {hasQuery && !isSearching && filteredResults.length > 0 && (
              <div className="p-3 space-y-1">
                {TAB_CONFIG.filter(t => t.type).map(tab => {
                  const group = filteredResults.filter(r => r.type === tab.type as ResultType);
                  if (group.length === 0) return null;
                  const { icon: GIcon, color, label } = getTypeMeta(tab.type!);
                  const shown = group.slice(0, MAX_PER_GROUP);
                  return (
                    <div key={tab.value} className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                        <GIcon className={`w-3 h-3 ${color}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>
                          {label}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                          {group.length}
                        </Badge>
                      </div>
                      <div className="space-y-0.5">
                        {shown.map(r => (
                          <ResultItem
                            key={r.id}
                            result={r}
                            query={debouncedQ}
                            onView={() => handleSelect(r)}
                          />
                        ))}
                        {group.length > MAX_PER_GROUP && (
                          <button
                            className="w-full text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-left transition-colors"
                            onClick={() => handleSearchTerm(debouncedQ)}
                          >
                            +{group.length - MAX_PER_GROUP} kết quả nữa →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          {hasQuery && !isSearching && totalCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {totalCount} kết quả
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleSearchTerm(debouncedQ)}
                >
                  Xem tất cả trên trang tìm kiếm
                  <IconArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}

          {/* Hint khi không có query */}
          {!hasQuery && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  Nhấn <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">Enter</kbd> để tìm kiếm đầy đủ
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleNavigate(navTo("search"))}
                >
                  Trang tìm kiếm
                  <IconArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail sheet cho camera/model */}
      <DetailSheet result={selected} onClose={() => setSelected(null)} />
    </>
  );
}
