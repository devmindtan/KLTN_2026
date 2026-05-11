/**
 * Component highlight từ khoá tìm kiếm trong chuỗi văn bản.
 * Dùng chung cho mọi tính năng filter/search trên toàn hệ thống.
 * Tự động escape ký tự đặc biệt regex và so sánh không phân biệt hoa thường.
 */

import type { ReactNode } from "react";
import { normalizeVietnamese } from "@/lib/search-utils";

interface HighlightTextProps {
  /** Chuỗi văn bản đầy đủ cần hiển thị */
  text: string;
  /** Từ khoá tìm kiếm cần highlight (để trống = không highlight) */
  query: string;
}

/**
 * Bọc phần khớp với query bằng thẻ <mark> có style yellow (dark-mode tương thích).
 * Trả về chuỗi gốc nếu query rỗng hoặc không có khớp.
 * Hỗ trợ Unicode normalization cho tiếng Việt (bỏ qua dấu thanh điệu khi so sánh).
 */
export function HighlightText({ text, query }: HighlightTextProps) {
  if (!query.trim()) return <>{text}</>;

  const normalizedQuery = normalizeVietnamese(query);
  const normalizedText = normalizeVietnamese(text);
  
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let keyIndex = 0;
  
  // Tìm tất cả vị trí match trong normalized text
  let searchIndex = 0;
  while (searchIndex < normalizedText.length) {
    const foundIndex = normalizedText.indexOf(normalizedQuery, searchIndex);
    if (foundIndex === -1) break;
    
    const endIndex = foundIndex + normalizedQuery.length;
    
    // Thêm text trước match
    if (foundIndex > lastIndex) {
      result.push(text.slice(lastIndex, foundIndex));
    }
    
    // Thêm highlighted match
    const matchText = text.slice(foundIndex, endIndex);
    result.push(
      <mark
        key={keyIndex++}
        className="bg-yellow-200 dark:bg-yellow-800/70 text-foreground rounded-sm px-0.5 not-italic"
      >
        {matchText}
      </mark>
    );
    
    lastIndex = endIndex;
    searchIndex = endIndex;
  }
  
  // Thêm phần còn lại
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return <>{result}</>;
}
