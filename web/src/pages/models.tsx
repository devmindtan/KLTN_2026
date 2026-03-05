import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { IconBrain, IconClockHour4, IconDatabase, IconRobot, IconSparkles, IconCheck, IconAlertTriangle, IconLoader2, IconCircleCheck, IconCircleX, IconArrowsSort, IconSortAscending, IconSortDescending, IconSearch } from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import {
  getActiveModels,
  getModelHistory,
  activateModel,
  trainModel,
  formatVersion,
  getR2Color,
  type MLModelMetadata,
  type ModelHistoryResponse,
} from "@/services/model.service";
import { useSocket, type TrainingJobData } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================
// HELPERS
// ============================================================

const MODEL_ICON: Record<string, React.ElementType> = {
  random_forest_5m: IconClockHour4,
  random_forest_10m: IconClockHour4,
  random_forest_15m: IconClockHour4,
  random_forest_30m: IconClockHour4,
  random_forest_60m: IconClockHour4,
  yolo: IconRobot,
};

const HORIZON_LABEL: Record<string, string> = {
  random_forest_5m: "5 phút",
  random_forest_10m: "10 phút",
  random_forest_15m: "15 phút",
  random_forest_30m: "30 phút",
  random_forest_60m: "60 phút",
};

function MetricChip({ label, value, unit = "" }: { label: string; value: string | number | undefined; unit?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-muted/40 px-3 py-2 min-w-[64px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-base font-semibold">
        {value !== undefined && value !== null ? `${value}${unit}` : "—"}
      </span>
    </div>
  );
}

// ============================================================
// MODEL DETAIL SHEET
// ============================================================

function ModelDetailSheet({
  model,
  onClose,
  onActivateRequest,
}: {
  model: MLModelMetadata | null;
  onClose: () => void;
  onActivateRequest: (target: MLModelMetadata, currentActive: MLModelMetadata) => void;
}) {
  const { role } = useAuth();
  const isTechnician = role === "technician";
  const [history, setHistory] = useState<ModelHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // History filter / sort states
  type SortKey = "model_version" | "mae" | "r2" | "training_samples" | "created_at";
  const [historySearch, setHistorySearch]     = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo]     = useState("");
  const [historySortKey, setHistorySortKey]   = useState<SortKey>("created_at");
  const [historySortDir, setHistorySortDir]   = useState<"asc" | "desc">("desc");
  const [historyPage, setHistoryPage]         = useState(0);

  // Reset về trang đầu khi filter/sort thay đổi
  useEffect(() => {
    setHistoryPage(0);
  }, [historySearch, historyDateFrom, historyDateTo, historySortKey, historySortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!model) return;
    setHistoryPage(0); // reset page khi đổi model
    setLoadingHistory(true);
    getModelHistory(model.id)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [model]);

  const mae = model?.metrics?.mae;
  const rmse = model?.metrics?.rmse;
  const r2 = model?.metrics?.r2;
  const features = model?.metrics?.features as string[] | undefined;

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    let items = [...history.data];
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase();
      items = items.filter(v => v.model_version.toLowerCase().includes(q));
    }
    if (historyDateFrom)
      items = items.filter(v => new Date(v.created_at) >= new Date(historyDateFrom));
    if (historyDateTo)
      items = items.filter(v => new Date(v.created_at) <= new Date(historyDateTo + "T23:59:59"));
    items.sort((a, b) => {
      let valA: number | string, valB: number | string;
      switch (historySortKey) {
        case "model_version": valA = a.model_version; valB = b.model_version; break;
        case "mae":
          valA = (a.metrics?.mae as number | undefined) ?? 9999;
          valB = (b.metrics?.mae as number | undefined) ?? 9999; break;
        case "r2":
          valA = (a.metrics?.r2 as number | undefined) ?? -9999;
          valB = (b.metrics?.r2 as number | undefined) ?? -9999; break;
        case "training_samples":
          valA = a.training_samples ?? 0; valB = b.training_samples ?? 0; break;
        default:
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
      }
      if (valA < valB) return historySortDir === "asc" ? -1 : 1;
      if (valA > valB) return historySortDir === "asc" ? 1 : -1;
      return 0;
    });
    // Luôn giữ version đang active ở đầu danh sách, bất kể sort
    const activeIdx = items.findIndex(v => v.is_active);
    if (activeIdx > 0) {
      const [activeItem] = items.splice(activeIdx, 1);
      items.unshift(activeItem);
    }
    return items;
  }, [history, historySearch, historyDateFrom, historyDateTo, historySortKey, historySortDir]);

  /** Header ô bảng có thể click để sắp xếp */
  const SortTh = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => {
    const active = historySortKey === col;
    return (
      <TableHead
        className={`text-xs cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
        onClick={() => {
          if (active) setHistorySortDir(d => d === "asc" ? "desc" : "asc");
          else { setHistorySortKey(col); setHistorySortDir("desc"); }
        }}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active
            ? (historySortDir === "asc"
                ? <IconSortAscending className="w-3 h-3 text-primary shrink-0" />
                : <IconSortDescending className="w-3 h-3 text-primary shrink-0" />)
            : <IconArrowsSort className="w-3 h-3 opacity-30 shrink-0" />}
        </span>
      </TableHead>
    );
  };

  return (
    <Sheet open={!!model} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto scrollbar">
        {model && (
          <>
            <SheetHeader className="pb-2">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg">{model.display_name}</SheetTitle>
                {model.is_active && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0">
                    Đang dùng
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs">
                Phiên bản: <span className="font-mono">{model.model_version}</span>
              </SheetDescription>
            </SheetHeader>

            <Separator className="my-3" />

            {/* Thông tin cơ bản */}
            <div className="space-y-2 text-sm mb-4">
              <InfoRow label="Base model" value={model.base_model ?? "—"} />
              <InfoRow
                label="Ngày tạo"
                value={new Date(model.created_at).toLocaleString("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              />
              <InfoRow
                label="Thời gian huấn luyện"
                value={
                  model.training_duration_hours != null
                    ? `${model.training_duration_hours.toFixed(2)} giờ`
                    : "—"
                }
              />
              <InfoRow
                label="MinIO path"
                value={<span className="font-mono text-[11px] break-all">{model.minio_key}</span>}
              />
            </div>

            <Separator className="my-3" />

            {/* Chỉ số hiệu năng */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Chỉ số hiệu năng
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <MetricChip label="MAE" value={mae !== undefined ? mae.toFixed(2) : undefined} unit=" xe" />
              <MetricChip label="RMSE" value={rmse !== undefined ? rmse.toFixed(2) : undefined} unit=" xe" />
              <MetricChip label="R²" value={r2 !== undefined ? r2.toFixed(3) : undefined} />
              <MetricChip
                label="Samples"
                value={
                  model.training_samples != null
                    ? model.training_samples.toLocaleString("vi-VN")
                    : undefined
                }
              />
            </div>

            {features && features.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Features ({features.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {features.map((f) => (
                    <Badge key={f} variant="secondary" className="text-[11px] font-mono">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Lịch sử phiên bản */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Lịch sử phiên bản
            </p>

            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : history && history.data.length > 0 ? (
              <div className="space-y-2">
                {/* Filter controls */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <div className="relative flex-1 min-w-[120px]">
                    <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Tìm phiên bản..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={e => setHistoryDateFrom(e.target.value)}
                    title="Từ ngày"
                    className="w-[110px] px-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={e => setHistoryDateTo(e.target.value)}
                    title="Đến ngày"
                    className="w-[110px] px-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {(historySearch || historyDateFrom || historyDateTo) && (
                    <button
                      onClick={() => { setHistorySearch(""); setHistoryDateFrom(""); setHistoryDateTo(""); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortTh col="model_version" label="Phiên bản" />
                        <SortTh col="mae"             label="MAE"      className="text-right" />
                        <SortTh col="r2"              label="R²"       className="text-right" />
                        <SortTh col="training_samples" label="Samples" className="text-right" />
                        <SortTh col="created_at"      label="Ngày tạo" className="whitespace-nowrap" />
                        <TableHead className="text-xs">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const PAGE_SIZE = 10;
                        const pagedHistory = filteredHistory.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE);
                        if (filteredHistory.length === 0) return (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                              Không tìm thấy phiên bản phù hợp
                            </TableCell>
                          </TableRow>
                        );
                        return pagedHistory.map((v) => (
                        <TableRow key={v.id} className={v.is_active ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                          <TableCell className="font-mono text-[11px]">
                            {v.model_version.length > 15
                              ? `…${v.model_version.slice(-13)}`
                              : v.model_version}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {v.metrics?.mae != null ? (v.metrics.mae as number).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right text-xs font-medium ${getR2Color(
                              v.metrics?.r2 as number | undefined
                            )}`}
                          >
                            {v.metrics?.r2 != null ? (v.metrics.r2 as number).toFixed(3) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {v.training_samples != null
                              ? v.training_samples >= 1000
                                ? `${(v.training_samples / 1000).toFixed(1)}k`
                                : v.training_samples.toString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(v.created_at).toLocaleDateString("vi-VN")}
                          </TableCell>
                          <TableCell>
                            {v.is_active ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-green-50 text-green-700 border-green-200"
                              >
                                Đang dùng
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => model && onActivateRequest(v, model)}
                                disabled={!isTechnician}
                                title={!isTechnician ? "Cần đăng nhập kỹ thuật viên để kích hoạt" : undefined}
                              >
                                <IconCheck className="w-3 h-3 mr-1" />
                                Kích hoạt
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
                {/* Footer: đếm + phân trang */}
                {(() => {
                  const PAGE_SIZE = 10;
                  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
                  const start = filteredHistory.length === 0 ? 0 : historyPage * PAGE_SIZE + 1;
                  const end = Math.min((historyPage + 1) * PAGE_SIZE, filteredHistory.length);
                  return (
                    <div className="flex items-center justify-between pr-1">
                      <p className="text-[10px] text-muted-foreground">
                        Hiển thị {start}–{end}{filteredHistory.length > 0 ? ` / ${filteredHistory.length}` : " 0"} phiên bản
                        {filteredHistory.length < history.data.length && ` (lọc từ ${history.data.length})`}
                      </p>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                            disabled={historyPage === 0}
                            className="px-2 py-0.5 text-[10px] rounded border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ←
                          </button>
                          <span className="text-[10px] text-muted-foreground min-w-[48px] text-center">
                            {historyPage + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={historyPage >= totalPages - 1}
                            className="px-2 py-0.5 text-[10px] rounded border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có lịch sử phiên bản.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}

// ============================================================
// ACTIVATE DIALOG
// ============================================================

interface ActivateTarget {
  target: MLModelMetadata;    // version muốn kích hoạt
  currentActive: MLModelMetadata; // version đang active (cùng loại)
}

function ActivateModelDialog({
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
      setActivateError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setActivating(false);
    }
  };

  const { target, currentActive } = activateTarget ?? {};

  const oldMae = currentActive?.metrics?.mae;
  const newMae = target?.metrics?.mae;
  const oldR2 = currentActive?.metrics?.r2;
  const newR2 = target?.metrics?.r2;
  const maeBetter = oldMae != null && newMae != null ? newMae < oldMae : undefined;
  const r2Better = oldR2 != null && newR2 != null ? newR2 > oldR2 : undefined;

  return (
    <AlertDialog open={!!activateTarget} onOpenChange={(open: boolean) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kích hoạt phiên bản mới?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Loại mô hình: <span className="font-medium text-foreground">{target?.display_name}</span>
              </p>

              {/* So sánh phiên bản */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2 bg-muted/40">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Đang dùng</p>
                  <p className="font-mono text-xs font-medium">
                    {currentActive?.model_version.slice(-13)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MAE: {oldMae != null ? oldMae.toFixed(2) : "—"} &nbsp;|&nbsp; R²:{" "}
                    {oldR2 != null ? oldR2.toFixed(3) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 dark:bg-blue-900/10 dark:border-blue-800">
                  <p className="text-[10px] uppercase text-blue-600 dark:text-blue-400 mb-1">Sẽ kích hoạt</p>
                  <p className="font-mono text-xs font-medium">
                    {target?.model_version.slice(-13)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MAE:{" "}
                    <span className={maeBetter === true ? "text-green-600 font-semibold" : maeBetter === false ? "text-red-500" : ""}>
                      {newMae != null ? newMae.toFixed(2) : "—"}
                      {maeBetter === true && " ↓"}
                      {maeBetter === false && " ↑"}
                    </span>
                    {" "}&nbsp;|&nbsp; R²:{" "}
                    <span className={r2Better === true ? "text-green-600 font-semibold" : r2Better === false ? "text-red-500" : ""}>
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
                  Sau khi kích hoạt, Pod image-predict sẽ được restart để tải model mới từ MinIO.
                  Dự báo sẽ tạm dừng ~2-3 phút.
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

// ============================================================
// MODEL CARD
// ============================================================

function ModelCard({
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
              <CardTitle className="text-sm leading-tight">{model.display_name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {model.base_model ?? "—"}{horizon ? ` • Dự báo ${horizon}` : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
            Đang dùng
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Metrics chips */}
        <div className="flex gap-2">
          <MetricChip label="MAE" value={mae !== undefined ? mae.toFixed(2) : undefined} unit=" xe" />
          <MetricChip label="R²" value={r2 !== undefined ? r2.toFixed(3) : undefined} />
          {model.training_samples != null && (
            <MetricChip
              label="Samples"
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
            Xem chi tiết
          </Button>
          {!isYolo && isTechnician && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onTrainNew(model.model_type)}
              disabled={isTrainingRunning}
              title={isTrainingRunning ? "Đang có tiến trình huấn luyện đang chạy" : undefined}
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

// ============================================================
// TRAIN NEW VERSION MODAL
// ============================================================

const RF_MODEL_TYPES = [
  { value: "random_forest_5m",  label: "Random Forest • Dự báo 5 phút"  },
  { value: "random_forest_10m", label: "Random Forest • Dự báo 10 phút" },
  { value: "random_forest_15m", label: "Random Forest • Dự báo 15 phút" },
  { value: "random_forest_30m", label: "Random Forest • Dự báo 30 phút" },
  { value: "random_forest_60m", label: "Random Forest • Dự báo 60 phút" },
];

function TrainNewVersionModal({
  open,
  initialModelType,
  trainingJob,
  viewProgressMode,
  testMode,
  onClose,
}: {
  open: boolean;
  initialModelType: string | null;
  trainingJob: TrainingJobData | null;
  /** Khi true: bỏ qua step 1-2, hiển thị trực tiếp tiến trình job đang chạy */
  viewProgressMode?: boolean;
  /** Khi true: nhảy thẳng step 3 với fake jobId để test timeout mechanism (TC-09) */
  testMode?: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  // TC-09: timeout khi step 3 không nhận được FIWARE response
  const [jobStartTimeout, setJobStartTimeout] = useState(false);

  // Ngày mặc định: start cố định 13/02/2026, end = hôm qua
  const DEFAULT_START = "2026-02-13";
  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  // Khi modal mở: viewProgressMode → thẳng tới step 3, ngược lại reset bình thường
  useEffect(() => {
    if (!open) return;
    setJobStartTimeout(false);
    if (viewProgressMode) {
      setStep(3);
      setCurrentJobId(trainingJob?.job_id ?? null);
      setSubmitError(null);
    } else if (testMode) {
      // Chế độ test TC-09: nhảy thẳng step 3 với fake jobId để không có FIWARE response
      setCurrentJobId(`test_stuck_${Date.now()}`);
      setStep(3);
      setSubmitError(null);
    } else {
      setSelectedType(initialModelType ?? "random_forest_5m");
      setStartDate(DEFAULT_START);
      setEndDate(getYesterday());
      setStep(1);
      setSubmitError(null);
      setCurrentJobId(null);
    }
  }, [open, initialModelType, viewProgressMode, testMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // TC-09 fix: enable close button nếu không nhận được phản hồi sau 60s
  useEffect(() => {
    if (step !== 3 || activeJob != null) {
      setJobStartTimeout(false);
      return;
    }
    const t = setTimeout(() => setJobStartTimeout(true), 60_000);
    return () => clearTimeout(t);
  }, [step, trainingJob?.job_id, currentJobId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!viewProgressMode && trainingJob && trainingJob.job_id === currentJobId && step !== 3) {
      setStep(3);
    }
  }, [trainingJob, currentJobId, step, viewProgressMode]);

  const handleStartTraining = async () => {
    if (!startDate || !endDate) {
      setSubmitError("Vui lòng chọn đủ ngày bắt đầu và kết thúc");
      return;
    }
    if (startDate >= endDate) {
      setSubmitError("Ngày bắt đầu phải nhỏ hơn ngày kết thúc");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await trainModel({ model_type: selectedType, start_date: startDate, end_date: endDate });
      setCurrentJobId(res.job_id);
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi khởi động training");
    } finally {
      setSubmitting(false);
    }
  };

  // job đang được theo dõi trong step 3
  // viewProgressMode: dùng bất kỳ trainingJob nào đang có (không cần khớp currentJobId)
  const activeJob: TrainingJobData | null = viewProgressMode
    ? trainingJob
    : trainingJob && trainingJob.job_id === currentJobId
    ? trainingJob
    : null;

  const isJobDone = activeJob?.status === "succeeded" || activeJob?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="w-5 h-5 text-primary" />
            Huấn Luyện Phiên Bản Mới
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Bước 1/2: Chọn loại mô hình cần huấn luyện"}
            {step === 2 && "Bước 2/2: Chọn khoảng thời gian dữ liệu"}
            {step === 3 && "Tiến trình huấn luyện"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Chọn loại mô hình */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            {RF_MODEL_TYPES.map((rt) => (
              <label
                key={rt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === rt.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="model_type"
                  value={rt.value}
                  checked={selectedType === rt.value}
                  onChange={() => setSelectedType(rt.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{rt.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* STEP 2: Chọn ngày */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Loại mô hình: </span>
              <span className="font-medium">{RF_MODEL_TYPES.find(r => r.value === selectedType)?.label}</span>
            </div>
            <div className="rounded-md border bg-blue-50/50 dark:bg-blue-900/10 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
              📅 Phạm vi dữ liệu: <span className="font-medium">{DEFAULT_START}</span> → <span className="font-medium">{getYesterday()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={startDate}
                  min={DEFAULT_START}
                  max={getYesterday()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ngày kết thúc</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || DEFAULT_START}
                  max={getYesterday()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ℹ️ Hệ thống sẽ tạo k8s Job chạy <code className="font-mono bg-muted px-1 rounded">train_single.py</code>.
              Kết quả lưu với <strong>is_active=FALSE</strong> — bạn tự kiểm tra và kích hoạt sau.
            </p>
            {submitError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <IconAlertTriangle className="w-3.5 h-3.5" /> {submitError}
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Theo dõi tiến trình */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              {!activeJob || activeJob.status === "running" ? (
                <IconLoader2 className="w-5 h-5 text-primary animate-spin" />
              ) : activeJob.status === "succeeded" ? (
                <IconCircleCheck className="w-5 h-5 text-green-600" />
              ) : (
                <IconCircleX className="w-5 h-5 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {!activeJob ? "Khởi động job..." : activeJob.current_stage}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tiến độ</span>
                <span>{activeJob?.progress_pct ?? 0}%</span>
              </div>
              <Progress value={activeJob?.progress_pct ?? 0} className="h-2" />
            </div>

            {/* Error message */}
            {activeJob?.status === "failed" && activeJob.error_message && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <strong>Lỗi:</strong> {activeJob.error_message}
              </div>
            )}

            {/* TC-09: Timeout khi không nhận được phản hồi */}
            {jobStartTimeout && !activeJob && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300">
                <strong>⚠️ Không nhận được phản hồi sau 60 giây.</strong>
                <br />
                Có thể k8s Job không khởi động được. Kiểm tra:{" "}
                <code className="font-mono bg-muted px-1 rounded">kubectl get jobs -n backend</code>
              </div>
            )}

            {/* Success result */}
            {activeJob?.status === "succeeded" && (
              <div className="space-y-3">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  ✅ Huấn luyện hoàn tất — phiên bản mới đã được lưu với is_active=FALSE
                </p>
                {activeJob.result_metrics && (
                  <div className="flex gap-2">
                    <MetricChip label="MAE"  value={activeJob.result_metrics.mae?.toFixed(2)}  unit=" xe" />
                    <MetricChip label="RMSE" value={activeJob.result_metrics.rmse?.toFixed(2)} unit=" xe" />
                    <MetricChip label="R²"   value={activeJob.result_metrics.r2?.toFixed(3)} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  → Mở <strong>Xem chi tiết</strong> của loại mô hình này để so sánh metrics và kích hoạt phiên bản mới nếu kết quả tốt hơn.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>Hủy</Button>
              <Button onClick={() => setStep(2)} disabled={!selectedType}>
                Tiếp theo
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>Quay lại</Button>
              <Button onClick={handleStartTraining} disabled={submitting}>
                {submitting ? (
                  <><IconLoader2 className="w-4 h-4 mr-2 animate-spin" /> Đang khởi tạo...</>
                ) : (
                  <><IconSparkles className="w-4 h-4 mr-2" /> Bắt đầu huấn luyện</>
                )}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button onClick={onClose} disabled={!isJobDone && !jobStartTimeout}>
              {isJobDone ? "Đóng" : jobStartTimeout ? "Đóng (hết thời gian chờ)" : "Đang xử lý..."}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// PAGE
// ============================================================

export default function ModelsPage() {
  const { trainingJob, modelReload } = useSocket();
  const { role } = useAuth();
  const isTechnician = role === "technician";
  const [models, setModels] = useState<MLModelMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<MLModelMetadata | null>(null);
  const [activateTarget, setActivateTarget] = useState<ActivateTarget | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null);
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [trainTarget, setTrainTarget] = useState<string | null>(null);
  const [showTrainBanner, setShowTrainBanner] = useState(false);
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const [trainModalTestMode, setTrainModalTestMode] = useState(false);
  // 'new': mở bình thường ở step 1 | 'view': nhảy thẳng tới step 3 theo dõi tiến trình
  const [trainModalMode, setTrainModalMode] = useState<'new' | 'view'>('new');

  const isTrainingRunning = trainingJob?.status === 'running';

  const fetchModels = () => {
    setLoading(true);
    setError(null);
    getActiveModels()
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hiển/ẩn banner và auto-close khi job kết thúc
  // Dùng sessionStorage để tránh banner hiện lại sau khi navigate đi rồi quay lại
  const DISMISSED_JOBS_KEY = 'kltn_dismissed_train_jobs';
  const isJobBannerDismissed = (jobId: string) => {
    try { return (JSON.parse(sessionStorage.getItem(DISMISSED_JOBS_KEY) ?? '[]') as string[]).includes(jobId); }
    catch { return false; }
  };
  const markJobBannerDismissed = (jobId: string) => {
    try {
      const arr = JSON.parse(sessionStorage.getItem(DISMISSED_JOBS_KEY) ?? '[]') as string[];
      if (!arr.includes(jobId)) sessionStorage.setItem(DISMISSED_JOBS_KEY, JSON.stringify([...arr, jobId].slice(-10)));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!trainingJob) return;
    const jobId = trainingJob.job_id ?? '';
    // running: luôn hiện (user muốn biết job đang chạy dù navigate)
    if (trainingJob.status === 'running') {
      setShowTrainBanner(true);
      return;
    }
    // succeeded/failed: chỉ hiện nếu chưa từng dismiss job này
    if (isJobBannerDismissed(jobId)) return;
    if (trainingJob.status === 'succeeded') {
      setShowTrainBanner(true);
      // Auto-refetch models sau khi train xong (version mới xuất hiện trong history)
      fetchModels();
      const t = setTimeout(() => { setShowTrainBanner(false); markJobBannerDismissed(jobId); }, 6000);
      return () => clearTimeout(t);
    }
    if (trainingJob.status === 'failed') {
      setShowTrainBanner(true);
      const t = setTimeout(() => { setShowTrainBanner(false); markJobBannerDismissed(jobId); }, 8000);
      return () => clearTimeout(t);
    }
  }, [trainingJob?.status, trainingJob?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload banner: hiện khi activate + tải model mới
  // Dùng sessionStorage tương tự training banner — tránh hiện lại sau khi navigate
  const DISMISSED_RELOADS_KEY = 'kltn_dismissed_model_reloads';
  const isReloadBannerDismissed = (reloadId: string) => {
    try { return (JSON.parse(sessionStorage.getItem(DISMISSED_RELOADS_KEY) ?? '[]') as string[]).includes(reloadId); }
    catch { return false; }
  };
  const markReloadBannerDismissed = (reloadId: string) => {
    try {
      const arr = JSON.parse(sessionStorage.getItem(DISMISSED_RELOADS_KEY) ?? '[]') as string[];
      if (!arr.includes(reloadId)) sessionStorage.setItem(DISMISSED_RELOADS_KEY, JSON.stringify([...arr, reloadId].slice(-10)));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!modelReload) return;
    const reloadId = modelReload.reload_id ?? '';
    // running: luôn hiện
    if (modelReload.status === 'running') {
      setShowReloadBanner(true);
      return;
    }
    // succeeded/failed: chỉ hiện nếu chưa dismiss
    if (isReloadBannerDismissed(reloadId)) return;
    if (modelReload.status === 'succeeded') {
      setShowReloadBanner(true);
      fetchModels(); // refresh card với metrics mới
      const t = setTimeout(() => { setShowReloadBanner(false); markReloadBannerDismissed(reloadId); }, 6000);
      return () => clearTimeout(t);
    }
    if (modelReload.status === 'failed') {
      setShowReloadBanner(true);
      const t = setTimeout(() => { setShowReloadBanner(false); markReloadBannerDismissed(reloadId); }, 8000);
      return () => clearTimeout(t);
    }
  }, [modelReload?.status, modelReload?.reload_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivateSuccess = (modelReloadTriggered: boolean) => {
    const version = activateTarget?.target.model_version ?? "";
    setActivateTarget(null);
    setSelectedModel(null); // đóng Sheet
    const msg = modelReloadTriggered
      ? `Đã kích hoạt phiên bản ${version.slice(-13)} — đang tải model mới vào bộ nhớ...`
      : `Đã kích hoạt phiên bản ${version.slice(-13)} — chưa thể kết nối tới image-predict`;
    setActivateSuccess(msg);
    fetchModels(); // refresh grid
    setTimeout(() => setActivateSuccess(null), 7000);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <PageHeader
        icon={<IconBrain className="w-5 h-5" />}
        title="Mô hình Machine Learning"
        description="Quản lý và theo dõi các mô hình dự đoán lưu lượng giao thông"
      >
        {isTechnician && (
          <Button
            onClick={() => { setTrainModalMode('new'); setTrainTarget(null); setTrainModalOpen(true); }}
            disabled={isTrainingRunning}
            title={isTrainingRunning ? "Đang có tiến trình huấn luyện đang chạy" : undefined}
          >
            <IconSparkles className="w-4 h-4 mr-2" />
            Huấn luyện phiên bản mới
          </Button>
        )}
      </PageHeader>

      {/* Success banner (activate) */}
      {activateSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          <IconCheck className="w-4 h-4 shrink-0" />
          {activateSuccess}
        </div>
      )}

      {/* Persistent training status banner (hiện khi modal đóng) */}
      {trainingJob &&
        showTrainBanner &&
        !trainModalOpen &&
        (trainingJob.status === "running" || trainingJob.status === "failed" || trainingJob.status === "succeeded") && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              trainingJob.status === "running"
                ? "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                : trainingJob.status === "failed"
                ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
                : "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
            }`}
          >
            {trainingJob.status === "running" && (
              <IconLoader2 className="w-4 h-4 shrink-0 animate-spin" />
            )}
            {trainingJob.status === "failed" && (
              <IconCircleX className="w-4 h-4 shrink-0" />
            )}
            {trainingJob.status === "succeeded" && (
              <IconCircleCheck className="w-4 h-4 shrink-0" />
            )}
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="font-medium">
                {trainingJob.status === "running" && `Đang huấn luyện: ${trainingJob.model_type?.replace(/_/g, " ")} — ${trainingJob.current_stage ?? "..."}`}
                {trainingJob.status === "failed" && `Huấn luyện thất bại: ${trainingJob.error_message ?? "Không rõ nguyên nhân"}`}
                {trainingJob.status === "succeeded" && `Huấn luyện hoàn tất: Phiên bản mới đã sẵn sàng để kích hoạt`}
              </span>
              {trainingJob.status === "running" && (
                <Progress value={trainingJob.progress_pct ?? 0} className="h-1.5" />
              )}
            </div>
            {trainingJob.status === "running" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => { setTrainModalMode('view'); setTrainModalOpen(true); }}
              >
                Xem tiến trình
              </Button>
            )}
          </div>
        )}

      {/* Model reload banner (hiện sau khi activate — track tiến trình tải model mới) */}
      {modelReload && showReloadBanner &&
        (modelReload.status === "running" || modelReload.status === "failed" || modelReload.status === "succeeded") && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              modelReload.status === "running"
                ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300"
                : modelReload.status === "failed"
                ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
                : "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
            }`}
          >
            {modelReload.status === "running" && <IconLoader2 className="w-4 h-4 shrink-0 animate-spin" />}
            {modelReload.status === "failed" && <IconCircleX className="w-4 h-4 shrink-0" />}
            {modelReload.status === "succeeded" && <IconCircleCheck className="w-4 h-4 shrink-0" />}
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="font-medium">
                {modelReload.status === "running" && `Đang tải model: ${modelReload.model_type?.replace(/_/g, " ")} — ${modelReload.current_stage ?? "..."}`}
                {modelReload.status === "failed" && `Tải model thất bại: ${modelReload.error_message ?? "Không rõ nguyên nhân"}`}
                {modelReload.status === "succeeded" && `Đã tải model mới${modelReload.model_version ? ` (${modelReload.model_version})` : ""} — dự báo tiếp theo sẽ dùng phiên bản này`}
              </span>
              {modelReload.status === "running" && (
                <Progress value={modelReload.progress_pct ?? 0} className="h-1.5" />
              )}
            </div>
          </div>
        )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-12 w-16 bg-muted rounded-lg" />
                  ))}
                </div>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <strong>Lỗi tải dữ liệu:</strong> {error}
          <Button
            size="sm"
            variant="outline"
            className="ml-4"
            onClick={fetchModels}
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* Chưa có dữ liệu */}
      {!loading && !error && models.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <IconDatabase className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">
            Chưa có mô hình nào trong hệ thống.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Các mô hình sẽ xuất hiện sau khi được upload lên MinIO và đăng ký metadata.
          </p>
        </div>
      )}

      {/* Grid cards */}
      {!loading && !error && models.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onViewDetail={setSelectedModel}
              onTrainNew={(modelType) => { setTrainModalMode('new'); setTrainTarget(modelType); setTrainModalOpen(true); }}
          isTrainingRunning={isTrainingRunning}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <ModelDetailSheet
        model={selectedModel}
        onClose={() => setSelectedModel(null)}
        onActivateRequest={(target, currentActive) =>
          setActivateTarget({ target, currentActive })
        }
      />

      {/* Activate Dialog */}
      <ActivateModelDialog
        activateTarget={activateTarget}
        onCancel={() => setActivateTarget(null)}
        onSuccess={handleActivateSuccess}
      />

      {/* Train New Version Modal */}
      <TrainNewVersionModal
        open={trainModalOpen}
        initialModelType={trainTarget}
        trainingJob={trainingJob}
        viewProgressMode={trainModalMode === 'view'}
        testMode={trainModalTestMode}
        onClose={() => { setTrainModalOpen(false); setTrainModalTestMode(false); }}
      />
    </div>
  );
}
