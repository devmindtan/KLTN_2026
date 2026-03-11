import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconAlertTriangle } from "@tabler/icons-react";
import { activateModel, type MLModelMetadata } from "@/services/model.service";

export interface ActivateTarget {
  target: MLModelMetadata;      // version muốn kích hoạt
  currentActive: MLModelMetadata; // version đang active (cùng loại)
}

/**
 * AlertDialog xác nhận kích hoạt phiên bản mô hình mới, so sánh metrics trước/sau.
 * POST /api/models/:id/activate
 */
export function ActivateModelDialog({
  activateTarget,
  onCancel,
  onSuccess,
}: {
  activateTarget: ActivateTarget | null;
  onCancel: () => void;
  onSuccess: (k8sRestart: boolean) => void;
}) {
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!activateTarget) return;
    setActivating(true);
    setActivateError(null);
    try {
      const result = await activateModel(activateTarget.target.id);
      onSuccess(result.k8s_restart ?? false);
    } catch (err) {
      setActivateError(
        err instanceof Error ? err.message : "Lỗi không xác định"
      );
    } finally {
      setActivating(false);
    }
  };

  const { target, currentActive } = activateTarget ?? {};

  const oldMae = currentActive?.metrics?.mae;
  const newMae = target?.metrics?.mae;
  const oldR2 = currentActive?.metrics?.r2;
  const newR2 = target?.metrics?.r2;
  const maeBetter =
    oldMae != null && newMae != null ? newMae < oldMae : undefined;
  const r2Better =
    oldR2 != null && newR2 != null ? newR2 > oldR2 : undefined;

  return (
    <AlertDialog
      open={!!activateTarget}
      onOpenChange={(open: boolean) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kích hoạt phiên bản mới?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Loại mô hình:{" "}
                <span className="font-medium text-foreground">
                  {target?.display_name}
                </span>
              </p>

              {/* So sánh phiên bản */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2 bg-muted/40">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">
                    Đang dùng
                  </p>
                  <p className="font-mono text-xs font-medium">
                    {currentActive?.model_version.slice(-13)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MAE: {oldMae != null ? oldMae.toFixed(2) : "—"} &nbsp;|&nbsp;
                    R²: {oldR2 != null ? oldR2.toFixed(3) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 dark:bg-blue-900/10 dark:border-blue-800">
                  <p className="text-[10px] uppercase text-blue-600 dark:text-blue-400 mb-1">
                    Sẽ kích hoạt
                  </p>
                  <p className="font-mono text-xs font-medium">
                    {target?.model_version.slice(-13)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MAE:{" "}
                    <span
                      className={
                        maeBetter === true
                          ? "text-green-600 font-semibold"
                          : maeBetter === false
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {newMae != null ? newMae.toFixed(2) : "—"}
                      {maeBetter === true && " ↓"}
                      {maeBetter === false && " ↑"}
                    </span>{" "}
                    &nbsp;|&nbsp; R²:{" "}
                    <span
                      className={
                        r2Better === true
                          ? "text-green-600 font-semibold"
                          : r2Better === false
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {newR2 != null ? newR2.toFixed(3) : "—"}
                      {r2Better === true && " ↑"}
                      {r2Better === false && " ↓"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Cảnh báo */}
              <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300">
                <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs">
                  Sau khi kích hoạt, Pod image-predict sẽ được restart để tải
                  model mới từ MinIO. Dự báo sẽ tạm dừng ~2-3 phút.
                </p>
              </div>

              {activateError && (
                <p className="text-xs text-red-600">❌ {activateError}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={activating}>
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={activating}>
            {activating ? "Đang kích hoạt..." : "Xác nhận Kích hoạt"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
