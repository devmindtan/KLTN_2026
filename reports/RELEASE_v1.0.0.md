# Release v1.0.0

## 1. Pham vi ban phat hanh

Release v1.0.0 dong bo cac module cot loi:

- Realtime camera monitoring (image-process + FIWARE + Socket.IO)
- Forecast pipeline 5 horizons (image-predict)
- Sync actual va model performance metrics
- Decision-Making system (backend API + decision-analyzer + realtime update)
- Data Library (import/download/manage collections)
- Smart Reports (generate PDF/XLSX)
- JWT authentication (viewer + technician)

## 2. Thanh phan chinh

### Backend API

- Auth: guest-token, login, refresh, logout, me, change-password, activity logs
- Decision APIs: list/analyze/review/implement/dismiss
- Reports APIs: list/detail/generate/download/delete
- Data Library APIs: collections CRUD + entries import/download
- Forecast/Traffic/Camera/Model APIs

### Python services

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
- Dashboard tab Lich su luu luong (so sanh da moc ngay)
- Decision-Making page
- Data Library page
- Camera Wall mode
- Traffic Map page voi route overlay ho tro dieu phoi
- Login and role-based route handling

## 3. Diem moi noi bat trong v1.0.0

- Decision analyzer da duoc harden voi confidence scoring va dedup 24h.
- Decision card v2 hien thi evidence nang cao (confidence breakdown, freshness, model MAPE).
- Realtime su kien DECISION_UPDATED thong qua DecisionReady webhook.
- Dashboard co tab lich su luu luong giao thong (actual vs forecast theo slot 5 phut).
- Traffic Map duoc nang cap route overlay (chon A/B tren map, danh gia camera tren tuyen).
- Data Library co luong import/download va edit collection metadata.
- Auth write-actions da duoc hardening (header/cookie/refresh path).

## 4. Bien moi truong toi thieu

### Backend server

- PORT (mac dinh 8080)
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CORS_ORIGIN

### Decision analyzer

- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_DBS
- POSTGRES_USERNAME
- POSTGRES_PASSWORD
- APP_ROUTE_WEBHOOK_URL

### Cac service khac

- FIWARE_ORION_BASE
- MINIO endpoint/access/secret theo service
- Namespace/service URLs trong K8s

## 5. Checklist pre-release

1. Build backend thanh cong (`backend/server`: `npm run build`).
2. Build frontend thanh cong (`web`: `npm run build`).
3. Lint frontend pass (`web`: `npm run lint`).
4. Xac nhan migration tu dong khi backend startup.
5. Xac nhan cronjob decision-analyzer da dung image va env.
6. Xac nhan app-route co event `DECISION_UPDATED`.
7. Xac nhan login technician hoat dong voi hash password dung.
8. Xac nhan dashboard va decision-making nhan duoc event realtime.
9. Xac nhan dashboard tab lich su goi duoc `/api/traffic/history` va hien thi du lieu.
10. Xac nhan traffic map route overlay tim duong va danh gia camera tren tuyen.
11. Xac nhan data-library import/download hoat dong.
12. Xac nhan report generation flow hoat dong (pending -> ready -> download).

## 6. Smoke test sau deploy

1. Dang nhap technician va goi `/api/auth/me` thanh cong.
2. Goi `/api/decisions` co du lieu (hoac empty nhung status 200).
3. Trigger analyze decisions va xac nhan co ban ghi moi.
4. Xac nhan frontend tu dong refresh khi co DECISION_UPDATED.
5. Kiem tra 1 camera co du lieu realtime va du bao.
6. Kiem tra Dashboard tab Lich su co du lieu 252 slots.
7. Kiem tra Traffic Map tim duong A/B va thay doi tuyen khi pick lai diem.
8. Kiem tra trang Analytics tai duoc metrics moi nhat.

## 7. Known notes

- Swagger dang tam dong trong backend server de cho dot revamp.
- Cac file docs lich su co the chua danh dau ro context cu, xem AGENT_LOG de doi chieu.
- Neu dung port-forward tren may khac, phai dat host theo IP LAN, khong dung localhost.

## 8. Rollback strategy

1. Rollback image tags ve ban on dinh gan nhat cho `server`, `web`, va services chinh.
2. Re-apply manifests K8s voi image tags rollback.
3. Kiem tra lai login, dashboard realtime, va decision APIs.
4. Neu can, tam tat cronjob decision-analyzer de tranh phat sinh du lieu moi trong luc rollback.

## 9. Tai lieu tham chieu

- reports/DATA_FLOW.md
- reports/Functional Decomposition.md
- reports/report.md
- reports/FUNCTION_LIST.md
- reports/AGENT_LOG.md
- backend/services/decision-analyzer/README.md
