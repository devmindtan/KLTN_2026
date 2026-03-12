import {
  TrendingDownIcon,
  TrendingUpIcon,
  ActivityIcon,
  CameraIcon,
  ShieldIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/custom/stat-card"

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

/** Cards tổng quan trạng thái giao thông realtime — dashboard header */
export function SectionCards({ metrics, isConnected }: SectionCardsProps) {
  const trendPercentage = metrics.activeCameras > 0
    ? Math.round((metrics.trendingUp / metrics.activeCameras) * 100)
    : 0;

  const badStatusPercentage = metrics.activeCameras > 0
    ? Math.round((metrics.badStatus / metrics.activeCameras) * 100)
    : 0;

  const isTrendingUp = metrics.trendingUp >= metrics.trendingDown;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

      {/* Card 1 — Tổng Phương Tiện */}
      <StatCard
        title="Tổng Phương Tiện"
        tooltip="Tổng số phương tiện được phát hiện trên toàn bộ camera đang hoạt động"
        headerRight={
          <>
            <span className={`size-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <ActivityIcon className={`size-4 ${isConnected ? "text-blue-500" : "text-muted-foreground"}`} />
          </>
        }
        value={metrics.totalVehicles.toLocaleString()}
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">
              {metrics.totalCars} ô tô
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400">
              {metrics.totalMotorbikes} xe máy
            </Badge>
          </div>
        }
        sub2={
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {isConnected ? "Phát hiện thời gian thực" : "Mất kết nối socket"}
          </p>
        }
      />

      {/* Card 2 — Camera Hoạt Động */}
      <StatCard
        title="Camera Hoạt Động"
        tooltip="Số camera đang gửi dữ liệu về hệ thống. Mỗi camera được phân loại theo mức độ giao thông LOS."
        headerRight={<CameraIcon className="size-4 text-purple-500" />}
        value={metrics.activeCameras}
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
              {metrics.goodStatus} tốt
            </Badge>
            {metrics.moderateStatus > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">
                {metrics.moderateStatus} trung bình
              </Badge>
            )}
            {metrics.badStatus > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">
                {metrics.badStatus} tắc
              </Badge>
            )}
          </div>
        }
        sub2={
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Trung bình {metrics.avgVehiclesPerCamera} xe / camera
          </p>
        }
      />

      {/* Card 3 — Tình Trạng Giao Thông */}
      <StatCard
        title="Tình Trạng Giao Thông"
        tooltip="Số camera ở trạng thái thông thoáng (LOS A-B). Thanh màu phản ánh tỉ lệ xanh/vàng/đỏ."
        headerRight={
          <ShieldIcon className={`size-4 ${badStatusPercentage > 50 ? "text-red-500" : "text-green-500"}`} />
        }
        value={
          <span className="flex items-end gap-2">
            {metrics.goodStatus}
            <span className="text-sm font-normal text-muted-foreground mb-0.5">/ {metrics.activeCameras} thông thoáng</span>
          </span>
        }
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            {metrics.badStatus > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">
                {metrics.badStatus} ùn tắc
              </Badge>
            )}
            {metrics.moderateStatus > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">
                {metrics.moderateStatus} trung bình
              </Badge>
            )}
          </div>
        }
        sub2={
          <>
            <p className="text-[11px] text-muted-foreground mt-1">{badStatusPercentage}% camera có tắc nghẽn</p>
            {metrics.activeCameras > 0 && (
              <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-muted">
                <div className="bg-green-500 transition-all rounded-l-full" style={{ width: `${(metrics.goodStatus / metrics.activeCameras) * 100}%` }} />
                <div className="bg-yellow-400 transition-all" style={{ width: `${(metrics.moderateStatus / metrics.activeCameras) * 100}%` }} />
                <div className="bg-red-500 transition-all rounded-r-full" style={{ width: `${(metrics.badStatus / metrics.activeCameras) * 100}%` }} />
              </div>
            )}
          </>
        }
      />

      {/* Card 4 — Xu Hướng Giao Thông */}
      <StatCard
        title="Xu Hướng Mạng Lưới"
        tooltip="Tỉ lệ % camera đang có xu hướng tăng lưu lượng so với chu kỳ trước."
        headerRight={
          isTrendingUp
            ? <TrendingUpIcon className="size-4 text-orange-500" />
            : <TrendingDownIcon className="size-4 text-green-500" />
        }
        value={`${trendPercentage}%`}
        sub1={
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isTrendingUp ? "Mật độ đang tăng" : "Mật độ đang giảm"}
          </p>
        }
        sub2={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
              ↑ {metrics.trendingUp} tăng
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
              ↓ {metrics.trendingDown} giảm
            </Badge>
          </div>
        }
      />

    </div>
  )
}

