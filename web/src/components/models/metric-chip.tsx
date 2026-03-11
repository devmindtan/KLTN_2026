import type { ElementType } from "react";
import { IconClockHour4, IconRobot } from "@tabler/icons-react";

export const MODEL_ICON: Record<string, ElementType> = {
  random_forest_5m: IconClockHour4,
  random_forest_10m: IconClockHour4,
  random_forest_15m: IconClockHour4,
  random_forest_30m: IconClockHour4,
  random_forest_60m: IconClockHour4,
  yolo: IconRobot,
};

export const HORIZON_LABEL: Record<string, string> = {
  random_forest_5m: "5 phút",
  random_forest_10m: "10 phút",
  random_forest_15m: "15 phút",
  random_forest_30m: "30 phút",
  random_forest_60m: "60 phút",
};

/**
 * Chip nhỏ hiển thị một chỉ số (MAE, RMSE, R², Samples…) theo dạng label + value.
 */
export function MetricChip({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: string | number | undefined;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-muted/40 px-3 py-2 min-w-[64px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-base font-semibold">
        {value !== undefined && value !== null ? `${value}${unit}` : "—"}
      </span>
    </div>
  );
}
