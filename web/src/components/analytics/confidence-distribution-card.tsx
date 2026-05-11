/**
 * Confidence Distribution Card — Phân phối chất lượng dữ liệu (2-col)
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CardSectionHeader } from "@/components/custom/card-section-header";
import { IconShieldCheck } from "@tabler/icons-react";

interface ConfidenceDistributionProps {
  distribution: {
    high_quality_predictions: number;
    low_quality_predictions: number;
    high_quality_percent: number;
    low_quality_percent: number;
    avg_input_samples: number;
    avg_lag_samples: number;
    avg_sync_samples: number;
    consistent_syncs: number;
    inconsistent_syncs: number;
    consistent_sync_percent: number;
    inconsistent_sync_percent: number;
    total_records: number;
    verified_records: number;
  };
}

export function ConfidenceDistributionCard({ distribution }: ConfidenceDistributionProps) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardSectionHeader
          icon={IconShieldCheck}
          title="Phân phối chất lượng dữ liệu"
          iconColor="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-100 dark:bg-teal-950/40"
          description="Tỷ lệ dự đoán high/low quality và mức độ nhất quán sync"
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-medium">Chất lượng dự đoán (input + lag ≥ 30)</p>
            {[
              { label: `Chất lượng cao — ${distribution.high_quality_predictions.toLocaleString("vi-VN")}`, value: distribution.high_quality_percent },
              { label: `Chất lượng thấp — ${distribution.low_quality_predictions.toLocaleString("vi-VN")}`, value: distribution.low_quality_percent },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{value}%</span>
                </div>
                <Progress value={value} className="h-1.5" />
              </div>
            ))}
            <div className="rounded-md border p-2.5 grid grid-cols-3 text-center gap-2">
              <div><p className="text-xs font-semibold">{distribution.avg_input_samples}</p><p className="text-[10px] text-muted-foreground">avg Input</p></div>
              <div><p className="text-xs font-semibold">{distribution.avg_lag_samples}</p><p className="text-[10px] text-muted-foreground">avg LAG</p></div>
              <div><p className="text-xs font-semibold">{distribution.avg_sync_samples}</p><p className="text-[10px] text-muted-foreground">avg Sync</p></div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium">Nhất quán sync (|input − sync| ≤ 5)</p>
            {[
              { label: `Nhất quán — ${distribution.consistent_syncs.toLocaleString("vi-VN")}`, value: distribution.consistent_sync_percent },
              { label: `Không khớp — ${distribution.inconsistent_syncs.toLocaleString("vi-VN")}`, value: distribution.inconsistent_sync_percent },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{value}%</span>
                </div>
                <Progress value={value} className="h-1.5" />
              </div>
            ))}
            <div className="rounded-md border p-2.5 grid grid-cols-2 text-center gap-2">
              <div><p className="text-xs font-semibold">{distribution.total_records.toLocaleString("vi-VN")}</p><p className="text-[10px] text-muted-foreground">Tổng records</p></div>
              <div><p className="text-xs font-semibold">{distribution.verified_records.toLocaleString("vi-VN")}</p><p className="text-[10px] text-muted-foreground">Đã verified</p></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
