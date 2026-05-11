/**
 * Tiện ích HTTP tập trung: tự động đính kèm JWT Bearer token vào mọi request.
 * GET requests được cache theo TTL để giảm số lần gọi API khi navigate qua lại.
 */

const TOKEN_KEY = "auth_token";

// ── In-memory GET cache ────────────────────────────────────────────────────
interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

/** TTL mặc định (ms) cho các GET request khác nhau */
const TTL_MAP: { pattern: RegExp; ttl: number }[] = [
  { pattern: /\/api\/traffic\/patterns/, ttl: 5 * 60_000 }, // 5 phút – dữ liệu tổng hợp
  { pattern: /\/api\/model-metrics/, ttl: 5 * 60_000 }, // 5 phút – metrics ít thay đổi
  { pattern: /\/api\/cameras$/, ttl: 5 * 60_000 }, // 5 phút – danh sách camera
  { pattern: /\/api\/data-library\/collections/, ttl: 2 * 60_000 }, // 2 phút
  { pattern: /\/api\/help\/articles$/, ttl: 10 * 60_000 }, // 10 phút – help docs ít thay đổi
];

const DEFAULT_TTL = 0; // Không cache nếu không khớp pattern nào

function getTTL(url: string): number {
  for (const { pattern, ttl } of TTL_MAP) {
    if (pattern.test(url)) return ttl;
  }
  return DEFAULT_TTL;
}

/** Xóa toàn bộ cache (gọi sau khi mutate dữ liệu) */
export function clearApiCache(urlPattern?: RegExp) {
  if (urlPattern) {
    for (const key of _cache.keys()) {
      if (urlPattern.test(key)) _cache.delete(key);
    }
  } else {
    _cache.clear();
  }
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────
type FetchOptions = RequestInit & { skipAuth?: boolean; bypassCache?: boolean };

/**
 * Wrapper fetch tự động thêm Authorization header và cache GET responses theo TTL
 */
export async function apiFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    skipAuth = false,
    bypassCache = false,
    headers: extraHeaders,
    ...rest
  } = options;
  const method = (rest.method ?? "GET").toUpperCase();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  // ── Cache logic: chỉ cache GET, không bypass ──────────────────────────
  if (method === "GET" && !bypassCache) {
    const ttl = getTTL(url);
    if (ttl > 0) {
      const cached = _cache.get(url);
      if (cached && Date.now() < cached.expiresAt) {
        // Trả về Response giả lập từ cache
        return new Response(JSON.stringify(cached.body), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }

      // Fetch thật → lưu cache
      const resp = await fetch(url, {
        ...rest,
        method,
        headers,
        credentials: "include",
      });
      if (resp.ok) {
        try {
          const body = await resp.clone().json();
          _cache.set(url, { body, expiresAt: Date.now() + ttl });
        } catch {
          // Không parse được → bỏ qua cache
        }
      }
      return resp;
    }
  }

  return fetch(url, { ...rest, method, headers, credentials: "include" });
}
