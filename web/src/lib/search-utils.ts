/**
 * Utilities cho tìm kiếm nâng cao - hỗ trợ tiếng Việt và tìm kiếm thông minh
 */

/** Normalize string để ignore dấu thanh điệu tiếng Việt */
export function normalizeVietnamese(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Kiểm tra xem query có match với text không (smart search) */
export function smartMatch(text: string, query: string): boolean {
  if (!query.trim()) return false;
  
  const normalizedText = normalizeVietnamese(text);
  const normalizedQuery = normalizeVietnamese(query);
  
  // 1. Basic substring match
  if (normalizedText.includes(normalizedQuery)) return true;
  
  // 2. Word boundary match - tìm từ đầu của từ
  const words = normalizedText.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);
  
  // Kiểm tra xem tất cả query words có match với đầu của bất kỳ word nào không
  const allQueryWordsMatch = queryWords.every(qw => 
    words.some(w => w.startsWith(qw))
  );
  if (allQueryWordsMatch) return true;
  
  // 3. Acronym search - gõ chữ cái đầu
  if (normalizedQuery.length >= 2 && normalizedQuery.length <= 4) {
    const firstLetters = words
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join("");
    if (firstLetters.includes(normalizedQuery)) return true;
  }
  
  // 4. Partial word match - match một phần của từ quan trọng
  if (normalizedQuery.length >= 3) {
    const hasPartialMatch = words.some(w => 
      w.length >= 4 && w.includes(normalizedQuery)
    );
    if (hasPartialMatch) return true;
  }
  
  return false;
}

/** Tính điểm relevance cho sorting kết quả (cao hơn = liên quan hơn) */
export function calculateRelevanceScore(text: string, query: string): number {
  if (!query.trim()) return 0;
  
  const normalizedText = normalizeVietnamese(text);
  const normalizedQuery = normalizeVietnamese(query);
  let score = 0;
  
  // Exact match = điểm cao nhất
  if (normalizedText === normalizedQuery) score += 100;
  
  // Starts with query = điểm cao
  if (normalizedText.startsWith(normalizedQuery)) score += 50;
  
  // Contains query as substring
  if (normalizedText.includes(normalizedQuery)) score += 20;
  
  // Word boundary matches
  const words = normalizedText.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);
  
  queryWords.forEach(qw => {
    words.forEach(w => {
      if (w.startsWith(qw)) score += 10;
      if (w.includes(qw) && w.length >= 4) score += 5;
    });
  });
  
  // Bonus cho match title vs subtitle vs meta
  if (text.length < 50) score += 5; // Likely title, boost score
  
  return score;
}