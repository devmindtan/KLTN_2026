import type { ElementType } from "react";
import { IconClockHour4, IconRobot } from "@tabler/icons-react";
import { TIME_LABEL } from "@/lib/app-constants";

export const MODEL_ICON: Record<string, ElementType> = {
  random_forest_5m: IconClockHour4,
  random_forest_10m: IconClockHour4,
  random_forest_15m: IconClockHour4,
  random_forest_30m: IconClockHour4,
  random_forest_60m: IconClockHour4,
  yolo: IconRobot,
};

/** Map loại model → nhãn khoảng thời gian — từ TIME_LABEL trong app-constants */
export const HORIZON_LABEL: Record<string, string> = {
  random_forest_5m:  TIME_LABEL["5m"],
  random_forest_10m: TIME_LABEL["10m"],
  random_forest_15m: TIME_LABEL["15m"],
  random_forest_30m: TIME_LABEL["30m"],
  random_forest_60m: TIME_LABEL["60m"],
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
