import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconTrendingUp } from "@tabler/icons-react";
import { formatDistance, formatDuration, getForecastLos } from "./helpers";
import type { RouteResult, EnrichedCamera, ForecastKey } from "./types";

interface Props {
  label: string;
  result: RouteResult;
  cameras: EnrichedCamera[];
  hasCong: boolean;
  lineColor: string;
  recommended: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

/** Mini card tóm tắt thông tin tuyến đường (khoảng cách, thời gian, trạng thái ùn tắc) */
export function RouteResultMini({ label, result, cameras, hasCong, lineColor, recommended, selected, onSelect }: Props) {
  const congested = cameras.filter(
    (c) => c.status.current === "congested" || c.status.current === "heavy"
  );
  const fcBad = cameras.filter(
    (c) =>
      (c.status.forecast === "congested" || c.status.forecast === "heavy") &&
      c.status.current !== "congested" &&
      c.status.current !== "heavy"
  );

  /** Cảnh báo tương lai 10m–60m: camera hiện OK nhưng sẽ bị ùn tắc */
  const futureWarnings = (["10m", "15m", "30m", "60m"] as ForecastKey[]).map((key) => ({
    key,
    bad: cameras.filter((cam) => {
      const los = getForecastLos(cam, key);
      return (
        (los === "congested" || los === "heavy") &&
        cam.status.current !== "congested" &&
        cam.status.current !== "heavy"
      );
    }).length,
  })).filter((w) => w.bad > 0);
  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded border p-2 text-[11px] flex flex-col gap-1 transition-all",
        onSelect && "cursor-pointer",
        hasCong
          ? "border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900"
          : "border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900",
        selected && "ring-2 ring-primary shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: lineColor }}
          />
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        {recommended && (
          <span className="text-[10px] text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40 px-1.5 rounded-full font-medium">
            Đề xuất
          </span>
        )}
      </div>
      <div className="flex gap-1.5 text-muted-foreground">
        <span>{formatDistance(result.distance)}</span>
        <span>·</span>
        <span>{formatDuration(result.duration)}</span>
        <span>·</span>
        <span
          title="Camera giám sát của hệ thống trên tuyến đường từ A đến B — trạng thái thực tế"
          className="cursor-help underline decoration-dashed decoration-muted-foreground/40"
        >
          {cameras.length} camera
        </span>
      </div>
      {hasCong ? (
        <div className="flex items-start gap-1">
          <IconAlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
          <span className="text-red-600 dark:text-red-400 leading-snug">
            {congested.length > 0 && `${congested.length} điểm ùn tắc`}
            {fcBad.length > 0 && ` · ${fcBad.length} dự báo xấu`}
          </span>
        </div>
      ) : fcBad.length > 0 ? (
        <div className="flex items-start gap-1">
          <IconAlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-amber-600 dark:text-amber-400 leading-snug">
            Thông thoáng · {fcBad.length} sắp ùn tắc (5m)
          </span>
        </div>
      ) : (
        <span className="text-green-600 dark:text-green-400">Thông thoáng</span>
      )}
      {futureWarnings.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <IconTrendingUp className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {futureWarnings.map((w) => `+${w.key}: ${w.bad} cam`).join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
