/**
 * Auth Service - Xử lý các API call liên quan đến xác thực
 */

const BASE = import.meta.env.VITE_BACKEND_URL;

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "technician";
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
}

/**
 * Lấy anonymous JWT token cho viewer (không cần tài khoản)
 * POST /api/auth/guest-token
 */
export async function fetchGuestToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/guest-token`, { method: "POST" });
    const json: AuthResponse = await res.json();
    return json.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Đăng nhập kỹ thuật viên
 * POST /api/auth/login
 */
export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ email, password }),
    credentials: "include", // nhận refreshToken cookie
  });
  return res.json();
}

/**
 * Đăng xuất
 * POST /api/auth/logout
 */
export async function logoutRequest(token: string): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, {
    method:      "POST",
    headers:     { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
}

/**
 * Làm mới access token bằng refresh token (cookie)
 * POST /api/auth/refresh
 */
export async function refreshTokenRequest(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method:      "POST",
      credentials: "include",
    });
    const json: AuthResponse = await res.json();
    return json.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Lấy thông tin tài khoản hiện tại
 * GET /api/auth/me
 */
export async function getMeRequest(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Đổi mật khẩu
 * PUT /api/auth/change-password
 */
export async function changePasswordRequest(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/auth/change-password`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return res.json();
}

/**
 * Lấy lịch sử hoạt động gần nhất
 * GET /api/auth/activity-logs
 */
export async function getActivityLogsRequest(
  token: string,
  limit = 10
): Promise<ActivityLog[]> {
  try {
    const res = await fetch(`${BASE}/api/auth/activity-logs?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

export interface ActivityLog {
  action:      string;
  resource:    string | null;
  resource_id: string | null;
  details:     Record<string, unknown> | null;
  ip_address:  string | null;
  created_at:  string;
}
