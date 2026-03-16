import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconBrain, IconSparkles } from "@tabler/icons-react";
import {
  formatVersion,
  type MLModelMetadata,
} from "@/services/model.service";
import { useAuth } from "@/contexts/AuthContext";
import { MetricChip, MODEL_ICON, HORIZON_LABEL } from "@/components/models/metric-chip";
import { METRIC_LABELS, UI_LABELS, FORECAST_TERMS } from "@/lib/app-constants";

/**
 * Card hiển thị thông tin tóm tắt của một mô hình đang active.
 */
export function ModelCard({
  model,
  onViewDetail,
  onTrainNew,
  isTrainingRunning,
}: {
  model: MLModelMetadata;
  onViewDetail: (model: MLModelMetadata) => void;
  onTrainNew: (modelType: string) => void;
  isTrainingRunning: boolean;
}) {
  const Icon = MODEL_ICON[model.model_type] ?? IconBrain;
  const mae = model.metrics?.mae;
  const r2 = model.metrics?.r2;
  const horizon = HORIZON_LABEL[model.model_type];
  const isYolo = model.model_type === "yolo";
  const { role } = useAuth();
  const isTechnician = role === "technician";

  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm leading-tight">
                {model.display_name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {model.base_model ?? "—"}
                {horizon ? ` • ${FORECAST_TERMS.FORECAST} ${horizon}` : ""}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0"
          >
            Đang dùng
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Metrics chips */}
        <div className="flex gap-2">
          <MetricChip
            label={METRIC_LABELS.MAE}
            value={mae !== undefined ? mae.toFixed(2) : undefined}
            unit=" xe"
          />
          <MetricChip
            label={METRIC_LABELS.R2}
            value={r2 !== undefined ? r2.toFixed(3) : undefined}
          />
          {model.training_samples != null && (
            <MetricChip
              label={METRIC_LABELS.SAMPLES}
              value={(model.training_samples / 1000).toFixed(1)}
              unit="k"
            />
          )}
        </div>

        {/* Version + date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {model.model_version.startsWith("v1_initial")
              ? "v1_initial"
              : formatVersion(model.model_version)}
          </span>
          <span>
            {new Date(model.created_at).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetail(model)}
          >
            {UI_LABELS.DETAIL}
          </Button>
          {!isYolo && isTechnician && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onTrainNew(model.model_type)}
              disabled={isTrainingRunning}
              title={
                isTrainingRunning
                  ? "Đang có tiến trình huấn luyện đang chạy"
                  : undefined
              }
            >
              <IconSparkles className="w-3.5 h-3.5 mr-1.5" />
              Huấn luyện mới
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
