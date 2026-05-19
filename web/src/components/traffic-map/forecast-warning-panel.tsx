import { useMemo, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { IconTrendingUp, IconCircleCheckFilled, IconMapPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { FORECAST_KEYS, LOS_BADGE_CLASS, LOS_PRIORITY } from "./constants";
import { getLosLabel, getForecastLos } from "./helpers";
import type { EnrichedCamera, ForecastKey } from "./types";

interface Props {
  cameras: EnrichedCamera[];
  onFocusCamera?: (camId: string, lat: number, lng: number) => void;
}

/**
 * Panel cảnh báo dự báo ùn tắc với tabs 5m/10m/15m/30m/60m.
 * Chỉ hiển thị camera đang ổn nhưng sắp bị ùn tắc.
 */
export function ForecastWarningPanel({ cameras, onFocusCamera }: Props) {
  const [tab, setTab] = useState<ForecastKey>("5m");

  // Giữ thứ tự ổn định theo từng tab để tránh jumping
  const orderRef = useRef<Record<ForecastKey, string[]>>({
    "5m": [], "10m": [], "15m": [], "30m": [], "60m": [],
  });

  // Đếm số camera cần cảnh báo theo mỗi tab (dùng cho dot indicator)
  const counts = useMemo(() => {
    const c = {} as Record<ForecastKey, number>;
    for (const key of FORECAST_KEYS) {
      c[key] = cameras.filter((cam) => {
        const los = getForecastLos(cam, key);
        return (
          (los === "congested" || los === "heavy") &&
          cam.status.current !== "congested" &&
          cam.status.current !== "heavy"
        );
      }).length;
    }
    return c;
  }, [cameras]);

  const warned = useMemo(() => {
    const eligible = cameras.filter((cam) => {
      const los = getForecastLos(cam, tab);
      return (
        (los === "congested" || los === "heavy") &&
        cam.status.current !== "congested" &&
        cam.status.current !== "heavy"
      );
    });
    const currentIds = new Set(eligible.map((c) => c.id));
    // Prune gone
    orderRef.current[tab] = orderRef.current[tab].filter((id) => currentIds.has(id));
    // Append new entries sorted by severity
    const newCams = eligible.filter((c) => !orderRef.current[tab].includes(c.id));
    newCams.sort(
      (a, b) =>
        (LOS_PRIORITY[getForecastLos(b, tab)] ?? 0) -
        (LOS_PRIORITY[getForecastLos(a, tab)] ?? 0)
    );
    newCams.forEach((c) => orderRef.current[tab].push(c.id));
    const map = new Map(eligible.map((c) => [c.id, c]));
    return orderRef.current[tab]
      .map((id) => map.get(id))
      .filter((c): c is EnrichedCamera => !!c);
  }, [cameras, tab]);

  return (
    <div className="flex flex-col rounded-lg border bg-card overflow-hidden shrink-0">
      {/* Header + tab row */}
      <div className="px-4 pt-3 pb-2 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <IconTrendingUp className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-sm font-semibold flex-1">Cảnh báo dự báo ùn tắc</span>
          {counts[tab] > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30">
              {counts[tab]}
            </Badge>
          )}
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {FORECAST_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 py-1 text-[11px] font-medium relative transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {key}
              {counts[key] > 0 && (
                <span
                  className={cn(
                    "absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
                    tab === key ? "bg-primary-foreground/70" : "bg-orange-500"
                  )}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[200px]">
        {warned.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <IconCircleCheckFilled className="w-4 h-4 text-green-500 shrink-0" />
            Không có điểm nào dự báo xấu trong +{tab}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {warned.map((cam) => {
              const flos = getForecastLos(cam, tab);
              return (
                <li key={cam.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-medium leading-snug line-clamp-2 flex-1">
                      {cam.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", LOS_BADGE_CLASS[cam.status.current])}>
                        {getLosLabel(cam.status.current)}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">→</span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", LOS_BADGE_CLASS[flos])}>
                        {getLosLabel(flos)}
                      </Badge>
                      {onFocusCamera && (
                        <button
                          onClick={() => onFocusCamera(cam.id, cam.lat, cam.lng)}
                          title="Xem trên bản đồ"
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <IconMapPin className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {cam.forecasts[tab]} xe dự báo trong +{tab}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
