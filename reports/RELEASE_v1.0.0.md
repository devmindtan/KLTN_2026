# Release v1.0.0

**Release Date:** 2026-06-02  
**Status:** Stable Release

## 1. Phạm vi bản phát hành

Release v1.0.0 đồng bộ các module cốt lõi:

- Realtime Camera Monitoring (`image-process` + FIWARE + Socket.IO)
- Forecast Pipeline với 5 khoảng dự báo (`image-predict`)
- Đồng bộ dữ liệu thực tế và đánh giá hiệu suất mô hình (`sync-actual`, `model-performance`)
- Decision-Making System (Backend API + `decision-analyzer` + Realtime Update)
- Data Library (Import / Download / Quản lý bộ dữ liệu)
- Smart Reports (Sinh báo cáo PDF/XLSX)
- JWT Authentication (Viewer + Technician)

---

## 2. Thành phần chính

### Backend API

- Auth: guest-token, login, refresh, logout, me, change-password, activity logs
- Decision APIs: list, analyze, review, implement, dismiss
- Reports APIs: list, detail, generate, download, delete
- Data Library APIs: collections CRUD + entries import/download
- Forecast, Traffic, Camera và Model APIs

### Python Services

- image-process
- image-predict
- sync-actual
- model-performance
- decision-analyzer
- data-export
- report-generator
- backup-postgres

### Frontend

- Dashboard, Monitoring, Analytics, Models, Reports
- Dashboard tab **Lịch sử lưu lượng** (so sánh đa mốc thời gian)
- Decision-Making Page
- Data Library Page
- Camera Wall Mode
- Traffic Map với Route Overlay hỗ trợ điều phối giao thông
- Login và xử lý phân quyền theo vai trò (Role-Based Route Handling)

---

## 3. Điểm mới nổi bật trong v1.0.0

- Decision Analyzer được harden với cơ chế Confidence Scoring và Dedup trong vòng 24 giờ.
- Decision Card v2 hiển thị bằng chứng nâng cao (Confidence Breakdown, Freshness, Model MAPE).
- Realtime event `DECISION_UPDATED` thông qua webhook `DecisionReady`.
- Dashboard bổ sung tab **Lịch sử lưu lượng giao thông** (Actual vs Forecast theo từng khung 5 phút).
- Traffic Map được nâng cấp với Route Overlay (chọn điểm A/B trên bản đồ, đánh giá camera theo tuyến).
- Data Library hỗ trợ luồng Import / Download và chỉnh sửa metadata của Collection.
- Các thao tác ghi dữ liệu (Write Actions) trong Auth được tăng cường bảo mật (Header / Cookie / Refresh Path).

---

## 4. Biến môi trường tối thiểu

### Backend Server

- `PORT` (mặc định: 8080)
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

### Decision Analyzer

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DBS`
- `POSTGRES_USERNAME`
- `POSTGRES_PASSWORD`
- `APP_ROUTE_WEBHOOK_URL`

### Các Service khác

- `FIWARE_ORION_BASE`
- Thông tin MinIO (`endpoint`, `access`, `secret`) tương ứng theo từng service
- Namespace và Service URLs trong Kubernetes

---

## 5. Checklist Pre-Release

1. Build Backend thành công (`backend/server`: `npm run build`).
2. Build Frontend thành công (`web`: `npm run build`).
3. Frontend lint pass (`web`: `npm run lint`).
4. Xác nhận migration tự động chạy khi Backend khởi động.
5. Xác nhận CronJob `decision-analyzer` sử dụng đúng image và environment variables.
6. Xác nhận `app-route` phát event `DECISION_UPDATED`.
7. Xác nhận tài khoản Technician đăng nhập thành công với password hash hợp lệ.
8. Xác nhận Dashboard và Decision-Making nhận được realtime events.
9. Xác nhận Dashboard tab **Lịch sử** gọi thành công API `/api/traffic/history` và hiển thị dữ liệu.
10. Xác nhận Traffic Map Route Overlay tìm đường và đánh giá camera theo tuyến.
11. Xác nhận Data Library Import / Download hoạt động bình thường.
12. Xác nhận luồng sinh báo cáo hoạt động đầy đủ (`pending → ready → download`).

---

## 6. Smoke Test Sau Deploy

1. Đăng nhập bằng tài khoản Technician và gọi thành công `/api/auth/me`.
2. Gọi `/api/decisions` trả về dữ liệu (hoặc rỗng nhưng có HTTP 200).
3. Trigger phân tích quyết định và xác nhận xuất hiện bản ghi mới.
4. Xác nhận Frontend tự động cập nhật khi nhận event `DECISION_UPDATED`.
5. Kiểm tra ít nhất một camera có dữ liệu realtime và dữ liệu dự báo.
6. Kiểm tra Dashboard tab **Lịch sử** hiển thị đủ 252 slots dữ liệu.
7. Kiểm tra Traffic Map tìm đường A/B và cập nhật tuyến khi thay đổi điểm.
8. Kiểm tra trang Analytics tải thành công các metrics mới nhất.

---

## 7. Known Notes

- Swagger hiện đang tạm thời đóng trong Backend Server để chuẩn bị cho đợt revamp tiếp theo.
- Một số tài liệu lịch sử có thể chưa ghi rõ ngữ cảnh cũ; tham khảo `AGENT_LOG` để đối chiếu.
- Khi sử dụng Port Forward trên máy khác, cần cấu hình Host theo địa chỉ IP LAN thay vì `localhost`.

---

## 8. Rollback Strategy

1. Rollback image tags về phiên bản ổn định gần nhất cho:
   - `server`
   - `web`
   - các services chính

2. Re-apply Kubernetes Manifests với các image tags đã rollback.

3. Kiểm tra lại:
   - Login
   - Dashboard Realtime
   - Decision APIs

4. Nếu cần thiết, tạm thời vô hiệu hóa CronJob `decision-analyzer` để tránh phát sinh dữ liệu mới trong quá trình rollback.

---

## 9. Tài liệu tham chiếu

- `reports/DATA_FLOW.md`
- `reports/Functional Decomposition.md`
- `reports/report.md`
- `reports/FUNCTION_LIST.md`
- `reports/AGENT_LOG.md`
- `backend/services/decision-analyzer/README.md`