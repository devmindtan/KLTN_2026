/**
 * Tiện ích HTTP tập trung: tự động đính kèm JWT Bearer token vào mọi request
 * Đọc token từ localStorage để không cần pass qua props/context
 */

const TOKEN_KEY = "auth_token";

type FetchOptions = RequestInit & { skipAuth?: boolean };

/**
 * Wrapper fetch tự động thêm Authorization header
 */
export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth = false, headers: extraHeaders, ...rest } = options;

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

  return fetch(url, { ...rest, headers, credentials: "include" });
}
