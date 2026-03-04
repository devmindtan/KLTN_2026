"use client";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Vai trò tối thiểu để truy cập. Mặc định: không giới hạn (chỉ cần có JWT) */
  role?: "technician";
  /** Redirect đến đâu nếu chưa đủ quyền. Mặc định: /login */
  redirectTo?: string;
}

/**
 * Bảo vệ route: chuyển hướng nếu không đủ quyền
 */
export function ProtectedRoute({ children, role, redirectTo = "/login" }: ProtectedRouteProps) {
  const { isAuthenticated, role: userRole, isLoading } = useAuth();

  if (isLoading) return null; // Chờ khởi tạo auth

  if (role === "technician" && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (role === "technician" && userRole !== "technician") {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
