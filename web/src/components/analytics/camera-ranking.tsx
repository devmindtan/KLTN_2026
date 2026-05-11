/**
 * Camera Ranking 2-col — Top chính xác nhất vs Cần cải thiện nhất
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { IconCamera } from "@tabler/icons-react";
import type { CameraRankingItem } from "@/services/model-metrics.service";

interface CameraRankingProps {
  bestCameras: CameraRankingItem[];
  worstCameras: CameraRankingItem[];
  cameraNameMap: Record<string, string>;
}

function CameraRankRow({
  item,
  rank,
  cameraNameMap,
}: {
  item: CameraRankingItem;
  rank: number;
  cameraNameMap: Record<string, string>;
}) {
  const displayName =
    cameraNameMap[item.camera_id] ?? `Camera ...${item.camera_id.slice(-6)}`;
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b last:border-0 hover:bg-accent/40 transition-colors">
      <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
          #{rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{displayName}</p>
        <p className="text-[10px] text-muted-foreground">
          ID: ...{item.camera_id.slice(-6)} •{" "}
          {item.predictions_count.toLocaleString("vi-VN")} dự đoán
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">
          MAE: {item.avg_error} xe
        </p>
        <p className="text-[10px] text-muted-foreground">
          Acc≤5xe: {item.accuracy_5xe}% • Lỗi%: {item.error_percentage}%
        </p>
      </div>
    </div>
  );
}

export function CameraRanking({
  bestCameras,
  worstCameras,
  cameraNameMap,
}: CameraRankingProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardSectionHeader
            icon={IconCamera}
            title="Xếp hạng những khu vực máy quay chính xác nhất"
            iconColor="text-green-600 dark:text-green-400"
            iconBg="bg-green-100 dark:bg-green-950/40"
            description="MAE thấp nhất — ≥50 dự đoán"
          />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {bestCameras.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">
              Chưa có dữ liệu
            </p>
          ) : (
            bestCameras.map((item, i) => (
              <CameraRankRow
                key={item.camera_id}
                item={item}
                rank={i + 1}
                cameraNameMap={cameraNameMap}
              />
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardSectionHeader
            icon={IconCamera}
            title="Xếp hạng những khu vực máy quay cần cải thiện"
            iconColor="text-red-600 dark:text-red-400"
            iconBg="bg-red-100 dark:bg-red-950/40"
            description="MAE cao nhất — ≥50 dự đoán"
          />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {worstCameras.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">
              Chưa có dữ liệu
            </p>
          ) : (
            worstCameras.map((item, i) => (
              <CameraRankRow
                key={item.camera_id}
                item={item}
                rank={i + 1}
                cameraNameMap={cameraNameMap}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
