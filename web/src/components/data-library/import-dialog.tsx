/**
 * ImportDialog - Hộp thoại nhập file dữ liệu vào một collection
 * Hai nhánh: nhập vào collection hiện có hoặc tạo collection mới
 */
import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button }     from "@/components/ui/button";
import { Input }      from "@/components/ui/input";
import { Label }      from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea }   from "@/components/ui/textarea";
import { IconUpload, IconLoader2, IconX, IconPencil, IconCheck, IconFile, IconFiles } from "@tabler/icons-react";
import type { DataLibraryCollection } from "@/services/data-library.service";
import { importEntry } from "@/services/data-library.service";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface FileItem {
  id:          string;
  file:        File;
  displayName: string; // tên hiển thị / đổi tên (kể cả đuôi file)
  editing:     boolean;
}

const ACCEPTED_EXTS = ["csv", "json"];

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
const DATA_TYPE_OPTIONS = [
  { value: "detections_forecasts",  label: "Phát hiện & Dự báo" },
  { value: "detections",            label: "Phát hiện" },
  { value: "forecasts",             label: "Dự báo" },
  { value: "custom",                label: "Tùy chỉnh" },
];

interface ImportDialogProps {
  open:                 boolean;
  onClose:              () => void;
  onSuccess?:           () => void;
  existingCollections?: DataLibraryCollection[];
  /** Nếu truyền vào, dialog khởi tạo sẵn ở mode "existing" với id này */
  preselectedCollectionId?: string;
}

