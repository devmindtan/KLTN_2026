import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database";
import { z } from "zod";
import { JwtPayload } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "change_refresh_secret_in_production";

const ACCESS_TOKEN_TTL  = "8h";
const REFRESH_TOKEN_TTL = "30d";
const GUEST_TOKEN_TTL   = "24h";

// ── Schema Validation ───────────────────────────────────────────────
const LoginSchema = z.object({
  email:    z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password:     z.string().min(8, "Mật khẩu mới tối thiểu 8 ký tự"),
});

/**
 * Tạo JWT anonymous cho viewer (không cần đăng nhập)
 * POST /api/auth/guest-token
 */
export const getGuestToken = (_req: Request, res: Response) => {
  const payload: JwtPayload = { type: "anonymous", role: "viewer" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: GUEST_TOKEN_TTL });
  res.json({ success: true, token, role: "viewer" });
};

/**
 * Đăng nhập kỹ thuật viên, trả về access token và refresh token (HttpOnly cookie)
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password } = parsed.data;

  const result = await pool.query(
    `SELECT id, email, full_name, password_hash, is_active FROM technician_accounts WHERE email = $1`,
    [email]
  );

  const account = result.rows[0];
  if (!account || !account.is_active) {
    return res.status(401).json({ success: false, message: "Email hoặc mật khẩu không đúng" });
  }

  const match = await bcrypt.compare(password, account.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: "Email hoặc mật khẩu không đúng" });
  }

  // Cập nhật last_login
  await pool.query(`UPDATE technician_accounts SET last_login = NOW() WHERE id = $1`, [account.id]);

  const payload: JwtPayload = {
    type: "authenticated",
    role: "technician",
    userId: account.id,
    email: account.email,
  };

  const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ userId: account.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
  });

  res.json({
    success: true,
    token: accessToken,
    user: { id: account.id, email: account.email, full_name: account.full_name, role: "technician" },
  });
};

/**
 * Làm mới access token bằng refresh token từ cookie
 * POST /api/auth/refresh
 */
export const refreshToken = (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "Không tìm thấy refresh token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    const payload: JwtPayload = { type: "authenticated", role: "technician", userId: decoded.userId };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    res.json({ success: true, token: accessToken });
  } catch {
    return res.status(401).json({ success: false, message: "Refresh token hết hạn, vui lòng đăng nhập lại" });
  }
};

/**
 * Đăng xuất: xóa refresh token cookie
 * POST /api/auth/logout
 */
export const logout = (_req: Request, res: Response) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
  res.json({ success: true, message: "Đăng xuất thành công" });
};

/**
 * Lấy thông tin tài khoản hiện tại
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Chưa xác thực" });
  }

  const result = await pool.query(
    `SELECT id, email, full_name, last_login, created_at FROM technician_accounts WHERE id = $1`,
    [userId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
  }

  res.json({ success: true, data: { ...result.rows[0], role: "technician" } });
};

/**
 * Đổi mật khẩu kỹ thuật viên
 * PUT /api/auth/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { current_password, new_password } = parsed.data;
  const userId = req.auth?.userId;

  const result = await pool.query(
    `SELECT password_hash FROM technician_accounts WHERE id = $1`,
    [userId]
  );
  const account = result.rows[0];
  if (!account) {
    return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
  }

  const match = await bcrypt.compare(current_password, account.password_hash);
  if (!match) {
    return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await pool.query(
    `UPDATE technician_accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, userId]
  );

  res.json({ success: true, message: "Đổi mật khẩu thành công" });
};

/**
 * Lấy lịch sử hoạt động của tài khoản (10 entries gần nhất)
 * GET /api/auth/activity-logs
 */
export const getActivityLogs = async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  const limit  = parseInt(req.query.limit as string) || 10;

  const result = await pool.query(
    `SELECT action, resource, resource_id, details, ip_address, created_at
     FROM activity_logs WHERE account_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );

  res.json({ success: true, data: result.rows });
};
