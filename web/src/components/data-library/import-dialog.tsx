/**
 * ImportDialog - Hộp thoại nhập file dữ liệu vào một collection
 * Hai nhánh: nhập vào collection hiện có hoặc tạo collection mới
 */
import { useState, useRef } from "react";
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
import { IconUpload, IconLoader2, IconX } from "@tabler/icons-react";
import type { DataLibraryCollection } from "@/services/data-library.service";
import { importEntry } from "@/services/data-library.service";
import { toast } from "sonner";

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
  const [file,        setFile]        = useState<File | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // Reset form khi đóng rồi mở lại
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setMode(preselectedCollectionId ? "existing" : "new");
      setCollectionId(preselectedCollectionId ?? "");
      setNewTitle("");
      setDataType("");
      setDescription("");
      setFile(null);
      onClose();
    }
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "json") {
      toast.error("Chỉ chấp nhận file .csv hoặc .json");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    handleFileChange(dropped ?? null);
  };

  const valid =
    file != null &&
    snapshotDate !== "" &&
    (mode === "existing" ? collectionId !== "" : newTitle.trim() !== "" && dataType !== "");

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await importEntry({
        collection_id: mode === "existing" ? collectionId : "new",
        new_title:     mode === "new" ? newTitle.trim() : undefined,
        data_type:     mode === "new" ? dataType : undefined,
        description:   mode === "new" && description ? description : undefined,
        snapshot_date: snapshotDate,
        file:          file!,
      });
      toast.success("Import thành công");
      onSuccess?.();
      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import thất bại";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const externalCollections = existingCollections.filter((c) => c.source === "external");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import dữ liệu</DialogTitle>
          <DialogDescription>
            Tải file CSV hoặc JSON vào một bộ sưu tập dữ liệu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
                  {externalCollections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-title">Tên bộ sưu tập <span className="text-destructive">*</span></Label>
                <Input
                  id="new-title"
                  placeholder="Ví dụ: Dữ liệu giao thông tháng 3/2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
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
          <div className="space-y-1.5">
            <Label>File dữ liệu (.csv / .json) <span className="text-destructive">*</span></Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                "h-28 text-sm",
                dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
              ].join(" ")}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".csv,.json"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2 px-4">
                  <span className="truncate max-w-[280px]">{file.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <IconX className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <IconUpload className="size-6 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Kéo thả file hoặc <span className="text-primary underline">chọn từ máy</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? (
              <><IconLoader2 className="size-4 animate-spin mr-1" />Đang tải...</>
            ) : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
