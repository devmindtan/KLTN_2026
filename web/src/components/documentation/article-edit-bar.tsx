/**
 * ArticleEditBar — Toolbar chỉ hiển thị cho Kỹ thuật viên phía trên mỗi bài viết.
 * Cung cấp các action: Chỉnh sửa, Thêm mục con, Xóa (có confirm dialog).
 */
import { PenLineIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { HelpArticle } from "@/services/help.service";

interface ArticleEditBarProps {
  article: HelpArticle;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
}

export function ArticleEditBar({
  article,
  onEdit,
  onDelete,
  onAddChild,
}: ArticleEditBarProps) {
  return (
    <div className="flex flex-row sm:items-center justify-between gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-4">
      {/* Left: badges trạng thái */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400"
        >
          Kỹ thuật viên
        </Badge>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 whitespace-nowrap" onClick={onEdit}>
          <PenLineIcon className="h-3.5 w-3.5 " /> 
          <span className="hidden sm:inline">Chỉnh sửa</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground whitespace-nowrap"
          onClick={onAddChild}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Thêm mục con</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2Icon className="h-3.5 w-3.5" /> 
              <span className="hidden sm:inline">Xóa</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa bài viết?</AlertDialogTitle>
              <AlertDialogDescription>
                Bài viết <strong>"{article.title}"</strong> sẽ bị xóa vĩnh viễn và không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Xóa vĩnh viễn
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
