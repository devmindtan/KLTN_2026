"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  fetchGuestToken,
  loginRequest,
  logoutRequest,
  refreshTokenRequest,
  getMeRequest,
  type AuthUser,
} from "@/services/auth.service";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────
export interface AuthState {
  isAuthenticated: boolean;      // false = viewer anonymous, true = technician
  role:            "viewer" | "technician";
  routePrefix:     string;       // "user" cho viewer, email prefix cho technician
  user:            AuthUser | null;
  token:           string | null;
  isLoading:       boolean;
  login:           (email: string, password: string) => Promise<string | null>;
  logout:          () => Promise<void>;
  getToken:        () => string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "auth_token";
const ROLE_KEY  = "auth_role";

// ──────────────────────────────────────────────────────────────────
// AuthProvider
// ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,           setToken]           = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [role,            setRole]            = useState<"viewer" | "technician">(() =>
    (localStorage.getItem(ROLE_KEY) as "viewer" | "technician") || "viewer"
  );
  const [user,            setUser]            = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  /** Lưu token vào state + localStorage */
  const saveToken = useCallback((t: string, r: "viewer" | "technician") => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ROLE_KEY, r);
    setToken(t);
    setRole(r);
  }, []);

  /** Xóa auth state */
  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setRole("viewer");
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  /** Khởi tạo auth khi app load */
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      const storedRole = localStorage.getItem(ROLE_KEY) as "viewer" | "technician";

      if (stored && storedRole === "technician") {
        // Thử lấy user info để verify token còn hợp lệ
        const me = await getMeRequest(stored);
        if (me) {
          setIsAuthenticated(true);
          setUser(me);
          setToken(stored);
          setRole("technician");
        } else {
          // Token hết hạn → thử refresh
          const newToken = await refreshTokenRequest();
          if (newToken) {
            saveToken(newToken, "technician");
            const me2 = await getMeRequest(newToken);
            if (me2) { setIsAuthenticated(true); setUser(me2); }
          } else {
            // Refresh failed → fallback guest token
            clearAuth();
            const guest = await fetchGuestToken();
            if (guest) saveToken(guest, "viewer");
          }
        }
      } else if (stored && storedRole === "viewer") {
        // Kiểm tra token viewer còn hạn không (decode exp, không cần verify)
        const expiry = getTokenExpiry(stored);
        if (expiry && Date.now() < expiry) {
          setToken(stored);
          setRole("viewer");
        } else {
          // Token viewer đã hết hạn → lấy guest token mới
          clearAuth();
          const guest = await fetchGuestToken();
          if (guest) saveToken(guest, "viewer");
        }
      } else {
        // Chưa có token → lấy guest token
        const guest = await fetchGuestToken();
        if (guest) saveToken(guest, "viewer");
      }

      setIsLoading(false);
    };

    init();
  }, [saveToken, clearAuth]);

  /** Silent token refresh: gia hạn 30 phút trước khi hết hạn */
  useEffect(() => {
    if (!token || role !== "technician") return;

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const refreshIn = expiry - Date.now() - 30 * 60 * 1000; // 30 phút trước hết hạn
    if (refreshIn <= 0) return;

    const timer = setTimeout(async () => {
      const newToken = await refreshTokenRequest();
      if (newToken) {
        saveToken(newToken, "technician");
      }
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [token, role, saveToken]);

  /**
   * Đăng nhập kỹ thuật viên
   * Trả về error message nếu thất bại, null nếu thành công
   */
  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await loginRequest(email, password);
    if (!res.success || !res.token || !res.user) {
      return res.message || "Đăng nhập thất bại";
    }
    saveToken(res.token, "technician");
    setUser(res.user);
    setIsAuthenticated(true);
    return null;
  }, [saveToken]);

  /**
   * Đăng xuất: xóa state và gọi API revoke refresh token
   */
  const logout = useCallback(async () => {
    if (token) await logoutRequest(token);
    clearAuth();
    // Cấp guest token ngay để không bị blocked
    const guest = await fetchGuestToken();
    if (guest) saveToken(guest, "viewer");
  }, [token, clearAuth, saveToken]);

  /** Trả về token hiện tại (dùng trong services) */
  const getToken = useCallback(() => token, [token]);

  /** Route prefix: email trước @ nếu là technician, ngược lại "user" */
  const routePrefix = isAuthenticated && user?.email
    ? user.email.split("@")[0].toLowerCase()
    : "user";

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, routePrefix, user, token, isLoading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong AuthProvider");
  return ctx;
}

/**
 * Đọc thời gian hết hạn từ JWT (không cần verify, chỉ decode base64)
 */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
