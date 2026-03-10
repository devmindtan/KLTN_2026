import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  IconSearch,
  IconX,
  IconClock,
  IconCameraPlus,
  IconBrain,
  IconFileText,
  IconChartBar,
  IconRefresh,
  IconMapPin,
  IconAlertTriangle,
  IconCircleCheck,
  IconMoonStars,
  IconExternalLink,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { HighlightText } from "@/components/highlight-text";
import { getAllCameras, type CameraInfo } from "@/services/camera.service";
import { getAllModelVersions, type MLModelMetadata } from "@/services/model.service";
import { useSocket } from "@/contexts/SocketContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type ResultType = "camera" | "model" | "report" | "forecast";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  status?: "online" | "offline" | "warning";
}

// ─── Mock data (chỉ dùng cho report + forecast chưa có API) ──────────────────
const MOCK_REPORT_FORECAST: SearchResult[] = [
  { id: "r1", type: "report", title: "Báo cáo lưu lượng tháng 2/2026", subtitle: "Tổng 2.4M lượt • Giờ cao điểm: 17:00–19:00", meta: "Tạo: 01/03/2026", badge: "PDF", badgeVariant: "outline" },
  { id: "r2", type: "report", title: "Báo cáo mô hình LSTM tháng 2", subtitle: "Accuracy: 94.2% • 28 ngày dữ liệu", meta: "Tạo: 28/02/2026", badge: "PDF", badgeVariant: "outline" },
  { id: "r3", type: "report", title: "Tổng hợp sự cố tháng 1/2026", subtitle: "12 sự kiện ùn tắc • 3 camera offline", meta: "Tạo: 01/02/2026", badge: "Docs", badgeVariant: "outline" },
  { id: "f1", type: "forecast", title: "Dự báo 17:00–18:00 hôm nay", subtitle: "Cầu Sài Gòn: 480 xe/giờ • Nguy cơ ùn tắc cao", meta: "Độ tin cậy: 91%", badge: "Nguy cơ cao", badgeVariant: "destructive" },
  { id: "f2", type: "forecast", title: "Dự báo 08:00–09:00 mai", subtitle: "Ngã tư Bến Thành: 310 xe/giờ • Bình thường", meta: "Độ tin cậy: 87%", badge: "Bình thường", badgeVariant: "default" },
  { id: "f3", type: "forecast", title: "Dự báo cuối tuần 14–15/03", subtitle: "Toàn mạng lưới: giảm 35% so với ngày thường", meta: "Độ tin cậy: 82%", badge: "Thấp điểm", badgeVariant: "secondary" },
];

const LOS_LABELS: Record<string, string> = {
  free_flow: "Thông thoáng",
  smooth:    "Ổn định",
  moderate:  "Trung bình",
  heavy:     "Lưu lượng cao",
  congested: "Ùn tắc",
};

const QUICK_ACTIONS = [
  { label: "Làm mới dữ liệu camera", icon: IconRefresh, desc: "Cập nhật toàn bộ feed camera" },
  { label: "Xem mô hình đang active", icon: IconBrain,   desc: "Tìm kiếm theo từ khoá 'active'" },
  { label: "Bản đồ giám sát",         icon: IconMapPin,  desc: "Mở chế độ xem bản đồ" },
  { label: "Xuất báo cáo hôm nay",    icon: IconFileText, desc: "Tải báo cáo mới nhất" },
];

const TAB_CONFIG: { value: string; label: string; type?: ResultType; icon: React.ElementType }[] = [
  { value: "all",      label: "Tất cả",  icon: IconSearch    },
  { value: "camera",   label: "Camera",  type: "camera",   icon: IconCameraPlus },
  { value: "model",    label: "Mô hình", type: "model",    icon: IconBrain      },
  { value: "report",   label: "Báo cáo", type: "report",   icon: IconFileText   },
  { value: "forecast", label: "Dự báo",  type: "forecast", icon: IconChartBar   },
];

const LS_KEY = "search_history";
const MAX_HISTORY = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTypeMeta(type: ResultType) {
  switch (type) {
    case "camera":   return { icon: IconCameraPlus, color: "text-blue-500",   bg: "bg-blue-500/10",   label: "Camera"   };
    case "model":    return { icon: IconBrain,       color: "text-purple-500", bg: "bg-purple-500/10", label: "Mô hình"  };
    case "report":   return { icon: IconFileText,    color: "text-orange-500", bg: "bg-orange-500/10", label: "Báo cáo"  };
    case "forecast": return { icon: IconChartBar,    color: "text-green-500",  bg: "bg-green-500/10",  label: "Dự báo"   };
  }
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "online")  return <IconCircleCheck  className="w-3 h-3 text-green-500 shrink-0" />;
  if (status === "warning") return <IconAlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />;
  if (status === "offline") return <IconMoonStars     className="w-3 h-3 text-muted-foreground shrink-0" />;
  return null;
}

