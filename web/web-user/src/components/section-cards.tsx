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
  clearStatus: number;
  congestionStatus: number;
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

  const congestionPercentage = metrics.activeCameras > 0
    ? Math.round((metrics.congestionStatus / metrics.activeCameras) * 100)
    : 0;

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Total Vehicles</CardDescription>
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
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Cars: {metrics.totalCars} • Motorbikes: {metrics.totalMotorbikes}
          </div>
          <div className="text-muted-foreground">
            Real-time vehicle detection
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Active Cameras</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.activeCameras}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <CameraIcon className="size-3" />
              Online
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Avg: {metrics.avgVehiclesPerCamera} vehicles/cam
          </div>
          <div className="text-muted-foreground">
            Monitoring traffic flow
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Traffic Status</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.clearStatus}/{metrics.activeCameras}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className={`flex gap-1 rounded-lg text-xs ${
                congestionPercentage > 50
                  ? "bg-red-500/10 text-red-600"
                  : "bg-green-500/10 text-green-600"
              }`}
            >
              {congestionPercentage > 50 ? "⚠️" : "✓"} {congestionPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Clear roads detected
          </div>
          <div className="text-muted-foreground">
            {metrics.congestionStatus} cameras show congestion
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Traffic Trend</CardDescription>
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
              {metrics.trendingUp > metrics.trendingDown ? "Up" : "Down"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.trendingUp > metrics.trendingDown ? (
              <>Traffic increasing <TrendingUpIcon className="size-4 text-orange-500" /></>
            ) : (
              <>Traffic decreasing <TrendingDownIcon className="size-4 text-green-500" /></>
            )}
          </div>
          <div className="text-muted-foreground">
            {metrics.trendingUp} up • {metrics.trendingDown} down
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
