# Thiết Kế Hệ Thống JWT Authentication & Phân Quyền

**Ngày tạo:** 03/03/26  
**Phiên bản:** 1.0  
**Trạng thái:** Draft

---

## 1. Tổng quan

Hệ thống có 2 loại người dùng với mức quyền khác nhau:

| Loại | Tên vai trò | Tài khoản | JWT | Quyền |
|---|---|---|---|---|
| Khách / Quản lý giao thông | `viewer` | ❌ Không cần | ✅ Anonymous token | Xem dữ liệu, tải báo cáo |
| Kỹ thuật viên | `technician` | ✅ Cần (email + password) | ✅ Authenticated token | Toàn quyền |

**Lý do viewer vẫn cần JWT:** Kiểm soát rate limiting, theo dõi lưu lượng truy cập, và sẵn sàng mở rộng quyền sau này mà không cần đổi architecture.

---

## 2. Kiến trúc JWT

### 2.1 Token Types

```
Anonymous Token (viewer)
├── Có hạn: 24 giờ, tự động rotate
├── Payload: { role: "viewer", type: "anonymous", iat, exp }
└── Cấp tự động khi truy cập app (không cần login)

Authenticated Token (technician)  
├── Access Token: 8 giờ
├── Refresh Token: 30 ngày (lưu HttpOnly cookie)
└── Payload: { userId, email, role: "technician", type: "authenticated", iat, exp }
```

### 2.2 Token Flow

```
[Khách/Quản lý giao thông]
  → Mở app → Frontend gọi POST /api/auth/guest-token
  → Backend cấp anonymous JWT (24h)
  → Lưu localStorage → Đính kèm vào mọi request

[Kỹ thuật viên]  
  → Vào trang /login → Nhập email + password
  → POST /api/auth/login → Backend verify → Cấp access + refresh token
  → Lưu access token localStorage + refresh token HttpOnly cookie
  → Redirect về dashboard với đầy đủ quyền
```

---

## 3. Database Schema Additions

### Bảng mới: `technician_accounts`

```sql
CREATE TABLE technician_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,      -- bcrypt hash
  full_name    VARCHAR(255) NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Bảng mới: `activity_logs`

```sql
CREATE TABLE activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID REFERENCES technician_accounts(id),
  action       VARCHAR(100) NOT NULL,       -- e.g. 'UPDATE_CAMERA', 'DELETE_DATA'
  resource     VARCHAR(100),               -- e.g. 'camera', 'model'
  resource_id  VARCHAR(255),
  details      JSONB,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Backend API Endpoints

### 4.1 Auth Controller (`auth.controller.ts`)

| Method | Path | Mô tả | Auth Required |
|---|---|---|---|
| POST | `/api/auth/guest-token` | Cấp anonymous token cho viewer | ❌ |
| POST | `/api/auth/login` | Đăng nhập kỹ thuật viên | ❌ |
| POST | `/api/auth/logout` | Đăng xuất, revoke refresh token | ✅ technician |
| POST | `/api/auth/refresh` | Làm mới access token | ✅ refresh token |
| GET  | `/api/auth/me` | Thông tin tài khoản hiện tại | ✅ technician |
| PUT  | `/api/auth/change-password` | Đổi mật khẩu | ✅ technician |

### 4.2 Middleware phân quyền

```typescript
// middleware/auth.middleware.ts
requireAuth          // Mọi request cần có JWT (viewer + technician)
requireTechnician    // Chỉ technician mới được phép
logActivity          // Log hành động của technician
```

### 4.3 Route Protection Map

```
PUBLIC (không cần JWT):
  POST /api/auth/guest-token
  POST /api/auth/login

VIEWER + TECHNICIAN (cần JWT, bất kỳ loại):
  GET  /api/cameras/*         (xem dữ liệu camera)
  GET  /api/model-metrics/*   (xem metrics)
  GET  /api/reports/*         (xem + tải báo cáo)

TECHNICIAN ONLY (cần authenticated JWT):
  POST/PUT/DELETE /api/cameras/*    (quản lý camera)
  POST/PUT/DELETE /api/models/*     (quản lý model)
  GET  /api/auth/me
  PUT  /api/auth/change-password
  GET  /api/activity-logs          (xem lịch sử hoạt động)
```

---

## 5. Frontend Architecture

### 5.1 Context mới: `AuthContext.tsx`

```typescript
interface AuthState {
  isAuthenticated: boolean      // false = anonymous viewer, true = technician
  role: 'viewer' | 'technician'
  user: TechnicianUser | null   // null nếu là viewer
  token: string | null
  login: (email, password) => Promise<void>
  logout: () => void
}
```

### 5.2 Route Guards

```typescript
// components/auth/ProtectedRoute.tsx
<ProtectedRoute role="technician">
  <SecretPage />
</ProtectedRoute>
```

### 5.3 Pages mới / sửa đổi

| Page | Thay đổi |
|---|---|
| `/login` | Tạo mới - trang đăng nhập cho kỹ thuật viên |
| `/user/settings` | Refactor - bỏ placeholder, thêm quản lý tài khoản thật |
| `nav-user.tsx` | Hiển thị động theo role (viewer vs technician) |
| `app-sidebar.tsx` | Ẩn menu "Nhóm làm việc", "Dự án" với viewer |

### 5.4 UI Account Section (`settings.tsx`) - Redesign

**Viewer (anonymous):**
- Hiển thị thông báo "Bạn đang xem với quyền hạn chế"
- Nút "Kỹ thuật viên? Đăng nhập tại đây"
- Tùy chỉnh: Theme (dark/light), ngôn ngữ

