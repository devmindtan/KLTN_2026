/**
 * Horizon Table Card — Hiệu suất theo mốc thời gian (5/10/15/30/60 phút)
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { IconChartBar } from "@tabler/icons-react";
import { getTimeLabel } from "@/lib/app-constants";

interface HorizonRow {
  horizon_minutes: number;
  total_predictions: number;
  avg_error: number;
  median_error: number;
  p95_error: number;
  accuracy_5xe: number;
  accuracy_10xe: number;
  prediction_confidence?: {
    level: string;
    score: number;
  };
  error_confidence?: {
    level: string;
    score: number;
  };
  recommendation?: string;
}

interface HorizonTableCardProps {
  horizons: HorizonRow[];
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

function RecommendBadge({ value }: { value?: string }) {
  if (value === "KEEP")
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
      >
        Giữ lại
      </Badge>
    );
  if (value === "OPTIONAL")
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400"
      >
        Tùy chọn
      </Badge>
    );
  if (value === "DROP")
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
      >
        Loại bỏ
      </Badge>
    );
  return <span className="text-xs text-muted-foreground">—</span>;
}

export function HorizonTableCard({ horizons }: HorizonTableCardProps) {
  return (
    <Card id="horizon-comparison">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardSectionHeader
          icon={IconChartBar}
          title="Hiệu suất theo mốc thời gian"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-950/40"
          description="5 horizon: 5m / 10m / 15m / 30m / 60m — bao gồm độ tin cậy và khuyến nghị"
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Mốc</TableHead>
              <TableHead className="text-xs text-right">Dự đoán</TableHead>
              <TableHead className="text-xs text-right">MAE</TableHead>
              <TableHead className="text-xs text-right">Median</TableHead>
              <TableHead className="text-xs text-right">P95</TableHead>
              <TableHead className="text-xs text-right">Acc≤5xe</TableHead>
              <TableHead className="text-xs text-right">Acc≤10xe</TableHead>
              <TableHead className="text-xs">Tin cậy dự đoán</TableHead>
              <TableHead className="text-xs">Tin cậy sai số</TableHead>
              <TableHead className="text-xs">Khuyến nghị</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {horizons.map((row) => (
              <TableRow key={row.horizon_minutes}>
                <TableCell className="font-medium text-xs">
                  {getTimeLabel(`${row.horizon_minutes}m`)}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {row.total_predictions.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums font-medium">
                  {row.avg_error} xe
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                  {row.median_error} xe
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                  {row.p95_error} xe
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums font-medium">
                  {row.accuracy_5xe}%
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                  {row.accuracy_10xe}%
                </TableCell>
                <TableCell>
                  {row.prediction_confidence ? (
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge
                        level={row.prediction_confidence.level}
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {(row.prediction_confidence.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.error_confidence ? (
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge level={row.error_confidence.level} />
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {(row.error_confidence.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <RecommendBadge value={row.recommendation} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
