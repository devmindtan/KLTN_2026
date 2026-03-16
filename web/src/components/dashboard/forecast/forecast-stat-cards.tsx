/**
 * ForecastStatCards – 4 thẻ thống kê tổng quan cho tab Dự báo
 * Tạm thời dùng mock data; thay bằng API khi backend sẵn sàng
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconTarget,
  IconHourglassHigh,
  IconLeaf,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconInfoCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { MOCK_FORECAST_SLOTS, MOCK_FORECAST_SUMMARY } from "./forecast-types";
import { getLOSLabel, METRIC_LABELS, TIME_LABEL } from "@/lib/app-constants";

// ─── LOS weight cho GTI ────────────────────────────────────────────────────
const LOS_WEIGHT: Record<string, number> = {
  free_flow: 0,
  smooth:    1,
  moderate:  2,
  heavy:     3,
  congested: 4,
};

/** Tính GTI (0–100) từ danh sách slot, scale: Σ(weight)/N × 25 */
function calcGti(los: string[]): number {
  if (!los.length) return 0;
  const sum = los.reduce((acc, l) => acc + (LOS_WEIGHT[l] ?? 2), 0);
  return Math.round((sum / los.length) * 25);
}

/** Phân loại trạng thái GTI theo ngưỡng (0–30 / 31–60 / 61–85 / >85) */
function classifyGti(score: number): string {
  if (score <= 30) return "Thông thoáng";
  if (score <= 60) return "Bình thường";
  if (score <= 85) return "Tắc nghẽn";
  return "Nguy cơ tắc nghẽn cao";
}

