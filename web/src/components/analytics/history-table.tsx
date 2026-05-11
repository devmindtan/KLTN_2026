/**
 * Lịch sử snapshot — 10 bản ghi gần nhất
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
import { IconClock } from "@tabler/icons-react";
import type { ModelMetricsHistoryRow } from "@/services/model-metrics.service";

interface HistoryTableProps {
  history: ModelMetricsHistoryRow[];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryTable({ history }: HistoryTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardSectionHeader
          icon={IconClock}
          title="Lịch sử đánh giá"
          iconColor="text-slate-600 dark:text-slate-400"
          iconBg="bg-slate-100 dark:bg-slate-950/40"
          description="20 đánh giá gần nhất"
          badge={
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {history.length} bản ghi
            </Badge>
          }
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Thời điểm</TableHead>
              <TableHead className="text-xs text-right">MAE</TableHead>
              <TableHead className="text-xs text-right">RMSE</TableHead>
              <TableHead className="text-xs text-right">MAPE</TableHead>
              <TableHead className="text-xs text-right">Acc≤5xe</TableHead>
              <TableHead className="text-xs text-right">Xu hướng</TableHead>
              <TableHead className="text-xs text-right">Dự đoán</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.slice(0, 10).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-xs">
                  {fmtDate(row.generated_at)}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {row.overall?.mae ?? 0} xe
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                  {row.overall?.rmse ?? 0} xe
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {row.overall?.mape ?? 0}%
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums font-medium">
                  {row.overall?.accuracy_5xe ?? 0}%
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {row.trend_accuracy?.trend_accuracy ?? 0}%
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                  {(row.overall?.total_predictions ?? 0).toLocaleString(
                    "vi-VN",
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
