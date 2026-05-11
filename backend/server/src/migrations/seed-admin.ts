/**
 * Script tạo hash mật khẩu và seed tài khoản admin đầu tiên
 * Chạy: npx ts-node src/migrations/seed-admin.ts
 */
import bcrypt from "bcrypt";
import pool from "../config/database";
import dotenv from "dotenv";
dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@traffic.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Quản trị viên";

async function seed() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const result = await pool.query(
    `INSERT INTO technician_accounts (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
     RETURNING id, email, full_name`,
    [ADMIN_EMAIL, hash, ADMIN_NAME]
  );

  console.log("✅ Admin account seeded:", result.rows[0]);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