/** Format giây thành MM:SS */
function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Component 1 stat card với tooltip info */
function StatCard({
  label,
  value,
  sub,
  icon,
  valueClass,
  tooltip,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  valueClass?: string;
  tooltip: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        {/* Header: label + icon + info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-tight truncate">{label}</p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 cursor-help text-muted-foreground/60 hover:text-muted-foreground">
                    <IconInfoCircle className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-xs leading-snug">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="shrink-0 opacity-80">{icon}</div>
        </div>

        {/* Value + sub */}
        <div className="min-w-0">
          <p className={cn("text-2xl font-bold tabular-nums leading-tight truncate", valueClass)}>
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** 4 stat cards tổng quan dự báo – dùng mock data nội bộ */
export function ForecastStatCards() {
  // ── Card 2: Đếm ngược đến chu kỳ tiếp theo ──────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const now = new Date();
    return 300 - ((now.getSeconds() + (now.getMinutes() % 5) * 60));
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setSecondsLeft(300 - ((now.getSeconds() + (now.getMinutes() % 5) * 60)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Card 3: Số camera thông thoáng trong slot tiếp theo ─────────────────
  const goodCameraCount = useMemo(() => {
    // Lấy slot chưa có actual (slot tiếp theo)
    const nextSlots = MOCK_FORECAST_SLOTS.filter(
      (s) => s.actualVehicles === null && s.duration === 5,
    );
    // Chọn timeSlot sớm nhất trong tương lai
    if (!nextSlots.length) return 0;
    const earliest = nextSlots.reduce((a, b) =>
      a.timeSlot < b.timeSlot ? a : b,
    ).timeSlot;
    const atEarliest = nextSlots.filter((s) => s.timeSlot === earliest);
    // Đếm unique camera có LOS thông thoáng hoặc trôi chảy
    const goodIds = new Set(
      atEarliest
        .filter((s) => s.predictedLos === "free_flow" || s.predictedLos === "smooth")
        .map((s) => s.camId),
    );
    return goodIds.size;
  }, []);

  const totalCamInNextSlot = useMemo(() => {
    const nextSlots = MOCK_FORECAST_SLOTS.filter(
      (s) => s.actualVehicles === null && s.duration === 5,
    );
    if (!nextSlots.length) return 0;
    const earliest = nextSlots.reduce((a, b) =>
      a.timeSlot < b.timeSlot ? a : b,
    ).timeSlot;
    return new Set(nextSlots.filter((s) => s.timeSlot === earliest).map((s) => s.camId)).size;
  }, []);

  // ── Card 4: GTI hiện tại vs hôm qua cùng giờ ───────────────────────────
  const { gtiCurrent, gtiDelta } = useMemo(() => {
    const nextSlots = MOCK_FORECAST_SLOTS.filter(
      (s) => s.actualVehicles === null && s.duration === 5,
    );
    const earliest = nextSlots.length
      ? nextSlots.reduce((a, b) => (a.timeSlot < b.timeSlot ? a : b)).timeSlot
      : null;
    const losValues = earliest
      ? MOCK_FORECAST_SLOTS.filter((s) => s.timeSlot === earliest).map((s) => s.predictedLos)
      : MOCK_FORECAST_SLOTS.map((s) => s.predictedLos);

    const current = calcGti(losValues);
    // Mock: hôm qua cùng giờ thấp hơn ~8%
    const yesterday = Math.round(current * 0.92);
    return { gtiCurrent: current, gtiYesterday: yesterday, gtiDelta: current - yesterday };
  }, []);

  const gtiTrendIcon =
    gtiDelta > 0 ? <IconTrendingUp  className="size-5 text-orange-500" /> :
    gtiDelta < 0 ? <IconTrendingDown className="size-5 text-green-500"  /> :
                   <IconMinus        className="size-5 text-muted-foreground" />;

  const gtiValueClass =
    gtiDelta > 0 ? "text-orange-600 dark:text-orange-400" :
    gtiDelta < 0 ? "text-green-600 dark:text-green-400"   :
                   "text-foreground";

  const gtiTrendLabel =
    gtiDelta > 0 ? `↑ +${gtiDelta} so hôm qua` :
    gtiDelta < 0 ? `↓ ${gtiDelta} so hôm qua`   :
                   "Bằng hôm qua";

  // ── Card 1: Độ chính xác ─────────────────────────────────────────────────
  const summary = MOCK_FORECAST_SUMMARY;
  const accuracyClass =
    (summary.avgAccuracy ?? 0) >= 90 ? "text-green-600 dark:text-green-400" :
    (summary.avgAccuracy ?? 0) >= 75 ? "text-yellow-600 dark:text-yellow-400" :
                                       "text-red-600 dark:text-red-400";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Card 1 – Độ chính xác */}
      <StatCard
        label="Độ chính xác hôm nay"
        value={summary.avgAccuracy != null ? `${summary.avgAccuracy}%` : "—"}
        sub={`${METRIC_LABELS.MAE}: ${summary.mae} xe / ${TIME_LABEL["5m"]}`}
        icon={<IconTarget className="size-5 text-green-500" />}
        valueClass={accuracyClass}
        tooltip={<span>Độ chính xác = 100% − MAPE. <strong>{METRIC_LABELS.MAE}</strong> = sai lệch trung bình tuyệt đối (xe / {TIME_LABEL["5m"]}).</span>}
      />

      {/* Card 2 – Đếm ngược */}
      <StatCard
        label="Chu kỳ tiếp theo"
        value={fmtCountdown(secondsLeft < 0 ? 0 : secondsLeft)}
        sub="Chu kỳ dự báo: mỗi 5 phút"
        icon={<IconHourglassHigh className="size-5 text-blue-500" />}
        valueClass="text-blue-600 dark:text-blue-400 font-mono"
        tooltip={<span>Dự báo chạy <strong>mỗi 5 phút cố định</strong>. Đếm ngược đến chu kỳ tiếp theo.</span>}
      />

      {/* Card 3 – Camera thông thoáng */}
      <StatCard
        label="Camera thông thoáng"
        value={`${goodCameraCount} / ${totalCamInNextSlot}`}
        sub="dự báo slot tiếp theo"
        icon={<IconLeaf className="size-5 text-teal-500" />}
        valueClass={
          goodCameraCount === totalCamInNextSlot && totalCamInNextSlot > 0
            ? "text-teal-600 dark:text-teal-400"
            : goodCameraCount > 0
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-muted-foreground"
        }
        tooltip={<span>Camera có <strong>LOS dự báo</strong> {getLOSLabel("free_flow")} hoặc {getLOSLabel("smooth")} trong slot 5 phút tiếp theo.</span>}
      />

      {/* Card 4 – GTI */}
      <StatCard
        label="Chỉ số tắc nghẽn (GTI)"
        value={`${gtiCurrent}%`}
        sub={`${classifyGti(gtiCurrent)} · ${gtiTrendLabel}`}
        icon={gtiTrendIcon}
        valueClass={gtiValueClass}
        tooltip={<span>GTI 0–100: Thông thoáng ≤30 · Bình thường 31–60 · Bắt đầu tắc 61–85 · Nguy cơ cao &gt;85.</span>}
      />
    </div>
  );
}