export function ImportDialog({
  open,
  onClose,
  onSuccess,
  existingCollections = [],
  preselectedCollectionId,
}: ImportDialogProps) {
  const [mode,        setMode]        = useState<"existing" | "new">(
    preselectedCollectionId ? "existing" : "new"
  );
  const [collectionId, setCollectionId] = useState(preselectedCollectionId ?? "");
  const [newTitle,    setNewTitle]    = useState("");
  const [dataType,    setDataType]    = useState("");
  const [description, setDescription] = useState("");
  const [snapshotDate, setSnapshotDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [files,        setFiles]       = useState<FileItem[]>([]);
  const [editBuf,      setEditBuf]     = useState<string>("");
  const [dragging,    setDragging]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [showPanel,   setShowPanel]   = useState(false); // side panel file list (desktop)
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // Sync mode và collectionId khi prop preselectedCollectionId thay đổi (mỗi lần dialog mở)
  useEffect(() => {
    if (open) {
      if (preselectedCollectionId) {
        setMode("existing");
        setCollectionId(preselectedCollectionId);
      } else {
        setMode("new");
        setCollectionId("");
      }
      setNewTitle("");
      setDataType("");
      setDescription("");
      setFiles([]);
      setEditBuf("");
      setShowPanel(false);
    }
  }, [open, preselectedCollectionId]);

  // Reset form khi đóng
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
    }
  };

  /** Xử lý thêm files (từ input hoặc drag) */
  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newItems: FileItem[] = [];
    const rejected: string[] = [];
    Array.from(fileList).forEach((f) => {
      if (!ACCEPTED_EXTS.includes(getExt(f.name))) {
        rejected.push(f.name);
        return;
      }
      newItems.push({ id: crypto.randomUUID(), file: f, displayName: f.name, editing: false });
    });
    if (rejected.length) toast.error(`Bỏ qua ${rejected.length} file không hợp lệ (chỉ .csv / .json)`);
    if (newItems.length) {
      setFiles((prev) => [...prev, ...newItems]);
      setShowPanel(true); // tự mở panel khi có file
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  /** Bắt đầu rename */
  const startEdit = (id: string, current: string) => {
    setEditBuf(current);
    setFiles((prev) => prev.map((f) => ({ ...f, editing: f.id === id })));
  };

  /** Xác nhận rename — giữ đuôi gốc nếu người dùng xóa mất */
  const commitEdit = (id: string, origFile: File) => {
    const origExt = "." + getExt(origFile.name);
    let name = editBuf.trim() || origFile.name;
    if (!name.toLowerCase().endsWith(origExt)) name += origExt;
    setFiles((prev) =>
      prev.map((f) => f.id === id ? { ...f, displayName: name, editing: false } : f)
    );
  };

  const valid =
    files.length > 0 &&
    snapshotDate !== "" &&
    (mode === "existing" ? collectionId !== "" : newTitle.trim() !== "" && dataType !== "");

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    let successCount = 0;
    try {
      for (const item of files) {
        // Tạo File mới với tên đã đổi
        const renamedFile = item.displayName !== item.file.name
          ? new File([item.file], item.displayName, { type: item.file.type })
          : item.file;
        await importEntry({
          collection_id: mode === "existing" ? collectionId : "new",
          new_title:     mode === "new" ? newTitle.trim() : undefined,
          data_type:     mode === "new" ? dataType : undefined,
          description:   mode === "new" && description ? description : undefined,
          snapshot_date: snapshotDate,
          file:          renamedFile,
        });
        successCount++;
      }
      toast.success(`Import thành công ${successCount} file`);
      onSuccess?.();
      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import thất bại";
      toast.error(`${msg} (đã import ${successCount}/${files.length})`);
    } finally {
      setSubmitting(false);
    }
  };

  const externalCollections = existingCollections.filter((c) => c.source === "external");

  /** Reusable file row (dùng cả trong inline list lẫn side panel) */
  const FileRow = ({ item }: { item: FileItem }) => (
    <div className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-muted/50">
      <IconFile className="size-4 text-muted-foreground shrink-0" />
      {item.editing ? (
        <>
          <input
            autoFocus
            className="flex-1 min-w-0 text-xs h-6 rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={editBuf}
            onChange={(e) => setEditBuf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(item.id, item.file);
              if (e.key === "Escape")
                setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, editing: false } : f));
            }}
          />
          <button type="button" className="shrink-0 text-primary hover:text-primary/80" onClick={() => commitEdit(item.id, item.file)}>
            <IconCheck className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-xs" title={item.displayName}>{item.displayName}</span>
          <button type="button" title="Đổi tên file" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" onClick={() => startEdit(item.id, item.displayName)}>
            <IconPencil className="size-3.5" />
          </button>
        </>
      )}
      <button type="button" className="shrink-0 text-muted-foreground hover:text-destructive transition-colors" onClick={() => removeFile(item.id)}>
        <IconX className="size-3.5" />
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`p-0 gap-0 overflow-hidden transition-[max-width] duration-200 [&>button.absolute]:hidden ${
        showPanel ? "sm:max-w-2xl" : "sm:max-w-md"
      }`}>
        <div className="flex h-full">

          {/* ---- Cột trái: form ---- */}
          <div className="flex flex-col flex-1 min-w-0 p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-1.5">
                <DialogTitle>Import dữ liệu</DialogTitle>
                {/* Toggle side panel — chỉ hiện trên desktop, inline với title */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`relative hidden sm:flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                          showPanel
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setShowPanel((v) => !v)}
                      >
                        <IconFiles className="size-4" />
                        {files.length > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center leading-none">
                            {files.length > 9 ? "9+" : files.length}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-md text-xs px-2 py-1">
                      {showPanel ? "Ẩn danh sách file" : "Xem danh sách file"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <DialogDescription>
                Tải file CSV hoặc JSON vào một bộ sưu tập dữ liệu
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto scrollbar flex-1 pr-0.5">
              {/* Mode selector */}
              <RadioGroup
                value={mode}
                onValueChange={(v: string) => setMode(v as "existing" | "new")}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="mode-new" />
                  <Label htmlFor="mode-new">Tạo bộ dữ liệu mới</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id="mode-existing" disabled={externalCollections.length === 0} />
                  <Label htmlFor="mode-existing" className={externalCollections.length === 0 ? "text-muted-foreground" : ""}>
                    Bộ dữ liệu hiện có
                  </Label>
                </div>
              </RadioGroup>

              {/* Fields depending on mode */}
              {mode === "existing" ? (
                <div className="space-y-2">
                  <Label>Chọn bộ sưu tập</Label>
                  <Select value={collectionId} onValueChange={setCollectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn bộ sưu tập..." />
                    </SelectTrigger>
                    <SelectContent>
                      {externalCollections.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Chưa có bộ sưu tập nào
                        </div>
                      ) : (
                        externalCollections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-title">Tên bộ sưu tập <span className="text-destructive">*</span></Label>
                    <Input
                      id="new-title"
                      placeholder="Ví dụ: Dữ liệu giao thông tháng 3"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      maxLength={30}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Loại dữ liệu <span className="text-destructive">*</span></Label>
                    <Select value={dataType} onValueChange={setDataType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn loại dữ liệu..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Mô tả (tùy chọn)</Label>
                    <Textarea
                      id="description"
                      rows={2}
                      placeholder="Ghi chú thêm về bộ sưu tập này..."
                      value={description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Snapshot date */}
              <div className="space-y-1.5">
                <Label htmlFor="snapshot-date">Ngày snapshot <span className="text-destructive">*</span></Label>
                <Input
                  id="snapshot-date"
                  type="date"
                  value={snapshotDate}
                  onChange={(e) => setSnapshotDate(e.target.value)}
                />
              </div>

              {/* File upload drop zone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>File dữ liệu (.csv / .json) <span className="text-destructive">*</span></Label>
                  {files.length > 0 && (
                    <span className="text-xs text-muted-foreground">{files.length} file đã chọn</span>
                  )}
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors h-20 text-sm select-none",
                    dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
                  ].join(" ")}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".csv,.json"
                    multiple
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                  <IconUpload className="size-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    Kéo thả hoặc <span className="text-primary underline">chọn file</span> (nhiều file)
                  </span>
                </div>

                {/* Danh sách file — chỉ hiện trên mobile (desktop dùng side panel) */}
                {files.length > 0 && (
                  <div className="sm:hidden space-y-1 max-h-36 overflow-y-auto scrollbar rounded-md border p-1">
                    {files.map((item) => <FileRow key={item.id} item={item} />)}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={!valid || submitting}>
                {submitting ? (
                  <><IconLoader2 className="size-4 animate-spin mr-1" />Đang tải...</>
                ) : `Import${files.length > 1 ? ` (${files.length})` : ""}`}
              </Button>
            </DialogFooter>
          </div>

          {/* ---- Cột phải: side panel file list (chỉ desktop) ---- */}
          {showPanel && (
            <div className="hidden sm:flex flex-col w-64 shrink-0 border-l">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-medium">File đã chọn</span>
                <span className="text-xs text-muted-foreground">{files.length} file</span>
              </div>
              {files.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground p-4 text-center">
                  Chưa có file nào được chọn
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar p-2 space-y-0.5">
                  {files.map((item) => <FileRow key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
