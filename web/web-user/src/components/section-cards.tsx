import { TrendingDownIcon, TrendingUpIcon, ActivityIcon, CameraIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Metrics {
  totalVehicles: number;
  totalCars: number;
  totalMotorbikes: number;
  avgVehiclesPerCamera: number;
  activeCameras: number;
  goodStatus: number;        // free_flow + smooth
  moderateStatus: number;    // moderate
  badStatus: number;         // heavy + congested
  trendingUp: number;
  trendingDown: number;
}

interface SectionCardsProps {
  metrics: Metrics;
  isConnected: boolean;
}

export function SectionCards({ metrics, isConnected }: SectionCardsProps) {
  const trendPercentage = metrics.activeCameras > 0
    ? Math.round((metrics.trendingUp / metrics.activeCameras) * 100)
    : 0;

  const badStatusPercentage = metrics.activeCameras > 0
    ? Math.round((metrics.badStatus / metrics.activeCameras) * 100)
    : 0;

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Tổng Phương Tiện</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.totalVehicles}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className={`flex gap-1 rounded-lg text-xs ${
                isConnected ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
              }`}
            >
              <ActivityIcon className="size-3" />
              {isConnected ? "Trực tiếp" : "Mất kết nối"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Ô tô: {metrics.totalCars} • Xe máy: {metrics.totalMotorbikes}
          </div>
          <div className="text-muted-foreground">
            Phát hiện phương tiện thời gian thực
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Camera Hoạt Động</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.activeCameras}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <CameraIcon className="size-3" />
              Trực tuyến
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Trung bình: {metrics.avgVehiclesPerCamera} xe/camera
          </div>
          <div className="text-muted-foreground">
            Giám sát luồng giao thông
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Tình Trạng Giao Thông</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.goodStatus}/{metrics.activeCameras}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className={`flex gap-1 rounded-lg text-xs ${
                badStatusPercentage > 50
                  ? "bg-red-500/10 text-red-600"
                  : "bg-green-500/10 text-green-600"
              }`}
            >
              {badStatusPercentage > 50 ? "⚠️" : "✓"} {badStatusPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Đường thông thoáng được phát hiện
          </div>
          <div className="text-muted-foreground">
            {metrics.badStatus} camera có ùn tắc • {metrics.moderateStatus} trung bình
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Xu Hướng Giao Thông</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {trendPercentage}%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {metrics.trendingUp > metrics.trendingDown ? (
                <TrendingUpIcon className="size-3 text-orange-500" />
              ) : (
                <TrendingDownIcon className="size-3 text-green-500" />
              )}
              {metrics.trendingUp > metrics.trendingDown ? "Tăng" : "Giảm"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.trendingUp > metrics.trendingDown ? (
              <>Giao thông đang tăng <TrendingUpIcon className="size-4 text-orange-500" /></>
            ) : (
              <>Giao thông đang giảm <TrendingDownIcon className="size-4 text-green-500" /></>
            )}
          </div>
          <div className="text-muted-foreground">
            {metrics.trendingUp} tăng • {metrics.trendingDown} giảm
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
