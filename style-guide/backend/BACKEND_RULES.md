---
## 8. Kiểm tra lỗi trước khi hoàn thành (Python services)
- Trước khi xác nhận hoàn thành bất kỳ task backend (Python service), **BẮT BUỘC** chạy kiểm tra lỗi (get_errors) cho tất cả file bị sửa.
- Chỉ xác nhận hoàn thành khi không còn compile/lint errors.
- Nếu có lỗi, phải fix triệt để trước khi update AGENT_LOG/FUNCTION_LIST.

---
# Backend Coding Rules

> Đọc file này khi thực hiện task liên quan đến Node.js server, API route, migration, Swagger, Docker, hoặc Python services.

---

## 1. Validation (Node.js)

- Dùng Zod hoặc Joi cho mọi input (Request Body, Query, Params).
- Schema validation phải khớp với `schemas/DATABASE_SCHEMA.md`.

---

## 2. Startup Migration

`runMigrations()` (tại `backend/server/src/migrations/runner.ts`) PHẢI được gọi trước khi server nhận request.

**Thứ tự chạy migration:**
1. `000_core_tables.sql` — camera_data, camera_detections, camera_forecasts, model_metrics_history, ml_model_metadata, backup_logs
2. `001_auth_tables.sql` — technician_accounts, activity_logs
3. `003_data_library.sql` — data_library_collections, data_library_entries
4. `002_traffic_pattern_views.sql` — Materialized Views (chỉ chạy nếu MV chưa tồn tại)

**Quy tắc:**
- Tất cả SQL dùng `IF NOT EXISTS` → idempotent.
- KHÔNG chứa INSERT / seed data — seed qua script riêng (ví dụ: `seed-admin.ts`).
- Lỗi migration: chỉ log, KHÔNG throw (tránh crash server).

---

## 3. Migration File Rules

- Thêm bảng mới → tạo `0NN_<tên>.sql`, cập nhật `PLAIN_MIGRATIONS` array trong `runner.ts`.
- Tên file: `000`, `001`, `002`... (tăng dần đảm bảo thứ tự phụ thuộc).
- TUYỆT ĐỐI KHÔNG bỏ `IF NOT EXISTS` khỏi bất kỳ `CREATE TABLE`.
- Migrations chỉ chứa DDL — không có business logic.

---

## 4. Controller Rules

- Controller chỉ query/read/write dữ liệu — không tạo bảng hay migration.
- Cần bảng mới → thêm vào migration SQL + đăng ký runner, không inline `CREATE TABLE` trong controller.

---

## 5. Swagger Documentation

- **BẮT BUỘC**: Mọi API route mới (GET/POST/PUT/PATCH/DELETE) PHẢI bổ sung vào `backend/server/src/config/swagger.ts` CÙNG task tạo route.
- Tag: Mỗi nhóm route khai báo trong mảng `tags`.
- Schema phức tạp: khai báo trong `components.schemas`, dùng `$ref`.
- Route public (không JWT): khai báo `security: []`.
- KHÔNG dùng JSDoc scan (`apis: []`) — spec khai báo tập trung trong `paths`.
- Sau khi thêm route: verify tại `GET /api/docs`.

---

## 6. Docker Best Practices (Python services)

- Multi-stage build: `builder` + `runner`.
- COPY chỉ: `app/`, `models/`, `shared/` — không copy toàn bộ service folder.
- Container structure: flat `/app/` (không nested `/app/app/`).
- Imports: direct (`from query import ...` thay vì `from app.query import ...`).

---

## 7. Timezone Handling

- Upload FIWARE: luôn dùng `datetime.utcnow().isoformat()`.
- Database TIMESTAMPTZ columns nhận UTC input.
- Frontend convert UTC → local time khi display.
