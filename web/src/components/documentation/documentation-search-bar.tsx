/**
 * DocumentationSearchBar — Tìm kiếm fulltext qua tiêu đề và nội dung articles.
 * Trả về danh sách article khớp cho parent xử lý navigate.
 */
import { useState, useCallback } from "react";
import { SearchInput } from "@/components/custom/search-input";
import type { HelpArticle } from "@/services/help.service";
import { HighlightText } from "@/components/custom/highlight-text";
import { cn } from "@/lib/utils";

interface DocumentationSearchBarProps {
  articles: HelpArticle[];
  onSelect: (sectionKey: string) => void;
  className?: string;
}

/**
 * Tìm kiếm trong title, summary và content (không phân biệt hoa thường).
 */
function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return articles.filter(
    a =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q)
  );
}

export function DocumentationSearchBar({ articles, onSelect, className }: DocumentationSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = searchArticles(articles, query);

  const handleSelect = useCallback(
    (key: string) => {
      setQuery("");
      setOpen(false);
      onSelect(key);
    },
    [onSelect]
  );

  return (
    <div className={cn("relative", className)}>
      <div
        onFocus={() => query.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <SearchInput
          value={query}
          onChange={val => {
            setQuery(val);
            setOpen(val.length > 0);
          }}
          placeholder="Tìm kiếm tài liệu..."
          size="sm"
        />
      </div>

      {/* Dropdown kết quả */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Không tìm thấy kết quả cho "<strong>{query}</strong>"
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map(a => (
                <li key={a.id}>
                  <button
                    onMouseDown={() => handleSelect(a.section_key)}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <div className="text-sm font-medium text-foreground">
                      <HighlightText text={a.title} query={query} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      <HighlightText text={a.summary} query={query} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
