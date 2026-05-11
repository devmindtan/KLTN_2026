/**
 * EditCollectionDialog - Dialog chỉnh sửa thông tin collection
 * Cho phép sửa tiêu đề, mô tả và loại dữ liệu (chỉ dành cho Technician)
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2 } from "@tabler/icons-react";
import type { DataLibraryCollection } from "@/services/data-library.service";
import { updateCollection } from "@/services/data-library.service";
import { toast } from "sonner";

interface EditCollectionDialogProps {
  collection: DataLibraryCollection | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: DataLibraryCollection) => void;
}

export function EditCollectionDialog({
  collection,
  open,
  onClose,
  onUpdated,
}: EditCollectionDialogProps) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [dataType,    setDataType]    = useState("");
  const [saving,      setSaving]      = useState(false);

  // Sync form khi collection thay đổi hoặc dialog mở
  useEffect(() => {
    if (open && collection) {
      setTitle(collection.title ?? "");
      setDescription(collection.description ?? "");
      setDataType(collection.data_type ?? "custom");
    }
  }, [open, collection]);

  const handleSubmit = async () => {
    if (!collection) return;
    if (!title.trim()) {
      toast.error("Tên bộ dữ liệu không được để trống");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCollection(collection.id, {
        title: title.trim(),
        description: description.trim() || null,
        data_type: dataType,
      });
      toast.success("Đã cập nhật thông tin bộ dữ liệu");
      onUpdated(updated);
      onClose();
    } catch {
      toast.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bộ dữ liệu</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin tiêu đề, mô tả và loại dữ liệu của bộ sưu tập.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tên */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">
              Tên bộ dữ liệu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Dữ liệu giao thông tháng 3/2026"
              maxLength={30}
            />
          </div>

          {/* Loại dữ liệu */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-data-type">Loại dữ liệu</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger id="edit-data-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detections_forecasts">Phát hiện &amp; Dự báo</SelectItem>
                <SelectItem value="detections">Phát hiện</SelectItem>
                <SelectItem value="forecasts">Dự báo</SelectItem>
                <SelectItem value="custom">Tùy chỉnh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Mô tả (tùy chọn)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về nội dung bộ dữ liệu..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              <span className={title.length >= 28 ? "text-destructive" : ""}>{title.length}</span>/30 (tên)
              {" · "}
              {description.length}/500 (mô tả)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <IconLoader2 className="size-4 mr-2 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu thay đổi"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
