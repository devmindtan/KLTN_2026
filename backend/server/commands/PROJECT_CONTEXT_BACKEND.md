# Backend Context - Traffic Management System

**Last Updated**: 07/03/2026

## Mô tả dự án
Backend REST API cho hệ thống giám sát & dự đoán lưu lượng giao thông đô thị.

### System Architecture
```
Frontend (React) ──JWT──► Backend API (Express + TypeScript) ──► PostgreSQL
                                                               ──► MinIO (S3)
                                   ▲
FIWARE Orion ──webhook──► app-route ──Socket.IO──► Frontend (real-time)
```

---

## Tech Stack & Structure

**Stack**: Node.js + TypeScript + Express + PostgreSQL + swagger-ui-express + @kubernetes/client-node

**Structure**:
```
server/src/
├── index.ts                        # Entry point, cors, cookie-parser, swagger, routes
├── config/
│   ├── database.ts                 # PostgreSQL pool
│   └── swagger.ts                  # OpenAPI 3.0 spec → GET /api/docs
├── controllers/
│   ├── auth.controller.ts          # JWT auth (7 handlers)
│   ├── camera.controller.ts        # Camera API (3 handlers)
│   ├── data-library.controller.ts  # Data Library CRUD + download (8 handlers)
│   ├── model.controller.ts         # ML Model management + k8s train/reload (6 handlers)
│   ├── model-metrics.controller.ts # Model metrics history (2 handlers)
│   └── test.controller.ts
├── middleware/
│   └── auth.middleware.ts          # requireAuth, requireTechnician, logActivity
├── migrations/
│   └── 001_auth_tables.sql         # technician_accounts + activity_logs
└── routes/
    ├── auth.api.ts, camera.api.ts, data-library.api.ts
    ├── model.api.ts, model-metrics.api.ts, test.api.ts
```

---

## API Endpoints Summary

> Chi tiết đầy đủ xem `reports/FUNCTION_LIST.md` Section "Backend Node.js API Server"
> Swagger UI tại `GET /api/docs`

| Prefix | Count | Ghi chú |
|:---|:---:|:---|
| `GET /api/docs` | — | Swagger UI |
| `/api/auth` | 7 | POST guest-token, login, refresh, logout · GET me, activity-logs · PUT change-password |
| `/api/cameras` | 3 | GET all, GET :id, GET nearby (TODO GPS) |
| `/api/models` | 6 | GET active/all/history/:id · POST train (k8s Job) · POST :id/activate (hot reload) |
| `/api/model-metrics` | 2 | GET latest, GET history |
| `/api/data-library` | 8 | GET collections + :id · POST/DELETE collections · GET download · POST/DELETE entries |

### Auth & Middleware
- `requireAuth` → verify JWT, inject `req.auth`. Áp dụng cho **tất cả** `/api/*`
- `requireTechnician` → check `role=technician`. Áp dụng cho POST train/activate, write data-library
- Viewer role: anonymous JWT 24h (auto-cấp bởi `POST /api/auth/guest-token`)
- Technician role: JWT 8h + refresh cookie 30d (email + bcrypt password)

---

## Database Schema

**Reference**: `schemas/DATABASE_SCHEMA.md`

Key tables: `camera_data`, `camera_detections`, `camera_forecasts`,
`model_metrics_history`, `ml_model_metadata`, `backup_logs`,
`data_library_collections`, `data_library_entries`,
`technician_accounts`, `activity_logs`

---

## Environment Variables

```env
PORT=8080
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<refresh-secret>
CORS_ORIGIN=https://web.devmindtan.com,http://localhost:5173   # comma-separated
IMAGE_PREDICT_RELOAD_URL=http://image-predict-service:8080     # k8s ClusterIP
IMAGE_PREDICT_IMAGE_FALLBACK=devmindtan/dev-repo:image-predict-latest
```

**Scripts**:
```bash
npm run dev    # Development (hot reload)
npm run build  # Compile TypeScript
npm start      # Production mode
```

---

## k8s Deploy Notes

- `server.yaml` cần `serviceAccountName: server-sa`
- Apply `k8s-configs/services/server-rbac.yaml` một lần trên cluster
- Sau activate model: HTTP POST đến `IMAGE_PREDICT_RELOAD_URL/reload` (hot-swap, không restart pod)

---

## Related Documentation
- `schemas/DATABASE_SCHEMA.md` - DB schema chi tiết
- `schemas/MINIO_STORAGE_SCHEMA.md` - MinIO bucket structure
- `reports/FUNCTION_LIST.md` - Master function list (27 backend functions)
- `web/commands/CAMERA_API_INTEGRATION.md` - API integration guide

---

## Related Documentation
- `/schemas/DATABASE_SCHEMA.md` - Database schema
- `web/web-user/commands/CAMERA_API_INTEGRATION.md` - API integration guide

**Version**: 1.1.0