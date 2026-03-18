import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/custom/search-input";
import { IconCar, IconMotorbike, IconClock, IconActivity, IconSearch, IconFilter, IconX, IconLayoutGrid } from "@tabler/icons-react";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { PageHeader } from "@/components/custom/page-header";
import { HighlightText } from "@/components/custom/highlight-text";
import { CameraWallView } from "@/components/monitoring/camera-wall-view";
import { CameraDetailSheet } from "@/components/monitoring/camera-detail-dialog";
import { getStatusBadge } from "@/components/monitoring/camera-utils";
import { useSocket } from "@/contexts/SocketContext";
import { useLocation, useNavigate } from "react-router-dom";
import * as React from "react";
import { LOS_LABEL, TREND_LABEL, UI_LABELS, CAMERA_LABELS, TRAFFIC_TERMS, getTrendLabel, MONITORING_TERM } from "@/lib/app-constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TrafficMonitoring() {
  const { processedCameras, isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const autoOpenCamId: string | null =
    (location.state as { openCamId?: string } | null)?.openCamId ?? null;

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [trendFilter, setTrendFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("name");

  const [selectedCameraId, setSelectedCameraId] = React.useState<string | null>(null);
  // Derive live camera từ processedCameras theo ID → tự động nhận socket updates
  const selectedCamera = React.useMemo(
    () => selectedCameraId ? processedCameras.find((c) => c.shortId === selectedCameraId) ?? null : null,
    [selectedCameraId, processedCameras]
  );

  const [viewMode, setViewMode] = React.useState<"cards" | "wall">("cards");
  const [wallPerPage, setWallPerPage] = React.useState<number>(9);
  const [wallCurrentPage, setWallCurrentPage] = React.useState<number>(1);

  // Auto-open camera từ navigate state (ví dụ: từ trang tổng quan) + clear state
  React.useEffect(() => {
    if (autoOpenCamId && processedCameras.length > 0) {
      const camExists = processedCameras.some((c) => c.shortId === autoOpenCamId);
      if (camExists) {
        setSelectedCameraId(autoOpenCamId);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCamId, processedCameras.length]);

  /** Format thời gian relative từ ISO timestamp */
  const getRelativeTime = (timestamp: string) => {
    if (!timestamp) return "Chưa cập nhật";
    const diffInSeconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diffInSeconds < 60)    return "Vừa xong";
    if (diffInSeconds < 3600)  return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  };

  const filteredAndSortedCameras = React.useMemo(() => {
    const filtered = processedCameras.filter((camera) => {
      const matchesSearch = searchQuery.trim() === "" ||
        camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        camera.shortId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || camera.status.current === statusFilter;
      const matchesTrend  = trendFilter  === "all" || camera.trend.direction  === trendFilter;
      return matchesSearch && matchesStatus && matchesTrend;
    });
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":          return a.name.localeCompare(b.name);
        case "vehicles-high": return b.totalObjects - a.totalObjects;
        case "vehicles-low":  return a.totalObjects - b.totalObjects;
        case "updated":       return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:              return 0;
      }
    });
    return filtered;
  }, [processedCameras, searchQuery, statusFilter, trendFilter, sortBy]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || trendFilter !== "all" || sortBy !== "name";
  const clearFilters = () => { setSearchQuery(""); setStatusFilter("all"); setTrendFilter("all"); setSortBy("name"); };

  if (viewMode === "wall") {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <CameraWallView
          cameras={filteredAndSortedCameras}
          perPage={wallPerPage}
          currentPage={wallCurrentPage}
          onPerPageChange={(v) => { setWallPerPage(v); setWallCurrentPage(1); }}
          onPageChange={setWallCurrentPage}
          onExit={() => setViewMode("cards")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconActivity className="w-5 h-5" />}
        title={MONITORING_TERM.page_header.title}
        description={MONITORING_TERM.page_header.description}
      >
        <Badge
          variant="outline"
          className={`flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0 ${
            isConnected ? "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400"
          }`}
        >
          <IconActivity className="size-3 shrink-0" />
          {isConnected ? "Trực tiếp" : "Mất kết nối"}
        </Badge>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setViewMode("wall"); setWallCurrentPage(1); }}>
          <IconLayoutGrid className="w-4 h-4" />
          Chế độ Wall
        </Button>
      </PageHeader>

      {processedCameras.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <SearchInput
                  placeholder="Tìm kiếm theo tên camera hoặc ID..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <IconFilter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{UI_LABELS.ALL}</SelectItem>
                      <SelectItem value="free_flow">{LOS_LABEL["free_flow"]}</SelectItem>
                      <SelectItem value="smooth">{LOS_LABEL["smooth"]}</SelectItem>
                      <SelectItem value="moderate">{LOS_LABEL["moderate"]}</SelectItem>
                      <SelectItem value="heavy">{LOS_LABEL["heavy"]}</SelectItem>
                      <SelectItem value="congested">{LOS_LABEL["congested"]}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={trendFilter} onValueChange={setTrendFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Xu hướng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{UI_LABELS.ALL}</SelectItem>
                      <SelectItem value="increasing">{TREND_LABEL["increasing"]}</SelectItem>
                      <SelectItem value="stable">{TREND_LABEL["stable"]}</SelectItem>
                      <SelectItem value="decreasing">{TREND_LABEL["decreasing"]}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sắp xếp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Tên A-Z</SelectItem>
                      <SelectItem value="vehicles-high">Nhiều xe nhất</SelectItem>
                      <SelectItem value="vehicles-low">Ít xe nhất</SelectItem>
                      <SelectItem value="updated">Mới cập nhật</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Hiển thị <span className="font-semibold text-foreground">{filteredAndSortedCameras.length}</span> / {processedCameras.length} camera
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <IconX className="w-4 h-4 mr-1" />
                    {UI_LABELS.CLEAR_FILTER}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {processedCameras.length === 0 ? (
        <Card>
          <CardContent className="flex h-[400px] items-center justify-center">
            <div className="text-center text-muted-foreground">
              <IconActivity className="w-12 h-12 mx-auto mb-4 animate-pulse" />
              <p className="text-lg font-medium">{UI_LABELS.LOADING}</p>
              <p className="text-sm">{UI_LABELS.WAIT_CONNECTION}</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredAndSortedCameras.length === 0 ? (
        <Card>
          <CardContent className="flex h-[300px] items-center justify-center">
            <div className="text-center text-muted-foreground">
              <IconSearch className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg font-medium">{CAMERA_LABELS.NOT_FOUND}</p>
              <p className="text-sm">{UI_LABELS.FILTER_HINT}</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>{UI_LABELS.CLEAR_FILTER}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSortedCameras.map((camera) => {
            // Dùng realtimeData.vc_ratio (từ image-process detection thực tế)
            // KHÔNG dùng calculation.vc_ratio (đó là forecast 5m từ image-predict)
            const vcRatio = camera.realtimeData?.vc_ratio ?? null;
            const trendDir = camera.trend.direction;
            return (
              <div
                key={camera.id}
                className="group relative rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => setSelectedCameraId(camera.shortId)}
              >
                {/* Camera image with status overlay */}
                <div className="relative h-40 overflow-hidden bg-muted">
                  <img
                    src={camera.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EKhông có ảnh%3C/text%3E%3C/svg%3E"}
                    alt={`Camera ${camera.shortId}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EKhông có ảnh%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  {/* Status badge top-left */}
                  <div className="absolute top-2 left-2">
                    {getStatusBadge(camera.status.current)}
                  </div>
                  {/* Trend badge top-right */}
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 backdrop-blur-sm bg-background/80 ${
                        trendDir === "increasing" ? "text-orange-700 border-orange-300" :
                        trendDir === "decreasing" ? "text-green-700 border-green-300" :
                        "text-gray-600 border-gray-300"
                      }`}
                    >
                      {trendDir === "increasing" ? <TrendingUpIcon className="size-3" /> :
                       trendDir === "decreasing" ? <TrendingDownIcon className="size-3" /> : null}
                      {getTrendLabel(trendDir)}
                    </Badge>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3 flex flex-col gap-2">
                  {/* Name + ID */}
                  <div>
                    <div className="font-semibold text-sm leading-snug line-clamp-2 truncate">
                      <HighlightText text={camera.name} query={searchQuery} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      <HighlightText text={camera.shortId} query={searchQuery} />
                    </div>
                  </div>

                  {/* Vehicle count + breakdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tabular-nums leading-none">{camera.totalObjects}</span>
                    <span className="text-xs text-muted-foreground">xe</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 flex items-center gap-0.5">
                        <IconCar className="size-3 shrink-0" />{camera.carCount}
                      </Badge>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400 flex items-center gap-0.5">
                        <IconMotorbike className="size-3 shrink-0" />{camera.motorbikeCount}
                      </Badge>
                    </div>
                  </div>

                  {/* V/C ratio bar */}
                  {vcRatio !== null && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{TRAFFIC_TERMS.VC_RATIO}</span>
                        <span className="text-[10px] font-semibold tabular-nums">{Math.round(vcRatio * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            vcRatio < 0.60 ? "bg-green-500" :
                            vcRatio < 0.75 ? "bg-emerald-400" :
                            vcRatio < 0.85 ? "bg-yellow-400" :
                            vcRatio < 1.0  ? "bg-orange-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(vcRatio * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Forecast 5m */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Dự Báo 5'</span>
                    {getStatusBadge(camera.status.forecast)}
                  </div>

                  {/* Last updated */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <IconClock className="size-3 shrink-0" />
                    {getRelativeTime(camera.lastUpdated)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet – controlled, single instance */}
      {selectedCamera && (
        <CameraDetailSheet
          camera={selectedCamera}
          open={!!selectedCamera}
          onOpenChange={(open) => !open && setSelectedCameraId(null)}
        />
      )}
    </div>
  );
}
