/**
 * ArticleView — Hiển thị nội dung bài viết theo 3 lớp:
 * Lớp 1: Summary badge, Lớp 2: content Markdown, Lớp 3: tech_detail collapsible
 */
import { ClockIcon, FileTextIcon, HelpCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ArticleMarkdown } from "./article-markdown";
import { TechDetailCollapsible } from "./tech-detail-collapsible";
import type { HelpArticle } from "@/services/help.service";

interface ArticleViewProps {
  article: HelpArticle;
}

/** Format YYYY-MM-DD từ ISO string */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function ArticleView({ article }: ArticleViewProps) {
  return (
    <article className="flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-border/50 pb-3">
        <h2 className="text-lg font-semibold text-foreground leading-snug">{article.title}</h2>

        {/* Lớp 1 — Summary */}
        <div className="mt-2 rounded-md bg-primary/5 border border-primary/15 px-3 py-2">
          <p className="text-sm text-foreground/80 leading-relaxed">{article.summary}</p>
        </div>

        {/* Meta: type + cập nhật lần cuối */}
        <div className="flex items-center gap-2 mt-2">
          {article.type === "question" ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-violet-700 border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-400">
              <HelpCircleIcon className="h-2.5 w-2.5" /> Hỏi đáp
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-sky-700 border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:text-sky-400">
              <FileTextIcon className="h-2.5 w-2.5" /> Tài liệu
            </Badge>
          )}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ClockIcon className="h-3 w-3" />
            Cập nhật: {formatDate(article.updated_at)}
          </span>
        </div>
      </div>

      {/* Lớp 2 — Content */}
      <div className="min-h-[120px]">
        <ArticleMarkdown content={article.content} />
      </div>

      {/* Lớp 3 — Tech detail collapsible */}
      {article.tech_detail && (
        <TechDetailCollapsible content={article.tech_detail} />
      )}
    </article>
  );
}
