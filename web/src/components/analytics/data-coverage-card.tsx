/**
 * Data Coverage card — Mức bao phủ dữ liệu và trạng thái đồng bộ
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { IconDatabase } from "@tabler/icons-react";

interface DataCoverageMockProps {
  dataCoverage: {
    total_predictions: number;
    verified: number;
    pending: number;
    verification_rate: number;
  };
}

export function DataCoverageCard({ dataCoverage }: DataCoverageMockProps) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardSectionHeader
          icon={IconDatabase}
          title="Mức bao phủ dữ liệu"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-950/40"
          description="Trạng thái đồng bộ trong kỳ phân tích gần nhất"
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Tổng dự đoán</p>
            <p className="text-xl font-bold tabular-nums">
              {dataCoverage.total_predictions.toLocaleString("vi-VN")}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Đã xác minh</p>
            <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {dataCoverage.verified.toLocaleString("vi-VN")}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Chờ đồng bộ</p>
            <p className="text-xl font-bold tabular-nums text-yellow-600 dark:text-yellow-400">
              {dataCoverage.pending.toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Tỷ lệ xác minh ({dataCoverage.verification_rate}%)
            </span>
            <span className="font-medium tabular-nums">
              {dataCoverage.verified.toLocaleString("vi-VN")} /{" "}
              {dataCoverage.total_predictions.toLocaleString("vi-VN")}
            </span>
          </div>
          <Progress value={dataCoverage.verification_rate} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
