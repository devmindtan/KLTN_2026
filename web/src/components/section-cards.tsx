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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 px-6">
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Tổng Phương Tiện</CardDescription>
            <Badge
              variant="outline"
              className={`flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0 ${
                isConnected ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
              }`}
            >
              <ActivityIcon className="size-3 shrink-0" />
              {isConnected ? "Trực tiếp" : "Mất kết nối"}
            </Badge>
          </div>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.totalVehicles}
          </CardTitle>
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
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Camera Hoạt Động</CardDescription>
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0">
              <CameraIcon className="size-3 shrink-0" />
              Trực tuyến
            </Badge>
          </div>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.activeCameras}
          </CardTitle>
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
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Tình Trạng Giao Thông</CardDescription>
            <Badge
              variant="outline"
              className={`flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0 ${
                badStatusPercentage > 50
                  ? "bg-red-500/10 text-red-600"
                  : "bg-green-500/10 text-green-600"
              }`}
            >
              {badStatusPercentage > 50 ? "⚠️" : "✓"} {badStatusPercentage}%
            </Badge>
          </div>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.goodStatus}/{metrics.activeCameras}
          </CardTitle>
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
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Xu Hướng Giao Thông</CardDescription>
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs whitespace-nowrap shrink-0">
              {metrics.trendingUp > metrics.trendingDown ? (
                <TrendingUpIcon className="size-3 shrink-0 text-orange-500" />
              ) : (
                <TrendingDownIcon className="size-3 shrink-0 text-green-500" />
              )}
              {metrics.trendingUp > metrics.trendingDown ? "Tăng" : "Giảm"}
            </Badge>
          </div>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {trendPercentage}%
          </CardTitle>
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
