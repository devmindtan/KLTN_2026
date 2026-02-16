import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconMapPin, IconClock, IconAlertTriangle, IconCheck, IconActivity, IconInfoCircle, IconSearch, IconFilter, IconX } from "@tabler/icons-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useSocket, type CameraData } from "@/contexts/SocketContext";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Hiển thị badge theo Level of Service (LOS)
 */
const getStatusBadge = (status: string) => {
  switch (status) {
    case "free_flow":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><IconCheck className="w-3 h-3 mr-1" />Thông thoáng</Badge>;
    case "smooth":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><IconCheck className="w-3 h-3 mr-1" />Ổn định</Badge>;
    case "moderate":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Trung bình</Badge>;
    case "heavy":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Nặng</Badge>;
    case "congested":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Ùn tắc</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Không rõ</Badge>;
  }
};

// Chart config for forecast
const forecastChartConfig = {
  vehicles: {
    label: "Vehicles",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export default function TrafficMonitoring() {
  const { processedCameras, isConnected } = useSocket();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [trendFilter, setTrendFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("name");

  // Hàm format thời gian relative từ timestamp (chỉ hiển thị phút trở lên)
  const getRelativeTime = (timestamp: string) => {
    if (!timestamp) return "Chưa cập nhật";
    
    const now = Date.now();
    const lastUpdate = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - lastUpdate) / 1000);

    if (diffInSeconds < 60) return `Vừa xong`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  };

  // Filter và sort cameras
  const filteredAndSortedCameras = React.useMemo(() => {
    const filtered = processedCameras.filter((camera) => {
      // Search filter
      const matchesSearch = searchQuery.trim() === "" ||
        camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        camera.shortId.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter - dùng status từ backend (LOS)
      const matchesStatus = statusFilter === "all" || camera.status === statusFilter;

      // Trend filter
      const matchesTrend = trendFilter === "all" || camera.trend === trendFilter;

      return matchesSearch && matchesStatus && matchesTrend;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "vehicles-high":
          return b.totalObjects - a.totalObjects;
        case "vehicles-low":
          return a.totalObjects - b.totalObjects;
        case "updated":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [processedCameras, searchQuery, statusFilter, trendFilter, sortBy]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || trendFilter !== "all" || sortBy !== "name";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTrendFilter("all");
    setSortBy("name");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Giám Sát Lưu Lượng Thời Gian Thực</h1>
          <p className="text-sm text-muted-foreground mt-1">Theo dõi lưu lượng giao thông tại các điểm quan trọng trong thành phố</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
            <IconActivity className="w-3 h-3" />
            {isConnected ? "Đã Kết nối" : "Mất kết nối"}
          </Badge>
        </div>
      </div>
      
      {/* Search and Filters */}
      {processedCameras.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo tên camera hoặc ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Filters */}
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
              
              {/* Active filters badge */}
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
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {filteredAndSortedCameras.map((camera) => {
            return (
              <Card key={camera.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconMapPin className="w-5 h-5 text-primary" />
                      <CardTitle className="text-base">{camera.name}</CardTitle>
                    </div>
                    {getStatusBadge(camera.status)}
                  </div>
                  <CardDescription>Camera {camera.shortId}</CardDescription>
                </CardHeader>
                {/* Camera Image */}
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
                      <span className="text-sm text-muted-foreground">Tổng phương tiện:</span>
                      <span className="font-semibold">{camera.totalObjects} xe</span>
                    </div>
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
                      <span className="text-sm capitalize">{camera.trend === "increasing" ? "Tăng" : camera.trend === "decreasing" ? "Giảm" : "Ổn định"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconClock className="w-3 h-3" />
                        Cập nhật:
                      </span>
                      <span className="text-sm">{getRelativeTime(camera.lastUpdated)}</span>
                    </div>
                    <Separator className="my-3" />
                    <CameraDetailDialog camera={camera} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Camera Detail Dialog Component
function CameraDetailDialog({ camera }: { camera: CameraData }) {
  const isMobile = useIsMobile();

  // Transform forecasts to chart data
  const forecastData = [
    { time: "5 min", vehicles: Math.round(camera.forecasts["5m"]) },
    { time: "10 min", vehicles: Math.round(camera.forecasts["10m"]) },
    { time: "15 min", vehicles: Math.round(camera.forecasts["15m"]) },
    { time: "30 min", vehicles: Math.round(camera.forecasts["30m"]) },
    { time: "60 min", vehicles: Math.round(camera.forecasts["60m"]) },
  ];


  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="sm">
          <IconInfoCircle className="w-4 h-4 mr-2" />
          Xem thông tin chi tiết
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{camera.name}</DialogTitle>
          <DialogDescription>
            Camera ID: {camera.shortId} • Thông tin chi tiết và dự đoán lưu lượng giao thông
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-4 py-4 text-sm">
          {/* Camera Image */}
          {camera.imageUrl && (
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
          )}

          <Separator />

          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tổng phương tiện</Label>
              <div className="text-2xl font-bold tabular-nums">{camera.totalObjects}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Trạng thái</Label>
              {getStatusBadge(camera.status)}
              {}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ô tô</Label>
              <div className="text-xl font-semibold tabular-nums">🚗 {camera.carCount}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Xe máy</Label>
              <div className="text-xl font-semibold tabular-nums">🏍️ {camera.motorbikeCount}</div>
            </div>
          </div>

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Dự báo lưu lượng giao thông</Label>
                <ChartContainer config={forecastChartConfig} className="h-[200px]">
                  <AreaChart
                    accessibilityLayer
                    data={forecastData}
                    margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                      dataKey="vehicles"
                      type="monotone"
                      fill="var(--color-vehicles)"
                      fillOpacity={0.4}
                      stroke="var(--color-vehicles)"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
              <Separator />
            </>
          )}

          {/* Forecast Values */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Dự đoán số lượng phương tiện</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">5 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(camera.forecasts["5m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">15 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(camera.forecasts["15m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">60 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(camera.forecasts["60m"])}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Xu hướng</Label>
              <Badge variant="outline" className="flex gap-1">
                {camera.trend === "increasing" ? (
                  <TrendingUpIcon className="size-3 text-orange-500" />
                ) : camera.trend === "decreasing" ? (
                  <TrendingDownIcon className="size-3 text-green-500" />
                ) : null}
                {camera.trend === "increasing" ? "Tăng" : camera.trend === "decreasing" ? "Giảm" : "Ổn định"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Cập nhật lần cuối</Label>
              <span className="text-xs">
                {camera.lastUpdated
                  ? new Date(camera.lastUpdated).toLocaleString("vi-VN")
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Dự đoán lần cuối</Label>
              <span className="text-xs">
                {camera.lastPredicted
                  ? new Date(camera.lastPredicted).toLocaleString("vi-VN")
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mã Camera</Label>
              <span className="font-mono text-xs">{camera.shortId}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Vị trí</Label>
              <span className="text-xs">{camera.name}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
