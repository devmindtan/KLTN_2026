import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconMapPin, IconClock, IconActivity, IconSearch, IconFilter, IconX, IconLayoutGrid } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { HighlightText } from "@/components/custom/highlight-text";
import { CameraWallView } from "@/components/monitoring/camera-wall-view";
import { CameraDetailDialog } from "@/components/monitoring/camera-detail-dialog";
import { getStatusBadge } from "@/components/monitoring/camera-utils";
import { useSocket } from "@/contexts/SocketContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import * as React from "react";
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
  React.useEffect(() => {
    if (autoOpenCamId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [trendFilter, setTrendFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("name");

  const [viewMode, setViewMode] = React.useState<"cards" | "wall">("cards");
  const [wallPerPage, setWallPerPage] = React.useState<number>(9);
  const [wallCurrentPage, setWallCurrentPage] = React.useState<number>(1);

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
        title="Giám sát lưu lượng thời gian thực"
        description="Theo dõi lưu lượng giao thông tại các điểm quan trọng trong thành phố"
      >
        <Badge
          variant="outline"
          className={`flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0 ${
            isConnected ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
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
                <div className="relative flex-1">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo tên camera hoặc ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <IconFilter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="free_flow">Thông thoáng</SelectItem>
                      <SelectItem value="smooth">Ổn định</SelectItem>
                      <SelectItem value="moderate">Trung bình</SelectItem>
                      <SelectItem value="heavy">Nặng</SelectItem>
                      <SelectItem value="congested">Ùn tắc</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={trendFilter} onValueChange={setTrendFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Xu hướng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="increasing">Tăng</SelectItem>
                      <SelectItem value="stable">Ổn định</SelectItem>
                      <SelectItem value="decreasing">Giảm</SelectItem>
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
                    Xóa bộ lọc
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
              <p className="text-lg font-medium">Đang tải dữ liệu camera...</p>
              <p className="text-sm">Vui lòng đợi kết nối với hệ thống</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredAndSortedCameras.length === 0 ? (
        <Card>
          <CardContent className="flex h-[300px] items-center justify-center">
            <div className="text-center text-muted-foreground">
              <IconSearch className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Không tìm thấy camera</p>
              <p className="text-sm">Thử điều chỉnh bộ lọc hoặc tìm kiếm khác</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>Xóa bộ lọc</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {filteredAndSortedCameras.map((camera) => (
            <Card key={camera.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <IconMapPin className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">
                      <HighlightText text={camera.name} query={searchQuery} />
                    </CardTitle>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {getStatusBadge(camera.status.current)}
                  </div>
                </div>
                <CardDescription>ID: <HighlightText text={camera.shortId} query={searchQuery} /></CardDescription>
              </CardHeader>
              {camera.imageUrl && (
                <div className="px-6 pb-4">
                  <div className="rounded-lg border overflow-hidden">
                    <img
                      src={camera.imageUrl}
                      alt={`Camera ${camera.shortId}`}
                      className="w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EImage Not Available%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                </div>
              )}
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tổng phương tiện hiện tại:</span>
                    <span className="font-semibold">{camera.totalObjects} xe</span>
                  </div>
                  {camera.inputValue !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Trung bình 5p trước:</span>
                      <span className="text-sm text-muted-foreground">{camera.inputValue}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ô tô:</span>
                    <span className="text-sm">{camera.carCount} xe</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Xe máy:</span>
                    <span className="text-sm">{camera.motorbikeCount} xe</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Xu hướng:</span>
                    <span className="text-sm capitalize">
                      {camera.trend.direction === "increasing" ? "Tăng" : camera.trend.direction === "decreasing" ? "Giảm" : "Ổn định"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <IconClock className="w-3 h-3" />
                      Cập nhật:
                    </span>
                    <span className="text-sm">{getRelativeTime(camera.lastUpdated)}</span>
                  </div>
                  <Separator className="my-3" />
                  <CameraDetailDialog camera={camera} forceOpen={camera.shortId === autoOpenCamId} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
