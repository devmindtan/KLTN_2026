import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconCheck,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import { HighlightText } from "@/components/custom/highlight-text";
import { SearchInput } from "@/components/custom/search-input";
import {
  getModelHistory,
  getR2Color,
  type MLModelMetadata,
  type ModelHistoryResponse,
} from "@/services/model.service";
import { useAuth } from "@/contexts/AuthContext";
import { MetricChip } from "@/components/models/metric-chip";
import { METRIC_LABELS } from "@/lib/app-constants";

/**
 * Hàng thông tin label – value dùng trong Sheet chi tiết mô hình.
 */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}

/**
 * Sheet hiển thị thông tin chi tiết + lịch sử phiên bản của một mô hình.
 * GET /api/models/:id/history
 */
export function ModelDetailSheet({
  model,
  onClose,
  onActivateRequest,
}: {
  model: MLModelMetadata | null;
  onClose: () => void;
  onActivateRequest: (
    target: MLModelMetadata,
    currentActive: MLModelMetadata
  ) => void;
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
      items = items.filter((v) => v.model_version.toLowerCase().includes(q));
    }
    if (historyDateFrom)
      items = items.filter(
        (v) => new Date(v.created_at) >= new Date(historyDateFrom)
      );
    if (historyDateTo)
      items = items.filter(
        (v) =>
          new Date(v.created_at) <= new Date(historyDateTo + "T23:59:59")
      );
    items.sort((a, b) => {
      let valA: number | string, valB: number | string;
      switch (historySortKey) {
        case "model_version":
          valA = a.model_version;
          valB = b.model_version;
          break;
        case "mae":
          valA = (a.metrics?.mae as number | undefined) ?? 9999;
          valB = (b.metrics?.mae as number | undefined) ?? 9999;
          break;
        case "r2":
          valA = (a.metrics?.r2 as number | undefined) ?? -9999;
          valB = (b.metrics?.r2 as number | undefined) ?? -9999;
          break;
        case "training_samples":
          valA = a.training_samples ?? 0;
          valB = b.training_samples ?? 0;
          break;
        default:
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
      }
      if (valA < valB) return historySortDir === "asc" ? -1 : 1;
      if (valA > valB) return historySortDir === "asc" ? 1 : -1;
      return 0;
    });
    // Luôn giữ version đang active ở đầu danh sách, bất kể sort
    const activeIdx = items.findIndex((v) => v.is_active);
    if (activeIdx > 0) {
      const [activeItem] = items.splice(activeIdx, 1);
      items.unshift(activeItem);
    }
    return items;
  }, [history, historySearch, historyDateFrom, historyDateTo, historySortKey, historySortDir]);

  /** Header ô bảng có thể click để sắp xếp */
  const SortTh = ({
    col,
    label,
    className = "",
  }: {
    col: SortKey;
    label: string;
    className?: string;
  }) => {
    const active = historySortKey === col;
    return (
      <TableHead
        className={`text-xs cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
        onClick={() => {
          if (active)
            setHistorySortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setHistorySortKey(col);
            setHistorySortDir("desc");
          }
        }}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active ? (
            historySortDir === "asc" ? (
              <IconSortAscending className="w-3 h-3 text-primary shrink-0" />
            ) : (
              <IconSortDescending className="w-3 h-3 text-primary shrink-0" />
            )
          ) : (
            <IconArrowsSort className="w-3 h-3 opacity-30 shrink-0" />
          )}
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
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 shrink-0"
                  >
                    Đang dùng
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs">
                Phiên bản:{" "}
                <span className="font-mono">{model.model_version}</span>
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
                value={
                  <span className="font-mono text-[11px] break-all">
                    {model.minio_key}
                  </span>
                }
              />
            </div>

            <Separator className="my-3" />

            {/* Chỉ số hiệu năng */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Chỉ số hiệu năng
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <MetricChip
                label={METRIC_LABELS.MAE}
                value={mae !== undefined ? mae.toFixed(2) : undefined}
                unit=" xe"
              />
              <MetricChip
                label={METRIC_LABELS.RMSE}
                value={rmse !== undefined ? rmse.toFixed(2) : undefined}
                unit=" xe"
              />
              <MetricChip
                label={METRIC_LABELS.R2}
                value={r2 !== undefined ? r2.toFixed(3) : undefined}
              />
              <MetricChip
                label={METRIC_LABELS.SAMPLES}
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
                    <Badge
                      key={f}
                      variant="secondary"
                      className="text-[11px] font-mono"
                    >
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
                  <SearchInput
                    size="sm"
                    placeholder="Tìm phiên bản..."
                    value={historySearch}
                    onChange={setHistorySearch}
                    className="flex-1 min-w-[120px]"
                  />
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    title="Từ ngày"
                    className="w-[110px] px-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    title="Đến ngày"
                    className="w-[110px] px-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {(historySearch || historyDateFrom || historyDateTo) && (
                    <button
                      onClick={() => {
                        setHistorySearch("");
                        setHistoryDateFrom("");
                        setHistoryDateTo("");
                      }}
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
                        <SortTh col="mae"            label={METRIC_LABELS.MAE}  className="text-right" />
                        <SortTh col="r2"             label={METRIC_LABELS.R2}   className="text-right" />
                        <SortTh col="training_samples" label="Mẫu" className="text-right" />
                        <SortTh col="created_at"    label="Ngày tạo" className="whitespace-nowrap" />
                        <TableHead className="text-xs">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const PAGE_SIZE = 10;
                        const pagedHistory = filteredHistory.slice(
                          historyPage * PAGE_SIZE,
                          (historyPage + 1) * PAGE_SIZE
                        );
                        if (filteredHistory.length === 0)
                          return (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center text-xs text-muted-foreground py-4"
                              >
                                Không tìm thấy phiên bản phù hợp
                              </TableCell>
                            </TableRow>
                          );
                        return pagedHistory.map((v) => (
                          <TableRow
                            key={v.id}
                            className={
                              v.is_active
                                ? "bg-green-50/50 dark:bg-green-900/10"
                                : ""
                            }
                          >
                            <TableCell
                              className="font-mono text-[11px]"
                              title={v.model_version}
                            >
                              <HighlightText
                                text={v.model_version}
                                query={historySearch}
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {v.metrics?.mae != null
                                ? (v.metrics.mae as number).toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right text-xs font-medium ${getR2Color(
                                v.metrics?.r2 as number | undefined
                              )}`}
                            >
                              {v.metrics?.r2 != null
                                ? (v.metrics.r2 as number).toFixed(3)
                                : "—"}
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
                                  onClick={() =>
                                    model && onActivateRequest(v, model)
                                  }
                                  disabled={!isTechnician}
                                  title={
                                    !isTechnician
                                      ? "Cần đăng nhập kỹ thuật viên để kích hoạt"
                                      : undefined
                                  }
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
                  const totalPages = Math.ceil(
                    filteredHistory.length / PAGE_SIZE
                  );
                  const start =
                    filteredHistory.length === 0
                      ? 0
                      : historyPage * PAGE_SIZE + 1;
                  const end = Math.min(
                    (historyPage + 1) * PAGE_SIZE,
                    filteredHistory.length
                  );
                  return (
                    <div className="flex items-center justify-between pr-1">
                      <p className="text-[10px] text-muted-foreground">
                        Hiển thị {start}–{end}
                        {filteredHistory.length > 0
                          ? ` / ${filteredHistory.length}`
                          : " 0"}{" "}
                        phiên bản
                        {filteredHistory.length < history.data.length &&
                          ` (lọc từ ${history.data.length})`}
                      </p>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setHistoryPage((p) => Math.max(0, p - 1))
                            }
                            disabled={historyPage === 0}
                            className="px-2 py-0.5 text-[10px] rounded border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ←
                          </button>
                          <span className="text-[10px] text-muted-foreground min-w-[48px] text-center">
                            {historyPage + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setHistoryPage((p) =>
                                Math.min(totalPages - 1, p + 1)
                              )
                            }
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
              <p className="text-sm text-muted-foreground">
                Chưa có lịch sử phiên bản.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
