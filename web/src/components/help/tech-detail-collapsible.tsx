/**
 * TechDetailCollapsible — Collapsible Lớp 3 chứa công thức và chi tiết kỹ thuật.
 * Ẩn mặc định, chỉ mở khi người dùng chủ động muốn đọc sâu hơn.
 */
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, CodeIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArticleMarkdown } from "@/components/documentation/article-markdown";

interface TechDetailCollapsibleProps {
  content: string;
}

export function TechDetailCollapsible({ content }: TechDetailCollapsibleProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group mt-4 select-none cursor-pointer">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-muted group-hover:bg-muted/80 transition-colors">
          {open
            ? <ChevronDownIcon className="h-3 w-3" />
            : <ChevronRightIcon className="h-3 w-3" />
          }
        </div>
        <CodeIcon className="h-3.5 w-3.5" />
        <span className="font-medium">{open ? "Ẩn chi tiết kỹ thuật" : "Xem chi tiết kỹ thuật"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <ArticleMarkdown content={content} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
