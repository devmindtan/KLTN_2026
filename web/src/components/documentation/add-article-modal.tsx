/**
 * AddArticleModal — Modal cho kỹ thuật viên tạo article mới.
 * Nhập section_key, tiêu đề, chọn parent section.
 */
import { useState, useCallback, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HelpArticle, CreateArticlePayload } from "@/services/help.service";

interface AddArticleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateArticlePayload) => Promise<void>;
  /** Pre-filled parentKey khi user click "Thêm mục con" từ một section cụ thể */
  defaultParentKey: string | null;
  /** Danh sách section gốc để chọn parent */
  rootSections: HelpArticle[];
}

/** Tạo slug từ chuỗi tiếng Việt */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function AddArticleModal({
  open,
  onClose,
  onConfirm,
  defaultParentKey,
  rootSections,
}: AddArticleModalProps) {
  const [title, setTitle]           = useState("");
  const [sectionKey, setSectionKey]  = useState("");
  const [parentKey, setParentKey]    = useState<string>(defaultParentKey ?? "__root__");
  const [articleType, setArticleType] = useState<"document" | "question">("document");
  const [loading, setLoading]        = useState(false);
  const [error, setError]            = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Sync parentKey khi defaultParentKey thay đổi (mỗi lần modal mở với context khác nhau)
  useEffect(() => {
    setParentKey(defaultParentKey ?? "__root__");
  }, [defaultParentKey, open]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSectionKey(toSlug(v));
    setIsDuplicate(false);
  };

  const handleKeyChange = (v: string) => {
    setSectionKey(v.toLowerCase().replace(/\s+/g, "-"));
    setIsDuplicate(false);
  };

  const handleConfirm = useCallback(async () => {
    if (!title.trim()) { setError("Tiêu đề không được để trống"); return; }
    if (!sectionKey.trim()) { setError("Section key không được để trống"); return; }

    setLoading(true);
    setError(null);
    setIsDuplicate(false);
    try {
      await onConfirm({
        section_key: sectionKey,
        parent_key: parentKey === "__root__" ? null : parentKey,
        type: articleType,
        title: title.trim(),
        summary: "",
        content: "## " + title.trim() + "\n\n_(Chưa có nội dung — nhấn Chỉnh sửa để thêm)_",
        tech_detail: null,
      });
      setTitle("");
      setSectionKey("");
      setParentKey(defaultParentKey ?? "__root__");
      setArticleType("document");
      setIsDuplicate(false);
      onClose();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "DUPLICATE_KEY") {
        setIsDuplicate(true);
        setError(null);
      } else {
        setError(err.message ?? "Có lỗi xảy ra");
      }
    } finally {
      setLoading(false);
    }
  }, [title, sectionKey, parentKey, articleType, defaultParentKey, onConfirm, onClose]);

  return (
    <Dialog open={open} onOpenChange={v => {
      if (!v) {
        setError(null);
        setIsDuplicate(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm mục mới</DialogTitle>
          <DialogDescription>
            Tạo bài viết mới trong tài liệu hướng dẫn. Nội dung chi tiết có thể điền sau.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Tiêu đề */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tiêu đề bài viết *</Label>
            <Input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Ví dụ: Cấp độ dịch vụ giao thông (LOS)"
              autoFocus
            />
          </div>

          {/* Section key */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Section Key *{" "}
              <span className="text-muted-foreground font-normal">(tự động từ tiêu đề, phải duy nhất)</span>
            </Label>
            <Input
              value={sectionKey}
              onChange={e => handleKeyChange(e.target.value)}
              placeholder="vi-du-section-key"
              className={`font-mono text-sm ${
                isDuplicate ? "border-amber-500 focus-visible:ring-amber-500" : ""
              }`}
            />
            {isDuplicate && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Section key <code className="font-mono font-semibold">{sectionKey}</code> đã tồn tại.
                  Hãy đổi sang một key khác.
                </span>
              </div>
            )}
          </div>

          {/* Parent section */}
          <div className="space-y-1.5">
            <Label className="text-xs">Thuộc section</Label>
            <Select value={parentKey} onValueChange={setParentKey}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">
                  — Mục gốc (không có section cha)
                </SelectItem>
                {rootSections.map(s => (
                  <SelectItem key={s.section_key} value={s.section_key}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Loại bài viết</Label>
            <Select value={articleType} onValueChange={v => setArticleType(v as "document" | "question")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">📄 Tài liệu hướng dẫn</SelectItem>
                <SelectItem value="question">❓ Hỏi đáp (FAQ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Đang tạo..." : "Tạo bài viết"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