**Technician:**
- Thông tin tài khoản (họ tên, email - readonly)
- Form đổi mật khẩu (current → new → confirm)
- Xem lịch sử hoạt động gần đây (10 entries)
- Tùy chỉnh: Theme, ngôn ngữ

### 5.5 NavUser Component - Cập nhật

```
Viewer:
  [Người dùng ẩn danh]
  [Khách - Chỉ xem]
  ─────────────────
  [🌓 Chuyển giao diện]
  [🔑 Đăng nhập kỹ thuật viên]

Technician:
  [Tên kỹ thuật viên]
  [email@domain.com]  
  ─────────────────
  [👤 Tài khoản]
  [🔒 Đổi mật khẩu]
  [📋 Lịch sử hoạt động]
  ─────────────────
  [🌓 Chuyển giao diện]
  [🚪 Đăng xuất]
```

---

## 6. Kế hoạch Triển Khai

### Phase 1: Backend Foundation
- [ ] Tạo bảng `technician_accounts` + `activity_logs` (migration SQL)
- [ ] Implement `auth.controller.ts` (guest-token, login, logout, refresh, me, change-password)
- [ ] Implement JWT middleware (`requireAuth`, `requireTechnician`, `logActivity`)
- [ ] Áp dụng middleware vào tất cả routes hiện có theo Route Protection Map
- [ ] Seed dữ liệu: tạo tài khoản technician mẫu

### Phase 2: Frontend Core
- [ ] Tạo `AuthContext.tsx` + `useAuth` hook
- [ ] Tạo trang `/login` (form đăng nhập cho kỹ thuật viên)
- [ ] Tạo `ProtectedRoute` component
- [ ] Update `App.tsx`: thêm route `/login`, wrap `AuthProvider`, logic auto-fetch guest token
- [ ] Update `axio` / fetch interceptors để đính kèm JWT header vào mọi request

### Phase 3: UI/UX Refactor
- [ ] Redesign `settings.tsx` - nội dung thật theo role
- [ ] Update `nav-user.tsx` - hiển thị động theo role
- [ ] Update `app-sidebar.tsx` - ẩn/hiện menu theo role
- [ ] Hiển thị badge role trong `site-header.tsx`

### Phase 4: Polish
- [ ] Auto-rotate anonymous token (24h expiry logic)
- [ ] Refresh token flow (silent renewal khi access token sắp hết hạn)
- [ ] Activity log viewer trong settings page
- [ ] Toast notifications: "Phiên đăng nhập hết hạn", "Đăng nhập thành công"

---

## 7. Packages cần thêm

### Backend (Node.js)
```
jsonwebtoken    - Tạo và verify JWT
bcrypt          - Hash mật khẩu
cookie-parser   - Parse HttpOnly cookie cho refresh token
```

### Frontend (React)
```
axios           - HTTP client với interceptors (hoặc dùng fetch wrapper)
```

---

## 8. Security Considerations

- **Password hashing:** bcrypt với salt rounds = 12
- **JWT secret:** Lấy từ env `JWT_SECRET` (min 256-bit random string)
- **Refresh token:** Lưu HttpOnly + Secure cookie, không accessible từ JS
- **Rate limiting:** `/api/auth/login` giới hạn 5 request/phút/IP
- **CORS:** Chỉ cho phép origin của frontend
- **Activity logging:** Log tất cả write operations của technician (POST/PUT/DELETE)

Báo cáo:
- Lỗi giao diện ở header của setting.tsx ✅ Đã fix (icon={IconSettings} → icon={<IconSettings size={20} />})
- Lỗi chữ sidebar lấn body ✅ Đã fix (thêm min-w-0 vào SidebarInset trong sidebar.tsx)

---

## 9. Checklist Trước Khi Build Production

### 9.1 Env Variables cần thêm

| Service | Biến | Ví dụ | Bắt buộc |
|---|---|---|---|
| `backend/server` | `JWT_SECRET` | chuỗi random ≥ 256-bit | ✅ |
| `backend/server` | `JWT_REFRESH_SECRET` | chuỗi random ≥ 256-bit (khác JWT_SECRET) | ✅ |
| `backend/server` | `CORS_ORIGIN` | `https://web.devmindtan.com,http://localhost:5173` | ✅ |
| `web/web-user` | `VITE_BACKEND_URL` | `https://server.devmindtan.com` | ✅ |

Tạo JWT secret mạnh:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 9.2 Database Migration

Phải chạy migration SQL trên DB **trước khi** deploy:

```bash
psql $DATABASE_URL -f backend/server/src/migrations/001_auth_tables.sql
```

Sau đó tạo tài khoản admin đầu tiên:

```bash
cd backend/server
ADMIN_EMAIL=admin@kltn.com ADMIN_PASSWORD=Admin@2026! npx ts-node src/migrations/seed-admin.ts
```

### 9.3 Lưu ý Bảo mật

- **Không commit** file `.env` vào git — dùng `.env.example` làm template
- `JWT_SECRET` và `JWT_REFRESH_SECRET` phải **khác nhau** — dùng cùng 1 secret sẽ cho phép dùng refresh token như access token
- Swagger UI (`/api/docs`) nên **tắt trên production** hoặc bảo vệ bằng basic auth:
  ```typescript
  // Chỉ bật Swagger trên non-production
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }
  ```
- Cookie `refreshToken` dùng `secure: true` khi production (HTTPS only) — hiện đang `secure: false` cho dev

### 9.4 Build Commands

```bash
# Backend
cd backend/server && npm run build

# Frontend
cd web/web-user && npm run build
```

### 9.5 Docker Image rebuild cần thiết

| Image | Lý do |
|---|---|
| `backend/server` | Có thêm packages mới (swagger, jsonwebtoken, bcrypt, cookie-parser) |
| `web/web-user` | Auth system + UI changes |