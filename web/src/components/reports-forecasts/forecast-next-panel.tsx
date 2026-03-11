/**
 * ForecastNextPanel – Zone 3: Chi tiết dự báo khung giờ tiếp theo
 * Hiển thị từng camera: dự báo xe, LOS, Δ so với TB 7 ngày
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  IconClock,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ForecastSlot } from "./reports-types";
import { LOS_LABEL, MOCK_FORECAST_SLOTS } from "./reports-types";

const LOS_BADGE: Record<string, string> = {
  free_flow: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  smooth:    "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  moderate:  "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  heavy:     "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  congested: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

const RISK_BADGE: Record<ForecastSlot["riskLevel"], string> = {
  low:    "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  medium: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  high:   "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};
interface Props {
  slots?: ForecastSlot[];
  /** ISO datetime của khung giờ tiếp theo */
  nextSlotTime?: string;
}

/** Panel chi tiết dự báo khung giờ tiếp theo (tất cả camera) */
export function ForecastNextPanel({ slots = MOCK_FORECAST_SLOTS, nextSlotTime }: Props) {
  // Lấy slot tương lai gần nhất (actualVehicles === null)
  const futureSlots = slots.filter(s => s.actualVehicles === null);
  const nextTime = nextSlotTime ?? futureSlots[0]?.timeSlot;

  const nextSlots = nextTime
    ? futureSlots.filter(s => s.timeSlot === nextTime)
    : [];

  const highRisk = nextSlots.filter(s => s.riskLevel === "high");
  const avgConfidence = nextSlots.length > 0
    ? Math.round(nextSlots.reduce((a, s) => a + s.confidence, 0) / nextSlots.length)
    : 0;

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <IconClock className="size-4 text-primary" />
          Dự báo khung giờ tiếp theo
        </CardTitle>
        {nextTime && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold tabular-nums">{fmtTime(nextTime)}</span>
            {highRisk.length > 0 && (
              <Badge variant="outline" className={RISK_BADGE.high}>
                <IconAlertTriangle className="size-3 mr-1" />
                {highRisk.length} nguy cơ cao
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        {/* Độ tin cậy tổng */}
        {nextSlots.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Độ tin cậy trung bình</span>
              <span className="font-semibold">{avgConfidence}%</span>
            </div>
            <Progress value={avgConfidence} className="h-1.5" />
          </div>
        )}

        {/* Danh sách camera */}
        <div className="flex flex-col divide-y">
          {nextSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Không có dữ liệu dự báo</p>
          ) : (
            nextSlots.map(slot => {
              const delta = slot.deltaVsWeekAvg;
              const DeltaIcon = delta == null ? IconMinus : delta > 0 ? IconTrendingUp : IconTrendingDown;
              const deltaColor = delta == null ? "text-muted-foreground" :
                                 delta > 10   ? "text-red-600 dark:text-red-400" :
                                 delta > 0    ? "text-orange-600 dark:text-orange-400" :
                                                "text-green-600 dark:text-green-400";
              return (
                <div key={slot.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{slot.camName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground tabular-nums">{slot.predictedVehicles} xe</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", LOS_BADGE[slot.predictedLos] ?? "")}
                      >
                        {LOS_LABEL[slot.predictedLos] ?? slot.predictedLos}
                      </Badge>
                    </div>
                  </div>
                  {delta != null && (
                    <div className={cn("flex items-center gap-0.5 text-xs font-medium shrink-0 mt-0.5", deltaColor)}>
                      <DeltaIcon className="size-3.5" />
                      {delta > 0 ? `+${delta}` : delta}%
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer tóm tắt */}
        {nextSlots.length > 0 && (
          <div className="mt-auto pt-2 border-t flex flex-col gap-1 text-[11px] text-muted-foreground">
            {highRisk.length > 0 && (
              <div className="flex items-center gap-1 text-red-500">
                <IconAlertTriangle className="size-3" />
                {highRisk.length} điểm nguy cơ ùn tắc cao
              </div>
            )}
            <span>Mô hình: {nextSlots[0]?.modelVersion}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
