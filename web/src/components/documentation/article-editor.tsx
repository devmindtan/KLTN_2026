/**
 * ArticleEditor — Inline editor cho Kỹ thuật viên.
 * Hỗ trợ 3 pane: Soạn / Song song / Xem trước.
 * Tự động lưu draft vào localStorage mỗi 30 giây.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { SaveIcon, PenLineIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArticleMarkdown } from "./article-markdown";
import { cn } from "@/lib/utils";
import type { HelpArticle, UpdateArticlePayload } from "@/services/help.service";

// ─────────────────────────────────────────────────────────────────────────────

const DRAFT_PREFIX = "help_draft_";

type PreviewPane = "edit" | "split" | "preview";

interface ArticleEditorProps {
  article: HelpArticle;
  isSaving: boolean;
  onSave: (payload: UpdateArticlePayload) => void;
  onCancel: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function ArticleEditor({
  article,
  isSaving,
  onSave,
  onCancel,
}: ArticleEditorProps) {
  const [title, setTitle]           = useState(article.title);
  const [summary, setSummary]       = useState(article.summary);
  const [content, setContent]       = useState(article.content);
  const [techDetail, setTechDetail] = useState(article.tech_detail ?? "");
  const [isDirty, setIsDirty]       = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pane, setPane]             = useState<PreviewPane>("split");
  const mdInputRef = useRef<HTMLInputElement>(null);
  const mdTechInputRef = useRef<HTMLInputElement>(null);

  const draftKey    = `${DRAFT_PREFIX}${article.id}`;
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore draft từ localStorage ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as {
          title: string;
          summary: string;
          content: string;
          tech_detail: string;
        };
        if (draft.title      !== article.title)           setTitle(draft.title);
        if (draft.summary    !== article.summary)         setSummary(draft.summary);
        if (draft.content    !== article.content)         setContent(draft.content);
        if (draft.tech_detail !== (article.tech_detail ?? "")) setTechDetail(draft.tech_detail);
        setIsDirty(true);
      }
    } catch {
      // ignore corrupt JSON
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save mỗi 30s ──────────────────────────────────────────────────────
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (isDirty) {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ title, summary, content, tech_detail: techDetail })
        );
      }
    }, 30_000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isDirty, title, summary, content, techDetail, draftKey]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Đánh dấu form là dirty khi giá trị thay đổi */
  const markDirty =
    useCallback(
      (setter: (v: string) => void) =>
        (v: string) => {
          setter(v);
          setIsDirty(true);
        },
      []
    );

  /** Lưu thay đổi, xóa draft */
  const handleSave = useCallback(() => {
    localStorage.removeItem(draftKey);
    onSave({ title, summary, content, tech_detail: techDetail || null });
  }, [title, summary, content, techDetail, draftKey, onSave]);

  /** Hủy — nếu có thay đổi thì xác nhận trước */
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      localStorage.removeItem(draftKey);
      onCancel();
    }
  }, [isDirty, draftKey, onCancel]);

  /** Xác nhận hủy — bỏ qua thay đổi */
  const handleConfirmCancel = useCallback(() => {
    localStorage.removeItem(draftKey);
    onCancel();
  }, [draftKey, onCancel]);

  /** Nạp nội dung từ file .md vào ô Lớp 2 */
  const handleImportMd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      markDirty(setContent)(text);
    };
    reader.readAsText(file, "utf-8");
    // reset để có thể chọn lại cùng file
    e.target.value = "";
  }, [markDirty]);

  /** Nạp nội dung từ file .md vào ô Lớp 3 */
  const handleImportMdTech = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      markDirty(setTechDetail)(text);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, [markDirty]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="sticky top-12 z-10 bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <PenLineIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chỉnh sửa bài viết</span>
          {isDirty && (
            <span className="text-[10px] text-orange-500 font-medium">● Chưa lưu</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pane toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["edit", "split", "preview"] as PreviewPane[]).map(p => (
              <button
                key={p}
                onClick={() => setPane(p)}
                className={cn(
                  "px-2.5 py-1 transition-colors whitespace-nowrap",
                  pane === p
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                {p === "edit" ? "Soạn" : p === "split" ? "Song song" : "Xem trước"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving} className="whitespace-nowrap">
            Hủy
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty} className="whitespace-nowrap">
            <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      {/* Tên bài viết */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Tiêu đề bài viết</Label>
        <Input
          value={title}
          onChange={e => markDirty(setTitle)(e.target.value)}
          className="h-8 text-sm font-medium"
          placeholder="Tiêu đề..."
        />
      </div>

      {/* Summary — Lớp 1 */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">
          Tóm tắt — Lớp 1{" "}
          <span className="font-normal text-muted-foreground">(1 câu, không chuyên môn)</span>
        </Label>
        <Textarea
          value={summary}
          onChange={e => markDirty(setSummary)(e.target.value)}
          className="text-sm min-h-[56px] resize-none"
          placeholder="Một câu mô tả ngắn gọn..."
          rows={2}
        />
      </div>

      {/* Nội dung — Lớp 2 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Nội dung — Lớp 2{" "}
            <span className="font-normal text-muted-foreground">(Markdown, giải thích ngữ cảnh)</span>
          </Label>
          {/* Nạp từ file .md */}
          <input
            ref={mdInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleImportMd}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => mdInputRef.current?.click()}
          >
            <UploadIcon className="h-3 w-3" />
            Nạp file .md
          </Button>
        </div>
        <div className={cn(
          "rounded-md border border-border overflow-hidden",
          pane === "split" && "grid grid-cols-1 md:grid-cols-2"
        )}>
          {pane !== "preview" && (
            <Textarea
              value={content}
              onChange={e => markDirty(setContent)(e.target.value)}
              className="min-h-[220px] text-sm font-mono rounded-none border-0 resize-none focus-visible:ring-0"
              placeholder="# Tiêu đề&#10;&#10;Nội dung..."
            />
          )}
          {pane !== "edit" && (
            <div className={cn(
              "min-h-[220px] p-3 overflow-y-auto",
              pane === "split" && "border-t md:border-t-0 md:border-l border-border bg-muted/20"
            )}>
              {content
                ? <ArticleMarkdown content={content} />
                : <p className="text-xs text-muted-foreground italic">Xem trước sẽ hiển thị ở đây...</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* Tech detail — Lớp 3 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Chi tiết kỹ thuật — Lớp 3{" "}
            <span className="font-normal text-muted-foreground">
              (Markdown, collapsible — để trống nếu không cần)
            </span>
          </Label>
          <input
            ref={mdTechInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleImportMdTech}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => mdTechInputRef.current?.click()}
          >
            <UploadIcon className="h-3 w-3" />
            Nạp file .md
          </Button>
        </div>
        <div className={cn(
          "rounded-md border border-border overflow-hidden",
          pane === "split" && "grid grid-cols-1 md:grid-cols-2"
        )}>
          {pane !== "preview" && (
            <Textarea
              value={techDetail}
              onChange={e => markDirty(setTechDetail)(e.target.value)}
              className="min-h-[120px] text-sm font-mono rounded-none border-0 resize-none focus-visible:ring-0"
              placeholder={"## Công thức\n\n```\n...\n```"}
            />
          )}
          {pane !== "edit" && (
            <div className={cn(
              "min-h-[120px] p-3 overflow-y-auto",
              pane === "split" && "border-t md:border-t-0 md:border-l border-border bg-muted/20"
            )}>
              {techDetail
                ? <ArticleMarkdown content={techDetail} />
                : <p className="text-xs text-muted-foreground italic">Để trống = không có lớp 3</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* Confirm hủy khi có thay đổi chưa lưu */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy chỉnh sửa?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có thay đổi chưa được lưu. Nếu hủy, toàn bộ thay đổi sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-background hover:bg-destructive/90"
            >
              Hủy bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
