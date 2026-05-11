-- Migration 001: Tạo bảng xác thực và log hoạt động
-- Tất cả dùng IF NOT EXISTS — idempotent, an toàn khi chạy lại nhiều lần
-- KHÔNG chứa INSERT / seed data (dùng seed-admin.ts chạy thủ công 1 lần)

-- Bảng tài khoản kỹ thuật viên
CREATE TABLE IF NOT EXISTS technician_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng log hành động của kỹ thuật viên
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES technician_accounts(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(100),
  resource_id VARCHAR(255),
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_account_id ON activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Seed: tài khoản technician mẫu (password: Admin@123)
-- Hash được tạo bằng bcrypt rounds=12
-- Đổi email và chạy script seed-admin.ts để tạo hash mới
-- INSERT INTO technician_accounts (email, password_hash, full_name)
-- VALUES (
--   'admin@traffic.com',
--   'Admin@123',
--   'Quản trị viên'
-- )
-- ON CONFLICT (email) DO NOTHING;
