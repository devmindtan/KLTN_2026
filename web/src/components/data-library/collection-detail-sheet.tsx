/**
 * CollectionDetailSheet - Sheet bên phải hiển thị chi tiết collection
 * Entries được nhóm theo ngày (accordion), mỗi ngày liệt kê các files có thể tải
 */
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { IconDownload, IconFile, IconSearch, IconLoader2, IconTrash } from "@tabler/icons-react";
import type { CollectionDetail } from "@/services/data-library.service";
import { downloadEntryFile, deleteEntry } from "@/services/data-library.service";
import { toast } from "sonner";

// ---- Helpers ----

const FILE_KEY_LABELS: Record<string, string> = {
  detections_csv:  "Phát hiện (CSV)",
  detections_json: "Phát hiện (JSON)",
  forecasts_csv:   "Dự báo (CSV)",
  forecasts_json:  "Dự báo (JSON)",
  summary:         "Tổng hợp (JSON)",
  csv:             "File CSV",
  json:            "File JSON",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---- Sub-component: 1 hàng file ----

interface SnapshotFileRowProps {
  fileKey:   string;
  minioKey:  string;
  fileSize?: number;
  entryId:   string;
  dateStr:   string;
  title:     string;
}

function SnapshotFileRow({ fileKey, minioKey, fileSize, entryId, dateStr, title }: SnapshotFileRowProps) {
  const [loading, setLoading] = useState(false);
  const ext      = minioKey.replace(/\.gz$/, "").split(".").pop() ?? "bin";
  const filename = `${title}_${dateStr}_${fileKey}.${ext}`;
  const label    = FILE_KEY_LABELS[fileKey] ?? fileKey;

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
          <span className="text-xs text-muted-foreground shrink-0">({formatBytes(fileSize)})</span>
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

// ---- Main Component ----

interface CollectionDetailSheetProps {
  collection: CollectionDetail | null;
  open:       boolean;
  onClose:    () => void;
  isTechnician: boolean;
  onEntryDeleted?: (entryId: string) => void;
  onImportClick?: () => void;
}

export function CollectionDetailSheet({
  collection,
  open,
  onClose,
  isTechnician,
  onEntryDeleted,
  onImportClick,
}: CollectionDetailSheetProps) {
  const [search,       setSearch]       = useState("");
  const [loadingBulk,  setLoadingBulk]  = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  if (!collection) return null;

  const safeTitle = collection.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Filter entries by date search
  const filteredEntries = collection.entries.filter((e) =>
    e.snapshot_date.includes(search)
  );

  const handleBulkDownload = async (entryId: string, dateStr: string) => {
    setLoadingBulk(entryId);
    try {
      await downloadEntryFile(entryId, "all", `${safeTitle}_${dateStr}.zip`);
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
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="leading-tight">{collection.title}</SheetTitle>
              <SheetDescription className="mt-1">
                <Badge variant={collection.source === "internal" ? "default" : "secondary"} className="mr-2">
                  {collection.source === "internal" ? "Nội bộ" : "Bên ngoài"}
                </Badge>
                <span className="text-xs">{collection.data_type}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Tìm ngày (VD: 2026-03-04)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isTechnician && (
            <Button size="sm" variant="outline" onClick={onImportClick}>
              + Import
            </Button>
          )}
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {search ? "Không tìm thấy ngày phù hợp" : "Chưa có dữ liệu nào"}
            </p>
          ) : (
            <Accordion type="single" collapsible className="space-y-1">
              {filteredEntries.map((entry) => {
                const dateStr  = entry.snapshot_date.split("T")[0];
                const keys     = Object.entries(entry.minio_keys ?? {});
                const isBulkLoading = loadingBulk === entry.id;
                const isDeleting    = deletingId === entry.id;

                return (
                  <AccordionItem
                    key={entry.id}
                    value={entry.id}
                    className="border rounded-lg px-1"
                  >
                    <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                      <div className="flex items-center justify-between w-full mr-2">
                        <span className="text-sm font-medium">{formatDate(dateStr)}</span>
                        <div className="flex items-center gap-2">
                          {entry.record_count != null && (
                            <span className="text-xs text-muted-foreground">
                              {entry.record_count.toLocaleString("vi-VN")} records
                            </span>
                          )}
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
                                onClick={() => handleBulkDownload(entry.id, dateStr)}
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
                              onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                              disabled={isDeleting}
                            >
                              {isDeleting
                                ? <IconLoader2 className="size-3 animate-spin" />
                                : <IconTrash className="size-3" />
                              }
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
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
    </Sheet>
  );
}
