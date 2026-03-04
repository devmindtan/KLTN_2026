/**
 * Trang Thư viện Dữ liệu - hiển thị danh sách collections và cho phép tải / import
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconDatabase,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconRefresh,
  IconCalendar,
} from "@tabler/icons-react";
import { PageHeader }   from "@/components/page-header";
import { useAuth }      from "@/contexts/AuthContext";
import { toast }        from "sonner";
import type { DataLibraryCollection, CollectionDetail } from "@/services/data-library.service";
import { getCollections, getCollectionById, deleteCollection } from "@/services/data-library.service";
import { CollectionDetailSheet } from "@/components/data-library/collection-detail-sheet";
import { ImportDialog }          from "@/components/data-library/import-dialog";


// ---- Helpers ----

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const SOURCE_LABELS: Record<string, string> = {
  internal: "Nội bộ",
  external:  "Bên ngoài",
};

const DATA_TYPE_LABELS: Record<string, string> = {
  detections_forecasts: "Phát hiện & Dự báo",
  detections:           "Phát hiện",
  forecasts:            "Dự báo",
  custom:               "Tùy chỉnh",
};

// ---- Skeleton card ----

function CollectionCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2 mt-1" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-8 w-full mt-3" />
      </CardContent>
    </Card>
  );
}

// ---- Collection card ----

interface CollectionCardProps {
  collection:   DataLibraryCollection;
  isTechnician: boolean;
  onView:       (c: DataLibraryCollection) => void;
  onImport:     (id: string) => void;
  onDelete:     (id: string) => void;
}

function CollectionCard({ collection: c, isTechnician, onView, onImport, onDelete }: CollectionCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Xóa bộ sưu tập "${c.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteCollection(c.id);
      onDelete(c.id);
      toast.success("Đã xóa bộ sưu tập");
    } catch {
      toast.error("Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconDatabase className="size-4 text-primary shrink-0" />
            <CardTitle className="text-base leading-tight truncate">{c.title}</CardTitle>
          </div>
          <Badge
            variant={c.source === "internal" ? "default" : "secondary"}
            className="shrink-0 text-xs"
          >
            {SOURCE_LABELS[c.source] ?? c.source}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {DATA_TYPE_LABELS[c.data_type] ?? c.data_type}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <IconFolderOpen className="size-3" />
            <span>{c.entry_count} snapshot</span>
          </div>
          {c.last_snapshot_date && (
            <div className="flex items-center gap-1 text-muted-foreground justify-end">
              <IconCalendar className="size-3" />
              <span>Mới nhất: {formatDate(c.last_snapshot_date)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onView(c)}
          >
            Xem chi tiết
          </Button>
          {isTechnician && c.source === "external" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => onImport(c.id)}
              >
                Import
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive px-2"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
                ) : "Xóa"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main page ----

export default function TrafficDataLibrary() {
  const { user }  = useAuth();
  const isTech    = user?.role === "technician";

  const [collections,     setCollections]     = useState<DataLibraryCollection[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [filterSource,    setFilterSource]    = useState<string>("all");
  const [filterType,      setFilterType]      = useState<string>("all");
  const [search,          setSearch]          = useState("");

  // Sheet state
  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [sheetDetail,     setSheetDetail]     = useState<CollectionDetail | null>(null);
  const [sheetLoading,    setSheetLoading]    = useState(false);

  // Import dialog state
  const [importOpen,      setImportOpen]      = useState(false);
  const [importPreselect, setImportPreselect] = useState<string | undefined>(undefined);

  /** Load danh sách collections với bộ lọc hiện tại */
  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSource !== "all") params.source   = filterSource;
      if (filterType   !== "all") params.data_type = filterType;
      if (search.trim())          params.search   = search.trim();
      const res = await getCollections(params);
      setCollections(res.data);
    } catch {
      toast.error("Không thể tải danh sách dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterType, search]);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  /** Mở sheet chi tiết cho một collection */
  const handleViewCollection = async (c: DataLibraryCollection) => {
    setSheetOpen(true);
    setSheetLoading(true);
    try {
      const detail = await getCollectionById(c.id);
      setSheetDetail(detail);
    } catch {
      toast.error("Không thể tải chi tiết");
      setSheetOpen(false);
    } finally {
      setSheetLoading(false);
    }
  };

  /** Mở import dialog với collection được chọn sẵn */
  const handleImportClick = (collectionId?: string) => {
    setImportPreselect(collectionId ?? undefined);
    setImportOpen(true);
  };

  /** Sau khi xóa collection từ card → remove khỏi list */
  const handleCollectionDeleted = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (sheetDetail?.id === id) {
      setSheetOpen(false);
      setSheetDetail(null);
    }
  };

  /** Sau khi xóa entry từ sheet → cập nhật lại sheetDetail */
  const handleEntryDeleted = (entryId: string) => {
    if (!sheetDetail) return;
    setSheetDetail((prev) =>
      prev
        ? { ...prev, entries: prev.entries.filter((e) => e.id !== entryId), entry_count: prev.entry_count - 1 }
        : null
    );
    // Cập nhật summary card
    setCollections((prev) =>
      prev.map((c) =>
        c.id === sheetDetail.id ? { ...c, entry_count: Math.max(0, c.entry_count - 1) } : c
      )
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconDatabase className="w-5 h-5" />}
        title="Thư viện dữ liệu"
        description="Quản lý và truy cập các bộ sưu tập dữ liệu giao thông"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCollections} disabled={loading}>
            <IconRefresh className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {isTech && (
            <Button size="sm" onClick={() => handleImportClick(undefined)}>
              <IconPlus className="size-4 mr-1" />
              Tạo bộ dữ liệu
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Tìm kiếm bộ dữ liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nguồn</SelectItem>
            <SelectItem value="internal">Nội bộ</SelectItem>
            <SelectItem value="external">Bên ngoài</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại dữ liệu</SelectItem>
            <SelectItem value="detections_forecasts">Phát hiện & Dự báo</SelectItem>
            <SelectItem value="detections">Phát hiện</SelectItem>
            <SelectItem value="forecasts">Dự báo</SelectItem>
            <SelectItem value="custom">Tùy chỉnh</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CollectionCardSkeleton key={i} />)
          : collections.length === 0
          ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <IconFolderOpen className="size-10" />
              <p className="text-sm">Không có bộ dữ liệu nào</p>
              {isTech && (
                <Button size="sm" variant="outline" onClick={() => handleImportClick(undefined)}>
                  <IconPlus className="size-4 mr-1" />Tạo bộ dữ liệu đầu tiên
                </Button>
              )}
            </div>
          )
          : collections.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              isTechnician={isTech}
              onView={handleViewCollection}
              onImport={handleImportClick}
              onDelete={handleCollectionDeleted}
            />
          ))
        }
      </div>

      {/* Sheet */}
      <CollectionDetailSheet
        collection={sheetLoading ? null : sheetDetail}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSheetDetail(null); }}
        isTechnician={isTech}
        onEntryDeleted={handleEntryDeleted}
        onImportClick={() => handleImportClick(sheetDetail?.id)}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); loadCollections(); }}
        existingCollections={collections}
        preselectedCollectionId={importPreselect}
      />
    </div>
  );

}