/** Chuyển dữ liệu camera tĩnh + realtime thành SearchResult */
function buildCameraResults(
  cameras: CameraInfo[],
  processedMap: Map<string, { totalObjects: number; status: string; lastUpdated: string }>
): SearchResult[] {
  return cameras.map(cam => {
    const realtime = processedMap.get(cam.cam_id);
    const isOnline = !!realtime;
    const losStatus = realtime?.status;
    const isWarning = losStatus === "heavy" || losStatus === "congested";

    const statusKey: SearchResult["status"] = !isOnline
      ? "offline"
      : isWarning ? "warning" : "online";

    const badge      = !isOnline ? "Offline" : isWarning ? "Cảnh báo" : "Online";
    const badgeVariant: SearchResult["badgeVariant"] = !isOnline
      ? "secondary"
      : isWarning ? "destructive" : "default";

    const subtitle = isOnline
      ? `${realtime!.totalObjects} xe/giờ • ${LOS_LABELS[losStatus!] ?? losStatus}`
      : "Không có dữ liệu real-time";

    const meta = isOnline
      ? `Cập nhật: ${new Date(realtime!.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
      : "Offline";

    return {
      id:           cam.cam_id,
      type:         "camera",
      title:        cam.display_name,
      subtitle,
      meta,
      badge,
      badgeVariant,
      status:       statusKey,
    };
  });
}

/** Chuyển dữ liệu model thành SearchResult */
function buildModelResults(versions: MLModelMetadata[]): SearchResult[] {
  return versions.map(v => {
    const acc  = v.metrics?.r2   != null ? `R²: ${(v.metrics.r2 as number).toFixed(3)}` : null;
    const mae  = v.metrics?.mae  != null ? `MAE: ${(v.metrics.mae as number).toFixed(2)}` : null;
    const subtitle = [acc, mae].filter(Boolean).join(" • ") || "Chưa có metrics";
    const meta = `Loại: ${v.model_type} • ${new Date(v.created_at).toLocaleDateString("vi-VN")}`;
    return {
      id:           String(v.id),
      type:         "model",
      title:        v.model_version,
      subtitle,
      meta,
      badge:        v.is_active ? "Active" : "Lưu trữ",
      badgeVariant: v.is_active ? "default" : "outline",
    };
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Search() {
  const { processedCameras } = useSocket();

  const [query,       setQuery]       = useState("");
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [activeTab,   setActiveTab]   = useState("all");
  const [isSearching, setIsSearching] = useState(false);

  // Dữ liệu thực từ API
  const [cameraResults, setCameraResults] = useState<SearchResult[]>([]);
  const [modelResults,  setModelResults]  = useState<SearchResult[]>([]);
  const [dataLoaded,    setDataLoaded]    = useState(false);
  const [dataError,     setDataError]     = useState(false);

  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  /** Build processedCameras lookup map */
  const processedMap = new Map(
    processedCameras.map(c => [c.id, {
      totalObjects: c.totalObjects,
      status:       c.status.current,
      lastUpdated:  c.lastUpdated,
    }])
  );

  /** Load camera + model data khi component mount */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [cameras, allVersions] = await Promise.all([
          getAllCameras(),
          getAllModelVersions(),
        ]);
        if (cancelled) return;
        setCameraResults(buildCameraResults(cameras, processedMap));
        const flat = Object.values(allVersions).flat();
        setModelResults(buildModelResults(flat));
        setDataLoaded(true);
      } catch {
        if (!cancelled) setDataError(true);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          badge:        isWarning ? "Cảnh báo" : "Online",
          badgeVariant: (isWarning ? "destructive" : "default") as SearchResult["badgeVariant"],
          subtitle:     `${realtime.totalObjects} xe/giờ • ${LOS_LABELS[realtime.status] ?? realtime.status}`,
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

  /** Tổng hợp tất cả results (API thực + mock) */
  const allResults: SearchResult[] = [...cameraResults, ...modelResults, ...MOCK_REPORT_FORECAST];

  /** Lọc theo tab + keyword */
  const filterResults = (list: SearchResult[]) => {
    if (!debouncedQ) return list;
    const needle = debouncedQ.toLowerCase();
    return list.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.subtitle.toLowerCase().includes(needle)
    );
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
        title="Tìm kiếm"
        description="Tìm kiếm camera, mô hình, báo cáo và dự báo giao thông"
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
                              {group.map(r => <ResultItem key={r.id} result={r} query={debouncedQ} />)}
                            </div>
                          </div>
                        );
                      })
                    : filteredResults.map(r => <ResultItem key={r.id} result={r} query={debouncedQ} />)
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ResultItem ───────────────────────────────────────────────────────────────
/** Một dòng kết quả tìm kiếm */
function ResultItem({ result, query }: { result: SearchResult; query: string }) {
  const { icon: Icon, color, bg } = getTypeMeta(result.type);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors group">
      <div className={`p-2 ${bg} rounded-lg shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            <HighlightText text={result.title} query={query} />
          </span>
          {result.badge && (
            <Badge variant={result.badgeVariant ?? "secondary"} className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              {result.badge}
            </Badge>
          )}
          {result.status && <StatusIcon status={result.status} />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <HighlightText text={result.subtitle} query={query} />
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{result.meta}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs shrink-0"
      >
        Xem
      </Button>
    </div>
  );
}

