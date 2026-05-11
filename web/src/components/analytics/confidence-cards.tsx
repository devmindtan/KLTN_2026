/**
 * Confidence Cards 2-col — Độ tin cậy dự đoán + Độ tin cậy sai số
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { IconTrendingUp, IconAlertTriangle } from "@tabler/icons-react";

interface ConfidenceCardsProps {
  predictionConfidence: {
    level: string;
    score: number;
    avg_input_samples: number;
    avg_lag_samples: number;
    low_sample_count: number;
  };
  errorConfidence: {
    level: string;
    score: number;
    avg_sync_samples: number;
    mismatched_count: number;
  };
}

function ConfidenceBadge({ level }: { level: string }) {
  if (level === "High")
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
      >
        Cao
      </Badge>
    );
  if (level === "Medium")
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400"
      >
        Trung bình
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
    >
      Thấp
    </Badge>
  );
}

export function ConfidenceCards({
  predictionConfidence,
  errorConfidence,
}: ConfidenceCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardSectionHeader
            icon={IconTrendingUp}
            title="Độ tin cậy dự đoán"
            iconColor="text-purple-600 dark:text-purple-400"
            iconBg="bg-purple-100 dark:bg-purple-950/40"
            description="Số lượng mẫu hiện tại so với số mẫu quá khứ"
            badge={<ConfidenceBadge level={predictionConfidence.level} />}
          />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Điểm tin cậy
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {(predictionConfidence.score * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={predictionConfidence.score * 100} className="h-2" />
          <Separator />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs font-semibold tabular-nums">
                {predictionConfidence.avg_input_samples}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Trung bình hiện tại
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tabular-nums">
                {predictionConfidence.avg_lag_samples}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Trung bình quá khứ
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                {predictionConfidence.low_sample_count.toLocaleString("vi-VN")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Chất lượng thấp
              </p>
            </div>
          </div>
          <div className="rounded-md border p-2 bg-muted/30 text-[10px] text-muted-foreground">
            Ngưỡng: cả hai ≥30 và chênh lệch &lt;20% →{" "}
            <span className="text-green-600 dark:text-green-400 font-medium">
              Cao
            </span>{" "}
            · &lt;40% hoặc &lt;30 mẫu →{" "}
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">
              Trung bình
            </span>{" "}
            (điểm bị giảm do thiếu mẫu)
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardSectionHeader
            icon={IconAlertTriangle}
            title="Độ tin cậy sai số"
            iconColor="text-orange-600 dark:text-orange-400"
            iconBg="bg-orange-100 dark:bg-orange-950/40"
            description="Số lượng mẫu hiện tại so với mẫu tương lai"
            badge={<ConfidenceBadge level={errorConfidence.level} />}
          />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Điểm tin cậy
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {(errorConfidence.score * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={errorConfidence.score * 100} className="h-2" />
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-xs font-semibold tabular-nums">
                {errorConfidence.avg_sync_samples}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Trung bình mẫu đồng bộ
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                {errorConfidence.mismatched_count.toLocaleString("vi-VN")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Không khớp (&gt;5 mẫu)
              </p>
            </div>
          </div>
          <div className="rounded-md border p-2 bg-muted/30 text-[10px] text-muted-foreground">
            Ngưỡng: ≤5 và ≥30 →{" "}
            <span className="text-green-600 font-medium">Cao</span> (0.95) · ≤5
            &lt;30 →{" "}
            <span className="text-yellow-600 font-medium">Trung bình</span>{" "}
            (0.75) · &gt;5 →{" "}
            <span className="text-red-600 font-medium">Thấp</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
