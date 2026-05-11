/**
 * ArticleMarkdown — Wrapper react-markdown với typography chuẩn cho help articles.
 * Áp dụng kiểu chữ nhất quán cho: headings, paragraph, table, code block, bold, list.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ArticleMarkdownProps {
  content: string;
  className?: string;
}

export function ArticleMarkdown({ content, className }: ArticleMarkdownProps) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-muted-foreground">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 my-3 text-sm text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
          inline ? (
            <code className="bg-muted text-foreground text-[12px] px-1 py-0.5 rounded font-mono">
              {children}
            </code>
          ) : (
            <code className="block bg-muted text-foreground text-[12px] p-3 rounded-md font-mono leading-relaxed overflow-x-auto whitespace-pre my-2">
              {children}
            </code>
          ),
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold text-foreground whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-muted-foreground border-b border-border/50 align-top">
            {children}
          </td>
        ),
        hr: () => <hr className="my-4 border-border/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
