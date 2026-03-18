/**
 * DocumentationSidebar — Nav tree phân cấp cho tài liệu hướng dẫn.
 * Hỗ trợ: active state, collapse/expand section, Add button (technician only).
 */
import { useState, useCallback } from "react";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ArticleTreeNode } from "@/services/help.service";
import { HighlightText } from "@/components/custom/highlight-text";

interface DocumentationSidebarProps {
  tree: ArticleTreeNode[];
  selectedKey: string | null;
  isTechnician: boolean;
  searchQuery?: string;
  onSelect: (sectionKey: string) => void;
  onAddArticle: (parentKey: string | null) => void;
}

interface SectionNodeProps {
  node: ArticleTreeNode;
  selectedKey: string | null;
  isTechnician: boolean;
  searchQuery?: string;
  depth: number;
  onSelect: (key: string) => void;
  onAddArticle: (parentKey: string | null) => void;
}

/** Render một node trong sidebar tree — đệ quy */
function SectionNode({
  node,
  selectedKey,
  isTechnician,
  searchQuery,
  depth,
  onSelect,
  onAddArticle,
}: SectionNodeProps) {
  const { article, children } = node;
  const hasChildren = children.length > 0;
  const isActive = selectedKey === article.section_key;
  const isSection = article.parent_key === null;

  // Section gốc mở mặc định; nếu có child đang active thì giữ mở
  const [expanded, setExpanded] = useState(() => {
    return isSection;
  });

  const isChildActive = useCallback(
    (nodes: ArticleTreeNode[]): boolean =>
      nodes.some(n => n.article.section_key === selectedKey || isChildActive(n.children)),
    [selectedKey]
  );

  const hasActiveChild = isChildActive(children);

  const handleToggle = useCallback(() => {
    setExpanded(p => !p);
  }, []);

  if (isSection) {
    return (
      <div className="mb-1">
        {/* Section header */}
        <div className="flex items-center justify-between group px-2 py-0.5 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  handleToggle();
                  onSelect(article.section_key);
                }}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {hasChildren ? (
                  expanded ? (
                    <ChevronDownIcon className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 shrink-0" />
                  )
                ) : (
                  <BookOpenIcon className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">
                  <HighlightText text={article.title} query={searchQuery ?? ""} />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">{article.title}</TooltipContent>
          </Tooltip>
          {isTechnician && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              onClick={() => onAddArticle(article.section_key)}
              title="Thêm mục con"
            >
              <PlusIcon className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Children */}
        {(expanded || hasActiveChild) && hasChildren && (
          <div className="ml-3 mt-0.5 border-l border-border/50 pl-2">
            {children.map(child => (
              <SectionNode
                key={child.article.section_key}
                node={child}
                selectedKey={selectedKey}
                isTechnician={isTechnician}
                searchQuery={searchQuery}
                depth={depth + 1}
                onSelect={onSelect}
                onAddArticle={onAddArticle}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node (article)
  return (
    <div className="group flex items-center justify-between">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelect(article.section_key)}
            className={cn(
              "flex-1 min-w-0 text-left py-1 px-2 rounded-md text-sm transition-colors truncate",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <HighlightText text={article.title} query={searchQuery ?? ""} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center">{article.title}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DocumentationSidebar({
  tree,
  selectedKey,
  isTechnician,
  searchQuery,
  onSelect,
  onAddArticle,
}: DocumentationSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 pr-1">
      {tree.map(node => (
        <SectionNode
          key={node.article.section_key}
          node={node}
          selectedKey={selectedKey}
          isTechnician={isTechnician}
          searchQuery={searchQuery}
          depth={0}
          onSelect={onSelect}
          onAddArticle={onAddArticle}
        />
      ))}

      {/* Add root section — technician only */}
      {isTechnician && (
        <button
          onClick={() => onAddArticle(null)}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent/50 transition-colors border border-dashed border-border/60"
        >
          <PlusIcon className="h-3 w-3" />
          Thêm mục mới
        </button>
      )}
    </nav>
  );
}
