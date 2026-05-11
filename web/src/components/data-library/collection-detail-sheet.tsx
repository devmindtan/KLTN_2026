/**
 * CollectionDetailSheet - Sheet bên phải hiển thị chi tiết collection
 * Entries được nhóm theo ngày (accordion), mỗi ngày liệt kê các files có thể tải
 */
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconDownload,
  IconFile,
  IconLoader2,
  IconPencil,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CollectionDetail,
  DataLibraryCollection,
} from "@/services/data-library.service";
import {
  downloadEntryFile,
  deleteEntry,
} from "@/services/data-library.service";
import { toast } from "sonner";

// ---- Helpers ----

const DATA_TYPE_LABELS: Record<string, string> = {
  detections_forecasts: "Phát hiện & Dự báo",
  detections: "Phát hiện",
  forecasts: "Dự báo",
  custom: "Tùy chỉnh",
};

const FILE_KEY_LABELS: Record<string, string> = {
  detections_csv: "Phát hiện (CSV)",
  detections_json: "Phát hiện (JSON)",
  forecasts_csv: "Dự báo (CSV)",
  forecasts_json: "Dự báo (JSON)",
  summary: "Tổng hợp (JSON)",
  csv: "File CSV",
  json: "File JSON",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---- Sub-component: 1 hàng file ----

interface SnapshotFileRowProps {
  fileKey: string;
  minioKey: string;
  fileSize?: number;
  entryId: string;
  dateStr: string;
  title: string;
}

function SnapshotFileRow({
  fileKey,
  minioKey,
  fileSize,
  entryId,
  dateStr,
  title,
}: SnapshotFileRowProps) {
  const [loading, setLoading] = useState(false);
  // Tên file giữ nguyên theo tên gốc trên MinIO (bỏ .gz)
  const filename =
    minioKey.split("/").pop()?.replace(/\.gz$/, "") ??
    `${title}_${dateStr}_${fileKey}`;
  const label = FILE_KEY_LABELS[fileKey] ?? fileKey;

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadEntryFile(entryId, fileKey, filename);
    } catch {
      toast.error("Tải file thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <IconFile className="size-4 text-muted-foreground shrink-0" />
        <span className="truncate">{label}</span>
        {fileSize && (
          <span className="text-xs text-muted-foreground shrink-0">
            ({formatBytes(fileSize)})
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 shrink-0"
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconDownload className="size-4" />
        )}
      </Button>
    </div>
  );
}

// Tính default range: endDate = hôm nay, startDate = hôm nay - 6 ngày (tổng 7 ngày)
function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

// ---- Main Component ----

interface CollectionDetailSheetProps {
  collection: CollectionDetail | null;
  open: boolean;
  onClose: () => void;
  isTechnician: boolean;
  onEntryDeleted?: (entryId: string) => void;
  onImportClick?: () => void;
  onEditClick?: (collection: DataLibraryCollection) => void;
}

export function CollectionDetailSheet({
  collection,
  open,
  onClose,
  isTechnician,
  onEntryDeleted,
  onImportClick,
  onEditClick,
}: CollectionDetailSheetProps) {
  const DEFAULT_RANGE = getDefaultRange();
  const [startDate, setStartDate] = useState(DEFAULT_RANGE.start);
  const [endDate, setEndDate] = useState(DEFAULT_RANGE.end);
  const [loadingBulk, setLoadingBulk] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!collection) return null;

  const safeTitle = collection.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Filter entries theo date range [startDate, endDate]
  const filteredEntries = collection.entries.filter((e) => {
    const d = e.snapshot_date.split("T")[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  const isFiltered =
    startDate !== DEFAULT_RANGE.start || endDate !== DEFAULT_RANGE.end;

  const resetRange = () => {
    setStartDate(DEFAULT_RANGE.start);
    setEndDate(DEFAULT_RANGE.end);
  };

  const handleBulkDownload = async (entryId: string, dateStr: string) => {
    setLoadingBulk(entryId);
    try {
      await downloadEntryFile(
        entryId,
        "all",
        `${collection.data_type}_${dateStr}.zip`,
      );
    } catch {
      toast.error("Tải zip thất bại");
    } finally {
      setLoadingBulk(null);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      await deleteEntry(entryId);
      toast.success("Đã xóa snapshot");
      onEntryDeleted?.(entryId);
    } catch {
      toast.error("Xóa thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetDescription className="sr-only">
            Chi tiết bộ dữ liệu {collection.title}
          </SheetDescription>
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <SheetTitle className="leading-tight truncate max-w-[18rem]">
                {collection.title}
              </SheetTitle>
              {isTechnician && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => onEditClick?.(collection)}
                    >
                      <IconPencil className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Chỉnh sửa thông tin</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              <Badge
                variant={
                  collection.source === "internal" ? "default" : "secondary"
                }
                className="mr-2"
              >
                {collection.source === "internal" ? "Nội bộ" : "Bên ngoài"}
              </Badge>
              <span className="text-xs">
                {DATA_TYPE_LABELS[collection.data_type] ?? collection.data_type}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5">
              <input
                type="date"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground shrink-0">—</span>
              <input
                type="date"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {isFiltered && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={resetRange}
                    >
                      <IconX className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Đặt lại về 7 ngày gần nhất</TooltipContent>
                </Tooltip>
              )}
            </div>
            {isTechnician && collection.source === "external" && (
              <Button size="sm" variant="outline" onClick={onImportClick}>
                + Nạp dữ liệu
              </Button>
            )}
          </div>
          <p className="px-1 mt-1.5 text-xs text-muted-foreground">
            {filteredEntries.length} / {collection.entries.length} snapshot
            {isFiltered && " "}
          </p>
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto scrollbar px-6 py-4">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {isFiltered
                ? "Không có snapshot trong khoảng ngày này"
                : "Chưa có dữ liệu nào"}
            </p>
          ) : (
            <Accordion type="single" collapsible className="space-y-1">
              {filteredEntries.map((entry) => {
                const dateStr = entry.snapshot_date.split("T")[0];
                const keys = Object.entries(entry.minio_keys ?? {});
                const isBulkLoading = loadingBulk === entry.id;
                const isDeleting = deletingId === entry.id;

                return (
                  <AccordionItem
                    key={entry.id}
                    value={entry.id}
                    className="border rounded-lg"
                  >
                    {/* Header row: trigger (title) + action buttons – actions ở ngoài button trigger */}
                    <div className="flex items-center pr-3">
                      <AccordionTrigger className="flex-1 px-3 py-2.5 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {formatDate(dateStr)}
                          </span>
                          {entry.record_count != null && (
                            <span className="text-xs text-muted-foreground">
                              {entry.record_count.toLocaleString("vi-VN")}{" "}
                              records
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      {/* Action buttons ở ngoài AccordionTrigger tránh button>button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => e.stopPropagation()}
                              disabled={isBulkLoading}
                            >
                              {isBulkLoading ? (
                                <IconLoader2 className="size-3 animate-spin" />
                              ) : (
                                <IconDownload className="size-3" />
                              )}
                              <span className="ml-1">Tải về</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleBulkDownload(entry.id, dateStr)
                              }
                            >
                              Tải tất cả (ZIP)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {isTechnician && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(entry.id);
                            }}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <IconLoader2 className="size-3 animate-spin" />
                            ) : (
                              <IconTrash className="size-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <AccordionContent className="px-2 pb-2">
                      <div className="space-y-0.5">
                        {keys.map(([key, minioKey]) => (
                          <SnapshotFileRow
                            key={key}
                            fileKey={key}
                            minioKey={minioKey}
                            fileSize={entry.file_sizes?.[key]}
                            entryId={entry.id}
                            dateStr={dateStr}
                            title={safeTitle}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </SheetContent>

      {/* Confirm xóa entry */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa snapshot</AlertDialogTitle>
            <AlertDialogDescription>
              Snapshot này và toàn bộ files trên storage sẽ bị xóa vĩnh viễn.
              Hành động không thể phục hồi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) handleDeleteEntry(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
