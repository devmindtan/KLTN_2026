# Backend Context - Traffic Management System

**Last Updated**: 16/02/2026

## Mô tả dự án
Backend REST API cho hệ thống quản lý lưu lượng giao thông đô thị.

### System Architecture:
```
Frontend (React) → Backend API (Express + TypeScript) → PostgreSQL
                                                      ↓
                                            FIWARE Orion (via Socket.IO)
```

**Note**: Real-time data từ FIWARE Orion qua Socket.IO (separate service).

---

## Tech Stack & Structure

**Stack**: Node.js + TypeScript + Express + PostgreSQL

**Structure**:
```
server/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   └── database.ts       # PostgreSQL pool
│   ├── controllers/          # Business logic
│   │   ├── test.controller.ts
│   │   └── camera.controller.ts
│   └── routes/              # API routes
│       ├── test.api.ts
│       └── camera.api.ts
├── package.json
└── tsconfig.json
```

---

## API Endpoints

### Camera Data API:
- `GET /api/cameras` - Lấy tất cả camera
- `GET /api/cameras/:cam_id` - Chi tiết camera
- `GET /api/cameras/nearby` - Tìm camera gần (query: lat, lng, radius)

---

## Database Schema

**Reference**: `/schemas/DATABASE_SCHEMA.md`

**Table `camera_data`**:
- `cam_id` (VARCHAR, PK): Camera ID
- `location` (TEXT): GPS coordinates `[lat, long]`
- `display_name` (TEXT): Tên hiển thị

---

## Environment & Scripts

**Environment** (`.env`):
```env
PORT=8080
DATABASE_URL=postgresql://user:password@host:port/database
CORS_ORIGIN=http://localhost:5173
```

**Scripts**:
```bash
npm run dev    # Development (hot reload)
npm run build  # Compile TypeScript
npm start      # Production mode
```

---

## Request Flow
```
GET /api/cameras
  ↓ CORS + JSON middleware
  ↓ Router → cameraApi
  ↓ Controller → getAllCameras()
  ↓ Database → pool.query()
  ↓ JSON Response
```

---

## Related Documentation
- `/schemas/DATABASE_SCHEMA.md` - Database schema
- `web/web-user/commands/CAMERA_API_INTEGRATION.md` - API integration guide

**Version**: 1.1.0