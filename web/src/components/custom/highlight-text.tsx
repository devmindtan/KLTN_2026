/**
 * Component highlight từ khoá tìm kiếm trong chuỗi văn bản.
 * Dùng chung cho mọi tính năng filter/search trên toàn hệ thống.
 * Tự động escape ký tự đặc biệt regex và so sánh không phân biệt hoa thường.
 */

interface HighlightTextProps {
  /** Chuỗi văn bản đầy đủ cần hiển thị */
  text: string;
  /** Từ khoá tìm kiếm cần highlight (để trống = không highlight) */
  query: string;
}

/**
 * Bọc phần khớp với query bằng thẻ <mark> có style yellow (dark-mode tương thích).
 * Trả về chuỗi gốc nếu query rỗng hoặc không có khớp.
 */
export function HighlightText({ text, query }: HighlightTextProps) {
  if (!query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-800/70 text-foreground rounded-sm px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
