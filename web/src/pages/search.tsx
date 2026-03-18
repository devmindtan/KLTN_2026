import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { smartMatch, calculateRelevanceScore } from "@/lib/search-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  IconSearch,
  IconX,
  IconClock,
  IconExternalLink,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { getAllCameras } from "@/services/camera.service";
import { getAllModelVersions } from "@/services/model.service";
import { getHelpArticles } from "@/services/help.service";
import { useSocket } from "@/contexts/SocketContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  type ResultType,
  type SearchResult,
  LOS_LABELS,
  MOCK_REPORT_FORECAST,
  QUICK_ACTIONS,
  TAB_CONFIG,
  LS_KEY,
  MAX_HISTORY,
  getTypeMeta,
  buildCameraResults,
  buildModelResults,
  buildDocResults,
} from "@/components/search/search-types";
import { ResultSkeleton } from "@/components/search/result-skeleton";
import { ResultItem } from "@/components/search/result-item";
import { DetailSheet } from "@/components/search/detail-sheet";
import { SEARCH_TERM } from "@/lib/app-constants";


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { routePrefix } = useAuth();
  const { processedCameras } = useSocket();
  const { startLoading, stopLoading } = useLoading();

  /** Tạo URL tới trang tài liệu, tương thích technician prefix */
  const navToDoc = (sectionKey?: string) =>
    routePrefix
      ? `/${routePrefix}/documentation${sectionKey ? `?doc=${sectionKey}` : ""}`
      : `/documentation${sectionKey ? `?doc=${sectionKey}` : ""}`;

  const [query,       setQuery]       = useState("");
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [activeTab,   setActiveTab]   = useState("all");
  const [isSearching, setIsSearching] = useState(false);

  // Dữ liệu thực từ API
  const [cameraResults, setCameraResults] = useState<SearchResult[]>([]);
  const [modelResults,  setModelResults]  = useState<SearchResult[]>([]);
  const [docResults,    setDocResults]    = useState<SearchResult[]>([]);
  const [dataLoaded,    setDataLoaded]    = useState(false);
  const [dataError,     setDataError]     = useState(false);

  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  /** Đọc query từ URL params khi trang load */
  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery && urlQuery.trim()) {
      setQuery(urlQuery.trim());
      setDebouncedQ(urlQuery.trim());
      pushHistory(urlQuery.trim());
      // Focus vào input để user thấy query đã được set
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Build processedCameras lookup map — key = shortId (cam_id), không phải full NGSI-LD id */
  const processedMap = new Map(
    processedCameras.map(c => [c.shortId, {
      totalObjects: c.totalObjects,
      status:       c.status.current,
      lastUpdated:  c.lastUpdated,
    }])
  );

  /** Load camera + model data khi component mount */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      startLoading();
      try {
        const [cameras, allVersions, helpArticles] = await Promise.all([
          getAllCameras(),
          getAllModelVersions(),
          getHelpArticles(),
        ]);
        if (cancelled) return;
        setCameraResults(buildCameraResults(cameras, processedMap));
        const flat = Object.values(allVersions).flat();
        setModelResults(buildModelResults(flat));
        setDocResults(buildDocResults(helpArticles));
        setDataLoaded(true);
      } catch {
        if (!cancelled) setDataError(true);
      } finally {
        if (!cancelled) stopLoading();
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLoading, stopLoading]);

  /** Cập nhật lại trạng thái camera khi socket có dữ liệu mới */
  useEffect(() => {
    if (!dataLoaded || cameraResults.length === 0) return;
    setCameraResults(prev =>
      prev.map(r => {
        const realtime = processedMap.get(r.id);
        if (!realtime) return { ...r, status: "offline" as const, badge: "Offline", badgeVariant: "secondary" as const, subtitle: "Không có dữ liệu real-time", meta: "Offline" };
        const isWarning = realtime.status === "heavy" || realtime.status === "congested";
        return {
          ...r,
          status:       (isWarning ? "warning" : "online") as SearchResult["status"],
          badge:        isWarning ? "Cảnh báo" : "Trực tuyến",
          badgeVariant: (isWarning ? "destructive" : "default") as SearchResult["badgeVariant"],
          subtitle:     `${realtime.totalObjects} xe • ${LOS_LABELS[realtime.status] ?? realtime.status}`,
          meta:         `Cập nhật: ${new Date(realtime.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
        };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedCameras, dataLoaded]);

  /** Debounce 350ms */
  useEffect(() => {
    if (!query.trim()) { setDebouncedQ(""); setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(() => { setDebouncedQ(query.trim()); setIsSearching(false); }, 350);
    return () => clearTimeout(t);
  }, [query]);

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

  const clearHistory = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setHistory([]);
  }, []);

  const selectTerm = (term: string) => { setQuery(term); inputRef.current?.focus(); };

  const handleSearch = () => {
    const term = query.trim();
    if (!term) return;
    pushHistory(term);
    setDebouncedQ(term);
  };

  /** Tổng hợp tất cả results (API thực + mock + tài liệu) */
  const allResults: SearchResult[] = [...cameraResults, ...modelResults, ...MOCK_REPORT_FORECAST, ...docResults];

  /** Lọc theo tab + keyword với smart search */
  const filterResults = (list: SearchResult[]) => {
    if (!debouncedQ) return list;
    
    // Filter và tính điểm relevance
    const filtered = list.filter(r => 
      smartMatch(r.title, debouncedQ) ||
      smartMatch(r.subtitle, debouncedQ) ||
      smartMatch(r.meta, debouncedQ)
    );
    
    // Sort theo relevance score (cao nhất trước)
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
  };

  const getTabResults = (type?: ResultType) => {
    const source = type ? allResults.filter(r => r.type === type) : allResults;
    return filterResults(source);
  };

  const filteredResults = activeTab === "all"
    ? filterResults(allResults)
    : filterResults(allResults.filter(r => r.type === activeTab));

  const isLoading = isSearching || (!dataLoaded && !dataError);
  const hasQuery  = debouncedQ.length > 0 || isSearching;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconSearch className="w-5 h-5" />}
        title={SEARCH_TERM.page_header.title}
        description={SEARCH_TERM.page_header.description}
      />

      {/* ── Search bar ── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                placeholder="Nhập tên camera, mô hình, báo cáo..."
                className="pl-9 pr-9"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                autoFocus
              />
              {query && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setQuery(""); setDebouncedQ(""); inputRef.current?.focus(); }}
                  aria-label="Xóa"
                >
                  <IconX className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={!query.trim()}>
              <IconSearch className="w-4 h-4 mr-1.5" />
              Tìm kiếm
            </Button>
          </div>
          {/* Data loading indicator */}
          {!dataLoaded && !dataError && (
            <p className="text-xs text-muted-foreground mt-2 ml-1">
              Đang tải dữ liệu camera và mô hình...
            </p>
          )}
          {dataError && (
            <p className="text-xs text-destructive mt-2 ml-1">
              Không thể tải dữ liệu từ server. Một số kết quả có thể không chính xác.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Khi KHÔNG có query: Recent + Quick Actions ── */}
      {!hasQuery && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent searches */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <IconClock className="w-4 h-4 text-muted-foreground" />
                  Tìm kiếm gần đây
                </CardTitle>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2" onClick={clearHistory}>
                    Xóa tất cả
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có lịch sử tìm kiếm</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {history.map(term => (
                    <div key={term} className="group flex items-center justify-between rounded-md hover:bg-accent transition-colors px-2 py-1.5">
                      <button className="flex items-center gap-2 flex-1 text-sm text-left" onClick={() => selectTerm(term)}>
                        <IconClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{term}</span>
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded"
                        onClick={() => removeHistory(term)}
                        aria-label="Xóa"
                      >
                        <IconX className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconExternalLink className="w-4 h-4 text-muted-foreground" />
                Hành động nhanh
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                {QUICK_ACTIONS.map(a => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      className="flex items-center gap-3 rounded-md hover:bg-accent transition-colors px-2 py-2 text-left w-full group"
                    >
                      <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                      </div>
                      <IconExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Khi CÓ query: Tabs + Results ── */}
      {hasQuery && (
        <div className="flex flex-col gap-3">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-muted/40 p-1">
              {TAB_CONFIG.map(tab => {
                const count = getTabResults(tab.type).length;
                const Icon  = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 data-[state=active]:shadow-sm"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {!isLoading && (
                      <span className="ml-1 bg-background text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Results area */}
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <ResultSkeleton />
              ) : filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="p-4 bg-muted rounded-full">
                    <IconSearch className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Không tìm thấy kết quả cho "{debouncedQ}"</p>
                  <p className="text-xs text-muted-foreground">Thử tìm: tên camera, phiên bản mô hình, báo cáo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm text-muted-foreground">
                      {filteredResults.length} kết quả cho{" "}
                      <span className="font-medium text-foreground">"{debouncedQ}"</span>
                    </p>
                  </div>
                  <Separator className="mb-3" />

                  {activeTab === "all"
                    ? TAB_CONFIG.filter(t => t.type).map(tab => {
                        const group = filteredResults.filter(r => r.type === tab.type);
                        if (group.length === 0) return null;
                        const { icon: GIcon, color, label } = getTypeMeta(tab.type!);
                        return (
                          <div key={tab.value} className="mb-4">
                            <div className="flex items-center gap-1.5 mb-2 px-1">
                              <GIcon className={`w-3.5 h-3.5 ${color}`} />
                              <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                              <span className="text-xs text-muted-foreground">({group.length})</span>
                            </div>
                            <div className="space-y-1">
                              {group.map(r => <ResultItem key={r.id} result={r} query={debouncedQ} onView={r.type === "camera" || r.type === "model" ? () => setSelected(r) : r.type === "doc" ? () => navigate(navToDoc(r.details?.section_key as string)) : undefined} />)}
                            </div>
                          </div>
                        );
                      })
                    : filteredResults.map(r => <ResultItem key={r.id} result={r} query={debouncedQ} onView={r.type === "camera" || r.type === "model" ? () => setSelected(r) : r.type === "doc" ? () => navigate(navToDoc(r.details?.section_key as string)) : undefined} />)
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {/* ── Detail Sheet ── */}
      <DetailSheet result={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

