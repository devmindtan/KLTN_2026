import {
  TrendingDownIcon,
  TrendingUpIcon,
  ActivityIcon,
  CameraIcon,
  ShieldIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/custom/stat-card";
import {
  GENERAL_TERM,
  TREND_LABEL,
  getLOSLabel,
  DASHBOARD_TERM,
} from "@/lib/app-constants";

interface Metrics {
  totalVehicles: number;
  totalCars: number;
  totalMotorbikes: number;
  avgVehiclesPerCamera: number;
  activeCameras: number;
  goodStatus: number; // free_flow + smooth
  moderateStatus: number; // moderate
  badStatus: number; // heavy + congested
  trendingUp: number;
  trendingDown: number;
}

interface SectionCardsProps {
  metrics: Metrics;
  isConnected: boolean;
}

/** Cards tổng quan trạng thái giao thông realtime — dashboard header */
export function SectionCards({ metrics, isConnected }: SectionCardsProps) {
  const trendPercentage =
    metrics.activeCameras > 0
      ? Math.round((metrics.trendingUp / metrics.activeCameras) * 100)
      : 0;

  const badStatusPercentage =
    metrics.activeCameras > 0
      ? Math.round((metrics.badStatus / metrics.activeCameras) * 100)
      : 0;

  const isTrendingUp = metrics.trendingUp >= metrics.trendingDown;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Card 1 — Tổng Phương Tiện */}
      <StatCard
        title={DASHBOARD_TERM.card1.title}
        tooltip={DASHBOARD_TERM.card1.tooltips}
        headerRight={
          <>
            <ActivityIcon
              className={`size-4 ${isConnected ? "text-blue-500" : "text-muted-foreground"}`}
            />
          </>
        }
        value={
          <span className="flex items-end gap-2">
            {metrics.totalVehicles}
            <span className="text-sm font-normal text-muted-foreground mb-0.5">
              {metrics.avgVehiclesPerCamera} {GENERAL_TERM.vehicle} /{" "}
              {GENERAL_TERM.camera}
            </span>
          </span>
        }
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400"
            >
              {metrics.totalCars} {GENERAL_TERM.car}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400"
            >
              {metrics.totalMotorbikes} {GENERAL_TERM.motobike}
            </Badge>
          </div>
        }
      />

      {/* Card 2 — Camera Hoạt Động */}
      <StatCard
        title={DASHBOARD_TERM.card2.title}
        tooltip={DASHBOARD_TERM.card2.tooltips}
        headerRight={<CameraIcon className="size-4 text-purple-500" />}
        value={metrics.activeCameras}
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
            >
              {metrics.goodStatus} tốt
            </Badge>
            {metrics.moderateStatus > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400"
              >
                {metrics.moderateStatus} trung bình
              </Badge>
            )}
            {metrics.badStatus > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
              >
                {metrics.badStatus} tắc
              </Badge>
            )}
          </div>
        }
      />

      {/* Card 3 — Tình Trạng Giao Thông */}
      <StatCard
        title={DASHBOARD_TERM.card3.title}
        tooltip={DASHBOARD_TERM.card3.tooltips}
        headerRight={
          <ShieldIcon
            className={`size-4 ${badStatusPercentage > 50 ? "text-red-500" : "text-green-500"}`}
          />
        }
        value={
          <span className="flex items-end gap-2">
            {metrics.goodStatus}
            <span className="text-sm font-normal text-muted-foreground mb-0.5">
              / {metrics.activeCameras} {getLOSLabel("free_flow").toLowerCase()}
            </span>
          </span>
        }
        sub1={
          <>
            {metrics.activeCameras > 0 && (
              <div className="mt-3.5 flex h-1.5 rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-green-500 transition-all rounded-l-full"
                  style={{
                    width: `${(metrics.goodStatus / metrics.activeCameras) * 100}%`,
                  }}
                />
                <div
                  className="bg-yellow-400 transition-all"
                  style={{
                    width: `${(metrics.moderateStatus / metrics.activeCameras) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-500 transition-all rounded-r-full"
                  style={{
                    width: `${(metrics.badStatus / metrics.activeCameras) * 100}%`,
                  }}
                />
              </div>
            )}
          </>
        }
      />

      {/* Card 4 — Xu Hướng Giao Thông */}
      <StatCard
        title={DASHBOARD_TERM.card4.title}
        tooltip={DASHBOARD_TERM.card4.tooltips}
        headerRight={
          isTrendingUp ? (
            <TrendingUpIcon className="size-4 text-orange-500" />
          ) : (
            <TrendingDownIcon className="size-4 text-green-500" />
          )
        }
        value={`${trendPercentage}%`}
        sub1={
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400"
            >
              ↑ {metrics.trendingUp} {TREND_LABEL["increasing"].toLowerCase()}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
            >
              ↓ {metrics.trendingDown} {TREND_LABEL["decreasing"].toLowerCase()}
            </Badge>
          </div>
        }
      />
    </div>
  );
}
