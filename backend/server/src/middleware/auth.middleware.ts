import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_production";

export interface JwtPayload {
  type: "anonymous" | "authenticated";
  role: "viewer" | "technician";
  userId?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/** Mở rộng Request để gắn payload JWT */
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

/**
 * Middleware: Yêu cầu JWT hợp lệ (viewer hoặc technician)
 * Dùng cho các route cần xác thực nhưng không giới hạn role
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Thiếu token xác thực" });
  }

  const token = header.slice(7);
  try {
    req.auth = jwt.verify(token, JWT_SECRET) as JwtPayload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

/**
 * Middleware: Chỉ cho phép kỹ thuật viên (authenticated token)
 * Phải dùng sau requireAuth
 */
export const requireTechnician = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Thiếu token xác thực" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (payload.role !== "technician") {
      return res.status(403).json({ success: false, message: "Không có quyền thực hiện thao tác này" });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

/**
 * Middleware: Ghi log hành động của kỹ thuật viên vào bảng activity_logs
 * Dùng sau requireTechnician cho các write operations
 */
export const logActivity = (action: string, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (req.auth?.userId) {
      try {
        const resourceId = req.params?.id || req.params?.cam_id || null;
        await pool.query(
          `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.auth.userId,
            action,
            resource,
            resourceId,
            req.body ? JSON.stringify(req.body) : null,
            req.ip,
          ]
        );
      } catch (err) {
        console.error("Activity log error:", err);
        // Không block request nếu log fail
      }
    }
    next();
  };
};
