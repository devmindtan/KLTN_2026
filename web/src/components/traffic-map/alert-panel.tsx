import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconCircleCheckFilled, IconMapPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { LOS_BADGE_CLASS, LOS_PRIORITY } from "./constants";
import { getLosLabel, getDecisionAction } from "./helpers";
import type { EnrichedCamera } from "./types";

interface Props {
  cameras: EnrichedCamera[];
  /** Callback để flyTo + mở popup camera trên bản đồ */
  onFocusCamera: (camId: string, lat: number, lng: number) => void;
}

/**
 * Panel cảnh báo camera đang ùn tắc nặng (heavy/congested).
 * Mỗi item có: badge LOS, progress bar V/C, gợi ý hành động, nút flyTo bản đồ.
 */
export function AlertPanel({ cameras, onFocusCamera }: Props) {
  const sorted = useMemo(
    () =>
      [...cameras].sort((a, b) => {
        const vcA = a.realtimeData?.vc_ratio ?? (LOS_PRIORITY[a.status.current] ?? 0) / 10;
        const vcB = b.realtimeData?.vc_ratio ?? (LOS_PRIORITY[b.status.current] ?? 0) / 10;
        return vcB - vcA;
      }),
    [cameras]
  );

  return (
    <div className="flex flex-col shrink-0 rounded-lg border bg-card overflow-hidden">
      {/* Header cố định */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <IconAlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-semibold flex-1">Cần can thiệp ngay</span>
        {cameras.length > 0 ? (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 text-amber-50">
            {cameras.length}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30">
            Ổn
          </Badge>
        )}
      </div>

      {/* Body có scroll */}
      <div className="overflow-y-auto max-h-[300px]">
        {sorted.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
            <IconCircleCheckFilled className="w-4 h-4 text-green-500 shrink-0" />
            Tất cả camera đang trong tầm kiểm soát
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((cam) => {
              const vcPct = cam.realtimeData?.vc_ratio != null ? cam.realtimeData.vc_ratio * 100 : null;
              const barColor = LOS_BADGE_CLASS[cam.status.current]
                ? undefined
                : "#94a3b8";
              void barColor; // unused — dùng LOS_MARKER_COLOR trực tiếp bên dưới
              return (
                <li key={cam.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                  {/* Row 1: tên + badge + nút flyTo */}
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="text-xs font-medium leading-snug flex-1 line-clamp-2">
                      {cam.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", LOS_BADGE_CLASS[cam.status.current])}
                      >
                        {getLosLabel(cam.status.current)}
                      </Badge>
                      <button
                        onClick={() => onFocusCamera(cam.id, cam.lat, cam.lng)}
                        title="Xem trên bản đồ"
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <IconMapPin className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: V/C progress bar */}
                  {vcPct != null && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(vcPct, 100)}%`,
                            backgroundColor:
                              cam.status.current === "congested" ? "#ef4444" :
                              cam.status.current === "heavy" ? "#f97316" : "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">
                        {vcPct.toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Row 3: action + breakdown xe */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {getDecisionAction(cam.status.current)}
                    </p>
                    {cam.realtimeData?.detections != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        Xe lớn: {cam.realtimeData.detections.car} · Xe nhỏ: {cam.realtimeData.detections.motorbike}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
