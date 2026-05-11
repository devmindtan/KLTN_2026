"use client";
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff, IconLock, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

/**
 * Trang đăng nhập dành cho kỹ thuật viên
 * GET /login
 */
export default function Login() {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Đã đăng nhập rồi → redirect về dashboard với prefix
  if (!isLoading && isAuthenticated) {
    const prefix = user?.email.split("@")[0].toLowerCase() ?? "user"
    return <Navigate to={`/${prefix}/dashboard`} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const error = await login(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error);
    } else {
      const prefix = email.split("@")[0].toLowerCase()
      toast.success("Đăng nhập thành công!");
      navigate(`/${prefix}/dashboard`, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
            <IconLock size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Đăng nhập hệ thống</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dành cho kỹ thuật viên quản lý giao thông
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@traffic.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={submitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <><IconLoader2 className="mr-2 h-4 w-4 animate-spin" />Đang đăng nhập...</>
            ) : "Đăng nhập"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Không có tài khoản?{" "}
          <button
            onClick={() => navigate("/dashboard")}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Tiếp tục xem với quyền hạn chế
          </button>
        </p>
      </div>
    </div>
  );
}
