/**
 * ForecastStatCards – 4 thẻ thống kê tổng quan cho tab Dự báo
 * Nhận `apiData` từ dashboard cha (đảm bảo cùng snapshot với ForecastRollingChart)
 * Card 1: Mức tải V/C hiện tại | Card 2: Đếm ngược | Card 3: Đỉnh 60p | Card 4: Xu hướng 1h
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
  IconHourglassHigh,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconInfoCircle,
  IconGauge,
  IconChartBar,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getLOSLabel } from "@/lib/app-constants";
import type { ForecastRollingResponse } from "@/services/forecast.service";

/** Format giây thành MM:SS */
function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Trả về Tailwind className theo LOS key */
function losTextClass(los: string): string {
  switch (los) {
    case "free_flow":
      return "text-green-600 dark:text-green-400";
    case "smooth":
      return "text-emerald-600 dark:text-emerald-400";
    case "moderate":
      return "text-yellow-600 dark:text-yellow-400";
    case "heavy":
      return "text-orange-600 dark:text-orange-400";
    case "congested":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

/** Suy ra LOS key từ V/C ratio (%) để có màu khi slot chỉ có currentRatio */
function ratioToLos(ratio: number): string {
  if (ratio <= 30) return "free_flow";
  if (ratio <= 55) return "smooth";
  if (ratio <= 75) return "moderate";
  if (ratio <= 100) return "heavy";
  return "congested";
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
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {label}
            </p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 cursor-help text-muted-foreground/60 hover:text-muted-foreground">
                    <IconInfoCircle className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-64 text-xs leading-snug"
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="shrink-0 opacity-80">{icon}</div>
        </div>

        {/* Value + sub */}
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-bold tabular-nums leading-tight truncate",
              valueClass,
            )}
          >
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {sub}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** 4 stat cards tổng quan dự báo – nhận apiData từ dashboard cha (cùng snapshot với RollingChart) */
export function ForecastStatCards({
  apiData,
}: {
  apiData: ForecastRollingResponse | null;
}) {
  // ── Card 2: Đếm ngược đến chu kỳ tiếp theo ──────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const now = new Date();
    return 300 - (now.getSeconds() + (now.getMinutes() % 5) * 60);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setSecondsLeft(300 - (now.getSeconds() + (now.getMinutes() % 5) * 60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Các metric từ rolling API ──────────────────────────────────────────
  const { card1, card3, card4 } = useMemo(() => {
    const empty = { card1: null, card3: null, card4: null };
    if (!apiData) return empty;

    const allSlots = apiData.cameras["all"]?.slots ?? [];
    const capacity =
      apiData.capacities?.["all"] ?? apiData.cameras["all"]?.capacity ?? 100;
    const nowTime = apiData.metadata.nowTime; // "HH:MM"

    // Build map time → slot để lookup chính xác như chart (tránh lỗi index arithmetic trên mảng sparse)
    const slotByTime = new Map(allSlots.map((s) => [s.t, s]));

    /** Tính thời điểm HH:MM từ nowTime + offsetMinutes */
    function addMinutes(base: string, offsetMin: number): string {
      const [h, m] = base.split(":").map(Number);
      const total = h * 60 + m + offsetMin;
      return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    // Slot NOW chính xác theo nowTime (giống chart's CLIENT_NOW_INDEX)
    const nowSlotRaw = slotByTime.get(nowTime);

    // Slot NOW: dùng trực tiếp nowTime, fallback backward (giống chart's actualAtNow = actual ?? f5m)
    // KHÔNG search backward cho actual-only vì sync có thể chậm hơn forecast MV
    const nowIdx = allSlots.findIndex((s) => s.t === nowTime);
    const baseIdx = nowIdx >= 0 ? nowIdx : allSlots.length - 1;
    const nowSlotIdx = (() => {
      for (let i = baseIdx; i >= 0; i--) {
        if (allSlots[i].actual != null || allSlots[i].f5m != null) return i;
      }
      return -1;
    })();

    if (nowSlotIdx < 0) return empty;

    const nowSlot = allSlots[nowSlotIdx];
    // Khớp với chart's actualAtNow: actual ?? f5m tại chính slot nowTime
    const currentVeh = nowSlot.actual ?? nowSlot.f5m!;
    // Tính ratio trực tiếp từ currentVeh / capacity để khớp với hiển thị "X / Y xe"
    // KHÔNG dùng nowSlot.currentRatio vì đó là trung bình vc_ratio từng camera (có thể lệch)
    // 1 chữ số thập phân để tránh sai số khi hiển thị (e.g. 17.4/37 = 47.0% chứ không phải 47%)
    const currentRatio = Math.round((currentVeh / capacity) * 1000) / 10;
    const losKey = ratioToLos(currentRatio);
    const losLabel = getLOSLabel(losKey);

    // Δ vs 30 phút trước (6 slots back từ nowSlotIdx)
    const prevIdx = Math.max(0, nowSlotIdx - 6);
    const prevSlot = allSlots[prevIdx];
    const prevVeh = prevSlot?.actual ?? prevSlot?.f5m ?? null;
    const prevRatio =
      prevVeh != null ? Math.round((prevVeh / capacity) * 1000) / 10 : null;
    const deltaRatio = prevRatio != null ? currentRatio - prevRatio : null;

    // ── Card 3: Đỉnh dự báo trong 5 mốc tới (toàn mạng lưới) ─────────────
    // Tra cứu theo time string để đảm bảo đúng slot, bất kể mảng sparse hay dense
    const HORIZON_LABELS: Record<string, string> = {
      f5m: "5 phút",
      f10m: "10 phút",
      f15m: "15 phút",
      f30m: "30 phút",
      f60m: "60 phút",
    };
    const HORIZON_MINUTES: Record<string, number> = {
      f5m: 5,
      f10m: 10,
      f15m: 15,
      f30m: 30,
      f60m: 60,
    };

    let peakVeh = -1;
    let peakRatio = -1;
    let peakTime = "—";
    let peakLos = "moderate";
    let peakHorizon = "";

    Object.entries(HORIZON_MINUTES).forEach(([key, offsetMin]) => {
      const targetTime = addMinutes(nowTime, offsetMin);
      const targetSlot =
        slotByTime.get(targetTime) ?? (nowSlotRaw ? undefined : null);
      if (!targetSlot) return;
      const fVal = targetSlot[key as keyof typeof targetSlot] as number | null;
      if (fVal == null) return;
      // Ưu tiên so sánh số xe thực để consistent với chart (không phụ thuộc capacity)
      if (fVal > peakVeh) {
        peakVeh = fVal;
        peakRatio = Math.round(Math.min(1500, (fVal / capacity) * 1000)) / 10;
        peakTime = targetSlot.t;
        peakLos = ratioToLos(peakRatio);
        peakHorizon = HORIZON_LABELS[key] ?? key;
      }
    });

    // ── Card 4: Xu hướng 60 phút tới ──────────────────────────────────
    // Dùng time-string lookup, khớp chính xác với chart's f60m dot
    const f60mTime = addMinutes(nowTime, 60);
    const f60mSlot = slotByTime.get(f60mTime);
    const f60mVal = (f60mSlot?.["f60m"] as number | null) ?? null;
    const trendDelta = f60mVal != null ? f60mVal - currentVeh : null;
    const trendPct =
      f60mVal != null && currentVeh > 0
        ? Math.round(((f60mVal - currentVeh) / currentVeh) * 1000) / 10
        : null;

    return {
      card1: {
        currentVeh,
        capacity,
        currentRatio,
        losKey,
        losLabel,
        deltaRatio,
      },
      card3:
        peakVeh >= 0
          ? {
              peakVeh,
              peakRatio,
              peakTime,
              peakLos,
              peakLosLabel: getLOSLabel(peakLos),
              peakHorizon,
            }
          : null,
      card4:
        trendDelta != null
          ? { trendDelta, trendPct, currentVeh, f60mVal: f60mVal! }
          : null,
    };
  }, [apiData]);

  // ── Card 1: Mức tải V/C hiện tại ─────────────────────────────────────
  const c1ValueClass = card1
    ? losTextClass(card1.losKey)
    : "text-muted-foreground";
  // Format: "30 / 40 xe"  (actual / capacity)
  const c1Value = card1 ? `${card1.currentVeh} / ${card1.capacity} xe` : "—";
  const c1DeltaStr =
    card1?.deltaRatio != null && card1.deltaRatio !== 0
      ? card1.deltaRatio > 0
        ? `↑ ${card1.deltaRatio.toFixed(1)}% so 30p trước`
        : `↓ ${Math.abs(card1.deltaRatio).toFixed(1)}% so 30p trước`
      : "";
  // Sub: "(47.0%) · Đông đúc · ↑ +3.2% so 30p trước"
  const c1Sub = card1
    ? `${card1.currentRatio.toFixed(1)}% · ${card1.losLabel}${c1DeltaStr ? " · " + c1DeltaStr : ""}`
    : "Đang tải...";

  const c1Icon = (
    <IconGauge
      className={cn(
        "size-5",
        card1 ? losTextClass(card1.losKey) : "text-muted-foreground",
      )}
    />
  );

  // ── Card 3: Đỉnh dự báo 5 mốc tới ────────────────────────────────────
  const c3ValueClass = card3
    ? losTextClass(card3.peakLos)
    : "text-muted-foreground";
  // Format: "68 xe"  (số xe dự báo cao nhất)
  const c3Value = card3 ? `${card3.peakVeh.toFixed(1)} xe` : "—";
  // Sub: "87.0% · Đông đúc · +60 phút (lúc 18:30)"
  const c3Sub = card3
    ? `${card3.peakRatio.toFixed(1)}% · ${card3.peakLosLabel} · +60p (lúc ${card3.peakTime})`
    : "Chưa có dự báo";

  const c3Icon = (
    <IconChartBar
      className={cn(
        "size-5",
        card3 ? losTextClass(card3.peakLos) : "text-muted-foreground",
      )}
    />
  );

  // ── Card 4: Xu hướng 1 giờ tới ────────────────────────────────────────
  const trendUp = (card4?.trendDelta ?? 0) > 0;
  const trendDown = (card4?.trendDelta ?? 0) < 0;
  const c4ValueClass = trendUp
    ? "text-orange-600 dark:text-orange-400"
    : trendDown
      ? "text-green-600 dark:text-green-400"
      : "text-foreground";
  const c4Value = card4
    ? card4.trendPct != null
      ? `${card4.trendPct > 0 ? "+" : ""}${card4.trendPct.toFixed(1)}%`
      : (card4.trendDelta > 0
          ? `+${card4.trendDelta.toFixed(1)}`
          : `${card4.trendDelta.toFixed(1)}`) + " xe"
    : "—";
  const c4Sub = card4
    ? `${card4.currentVeh} xe → ${card4.f60mVal.toFixed(1)} xe (dự báo +60p)`
    : "Chưa có dự báo";
  const c4Icon = trendUp ? (
    <IconTrendingUp className="size-5 text-orange-500" />
  ) : trendDown ? (
    <IconTrendingDown className="size-5 text-green-500" />
  ) : (
    <IconMinus className="size-5 text-muted-foreground" />
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Card 1 – Mức tải V/C hiện tại */}
      <StatCard
        label="Lưu lượng / Mức tải"
        value={c1Value}
        sub={c1Sub}
        icon={c1Icon}
        valueClass={cn("text-xl", c1ValueClass)}
        tooltip={
          <span>
            <strong>Lưu lượng thực tế / Năng lực camera</strong> (xe/5 phút). Tỉ
            lệ V/C cho thấy mức độ sử dụng hạ tầng: dưới 55% = thông thoáng,
            75–100% = đông đúc, trên 100% = quá tải. Δ so sánh với 30 phút
            trước.
          </span>
        }
      />

      {/* Card 2 – Đếm ngược */}
      <StatCard
        label="Chu kỳ tiếp theo"
        value={fmtCountdown(secondsLeft < 0 ? 0 : secondsLeft)}
        sub="Chu kỳ dự báo: mỗi 5p"
        icon={<IconHourglassHigh className="size-5 text-blue-500" />}
        valueClass="text-blue-600 dark:text-blue-400 font-mono"
        tooltip={
          <span>
            Dự báo chạy <strong>mỗi 5p cố định</strong>. Đếm ngược đến chu kỳ
            tiếp theo.
          </span>
        }
      />

      {/* Card 3 – Đỉnh dự báo trong 5 mốc tới */}
      <StatCard
        label="Đỉnh dự báo 5 mốc tới"
        value={c3Value}
        sub={c3Sub}
        icon={c3Icon}
        valueClass={c3ValueClass}
        tooltip={
          <span>
            Lưu lượng <strong>cao nhất dự báo</strong> trong 5 thời điểm tiếp
            theo (5p / 10p / 15p / 30p / 60p). Dữ liệu toàn mạng lưới. Cho biết
            đỉnh căng thẳng sắp xảy ra và thời điểm chính xác.
          </span>
        }
      />

      {/* Card 4 – Xu hướng 1 giờ tới */}
      <StatCard
        label="Xu hướng 60p tới"
        value={c4Value}
        sub={c4Sub}
        icon={c4Icon}
        valueClass={c4ValueClass}
        tooltip={
          <span>
            So sánh <strong>dự báo h=60p</strong> với lưu lượng hiện tại. Tăng
            (cam) nghĩa là mạng lưới sẽ đông hơn; giảm (xanh) nghĩa là sẽ thông
            thoáng hơn.
          </span>
        }
      />
    </div>
  );
}
