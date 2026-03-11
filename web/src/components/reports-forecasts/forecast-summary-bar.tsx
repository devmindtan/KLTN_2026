/**
 * ForecastSummaryBar – Zone 1: 4 stats cards ngang cho tab Dự báo
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconTarget,
  IconClock,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ForecastSummary } from "./reports-types";

interface Props {
  summary: ForecastSummary;
}

/** 4 stats card tổng quan dự báo – hiển thị ngang phía trên tab Dự báo */
export function ForecastSummaryBar({ summary }: Props) {
  const trendIcon =
    summary.networkTrend === "increase" ? <IconTrendingUp  className="size-5 text-orange-500" /> :
    summary.networkTrend === "decrease" ? <IconTrendingDown className="size-5 text-green-500"  /> :
                                          <IconMinus        className="size-5 text-muted-foreground" />;

  const trendLabel =
    summary.networkTrend === "increase" ? `↑ Tăng ${summary.networkChangePct}%` :
    summary.networkTrend === "decrease" ? `↓ Giảm ${summary.networkChangePct}%` :
                                          "Ổn định";

  const trendColor =
    summary.networkTrend === "increase" ? "text-orange-600 dark:text-orange-400" :
    summary.networkTrend === "decrease" ? "text-green-600 dark:text-green-400"   :
                                          "text-muted-foreground";

  const stats = [
    {
      label: "Độ chính xác hôm nay",
      value: `${summary.avgAccuracy}%`,
      sub: `MAE: ${summary.mae} xe`,
      icon: <IconTarget className="size-5 text-green-500" />,
      valueClass: "text-green-600 dark:text-green-400",
    },
    {
      label: "Dự báo tiếp theo",
      value: "17:00",
      sub: "Còn ~15 phút",
      icon: <IconClock className="size-5 text-blue-500" />,
      valueClass: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Camera nguy cơ cao",
      value: String(summary.highRiskCount),
      sub: "dự báo ùn tắc / nặng",
      icon: <IconAlertTriangle className="size-5 text-red-500" />,
      valueClass: summary.highRiskCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
    },
    {
      label: "Xu hướng mạng lưới",
      value: trendLabel,
      sub: "so với cùng giờ hôm qua",
      icon: trendIcon,
      valueClass: trendColor,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex flex-col gap-0">
            {/* Label + icon góc phải */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              <div className="shrink-0 opacity-80">{s.icon}</div>
            </div>
            {/* Value lớn + sub */}
            <div className="min-w-0">
              <p className={cn("text-2xl font-bold tabular-nums leading-tight truncate", s.valueClass)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-1">{s.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Badge hiển thị R² và MAPE tóm tắt cuối trang */
export function ForecastAccuracyBadges({ summary }: Props) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {[
        { label: "MAE", value: `${summary.mae} xe` },
        { label: "MAPE", value: `${summary.mape}%` },
        { label: "R²", value: String(summary.r2) },
        { label: "Khung dữ liệu", value: `${summary.coveredSlots}/${summary.totalSlots}` },
      ].map(b => (
        <Badge key={b.label} variant="secondary" className="gap-1 font-normal">
          <span className="text-muted-foreground">{b.label}:</span>
          <span className="font-semibold">{b.value}</span>
        </Badge>
      ))}
    </div>
  );
}
