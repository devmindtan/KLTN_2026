"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/custom/page-header";
import { SETTINGS_TERM } from "@/lib/app-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  IconSettings,
  IconUser,
  IconLock,
  IconActivity,
  IconShield,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { changePasswordRequest, getActivityLogsRequest, type ActivityLog } from "@/services/auth.service";

/**
 * Trang cài đặt tài khoản – hiển thị theo role (viewer / technician)
 */
export default function Setting() {
  const { isAuthenticated, user, token, role } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader icon={<IconSettings size={20} />} title={SETTINGS_TERM.page_header.title} description={SETTINGS_TERM.page_header.description} />
      {isAuthenticated && role === "technician" ? (
        <TechnicianSettings user={user} token={token!} />
      ) : (
        <ViewerSettings onLoginClick={() => navigate("/login")} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Viewer Section
// ──────────────────────────────────────────────────────────────────
function ViewerSettings({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border bg-muted/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <IconShield size={18} className="text-muted-foreground" />
          <span className="font-medium">Bạn đang xem với quyền hạn chế</span>
          <Badge variant="secondary">Khách</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Bạn có thể xem dữ liệu và tải báo cáo. Để quản lý hệ thống, vui lòng đăng nhập bằng tài khoản kỹ thuật viên.
        </p>
        <Button onClick={onLoginClick} size="sm">
          <IconLock size={14} className="mr-2" />
          Đăng nhập kỹ thuật viên
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Technician Section
// ──────────────────────────────────────────────────────────────────
function TechnicianSettings({
  user,
  token,
}: {
  user: { full_name: string; email: string } | null;
  token: string;
}) {
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [logs,       setLogs]       = useState<ActivityLog[]>([]);

  useEffect(() => {
    getActivityLogsRequest(token, 10).then(setLogs);
  }, [token]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error("Mật khẩu mới và xác nhận không khớp");
      return;
    }
    setSaving(true);
    const res = await changePasswordRequest(token, currentPw, newPw);
    setSaving(false);
    if (res.success) {
      toast.success("Đổi mật khẩu thành công");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      toast.error(res.message || "Đổi mật khẩu thất bại");
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Thông tin tài khoản */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconUser size={18} />
          <h2 className="font-semibold text-base">Thông tin tài khoản</h2>
          <Badge>Kỹ thuật viên</Badge>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Họ tên</Label>
            <p className="font-medium">{user?.full_name ?? "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="font-medium">{user?.email ?? "—"}</p>
          </div>
        </div>
      </section>

      {/* Đổi mật khẩu */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconLock size={18} />
          <h2 className="font-semibold text-base">Đổi mật khẩu</h2>
        </div>
        <Separator />
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Mật khẩu hiện tại</Label>
            <Input id="current-pw" type="password" value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)} required disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">
              Mật khẩu mới <span className="text-muted-foreground text-xs">(tối thiểu 8 ký tự)</span>
            </Label>
            <Input id="new-pw" type="password" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} required disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
            <Input id="confirm-pw" type="password" value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)} required disabled={saving} />
          </div>
          <Button type="submit" disabled={saving} size="sm">
            {saving ? "Đang lưu..." : "Cập nhật mật khẩu"}
          </Button>
        </form>
      </section>

      {/* Lịch sử hoạt động */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconActivity size={18} />
          <h2 className="font-semibold text-base">Lịch sử hoạt động gần đây</h2>
        </div>
        <Separator />
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hoạt động nào</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{log.action}</span>
                  {log.resource && <span className="text-muted-foreground ml-1">· {log.resource}</span>}
                  {log.resource_id && <span className="text-muted-foreground ml-1">#{log.resource_id}</span>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.created_at).toLocaleString("vi-VN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}