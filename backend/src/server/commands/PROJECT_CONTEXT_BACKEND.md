# Backend Context - Traffic Management System

**Last Updated**: February 13, 2026

# Chủ đề:
Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị

## Mô tả dự án:
Backend REST API cho hệ thống quản lý và dự đoán lưu lượng giao thông đô thị. Server cung cấp:
- **Camera Database API** - Thông tin tĩnh về 20 cameras (vị trí, tên hiển thị)
- **PostgreSQL Integration** - Persistent storage cho camera data
- **RESTful Endpoints** - GET /api/cameras, GET /api/cameras/:cam_id
- **CORS Support** - Frontend integration từ http://localhost:5173

### System Architecture:
```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript)                          │
│  - SocketContext: Real-time data từ Socket.IO          │
│  - camera.service.ts: Static data từ Backend API       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼ HTTP REST API
┌────────────────────────────────────────────────────────┐
│  Backend API Server (Express + TypeScript)             │ ← You are here
│  - Route: /api/cameras                                 │
│  - Controller: camera.controller.ts                    │
│  - Database: PostgreSQL connection pool                │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼ SQL Queries
┌────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                   │
│  - Table: camera_data (20 records)                     │
│  - Table: camera_detections (future)                   │
│  - Table: camera_forecasts (future)                    │
└────────────────────────────────────────────────────────┘
```

**Note**: Real-time vehicle detection data đến từ FIWARE Orion Context Broker qua Socket.IO server (separate service).

## Kiến trúc Server:

### Tech Stack:
- **Runtime**: Node.js với TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM/Query**: pg (node-postgres)
- **Environment**: dotenv

### Cấu trúc thư mục:
```
server/
├── src/
│   ├── index.ts              # Entry point, server configuration
│   ├── config/
│   │   └── database.ts       # PostgreSQL connection pool
│   ├── controllers/          # Business logic handlers
│   │   ├── test.controller.ts
│   │   └── camera.controller.ts
│   ├── routes/              # API route definitions
│   │   ├── test.api.ts
│   │   └── camera.api.ts
│   └── commands/            # Documentation và SQL commands
│       ├── PROJECT_CONTEXT.md
│       └── SQL_COMMAND.md
├── package.json
└── tsconfig.json
```

### Database Schema:

#### Bảng `camera_data`:
- Lưu trữ thông tin camera giao thông
- Columns:
  - `cam_id` (VARCHAR(50), PRIMARY KEY): ID camera
  - `location` (TEXT): Tọa độ GPS [lat, long]
  - `display_name` (TEXT): Tên hiển thị vị trí camera

#### Bảng `camera_detections`:
- Lưu trữ kết quả phân tích từ camera
- Columns: id, camera_id, minio_key, total_objects, detections (JSONB), created_at

#### Bảng `camera_forecasts`:
- Lưu trữ dự đoán lưu lượng
- Columns: camera_id, forecast_for_time, horizon_minutes, predicted_value, actual_value, error_value, created_at

### API Endpoints:

#### Camera Data API (`/api/cameras`):
- `GET /api/cameras` - Lấy danh sách tất cả camera
- `GET /api/cameras/:cam_id` - Lấy thông tin chi tiết một camera

### Environment Variables:
```
PORT=8080
DATABASE_URL=postgresql://user:password@host:port/database
```

### Scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Usage**:
- `npm run dev` - Development mode với hot reload (recommended)
- `npm run build` - Compile TypeScript → JavaScript vào `/dist`
- `npm start` - Chạy compiled JavaScript từ `/dist` (production)

## Implementation Details

### Server Entry Point (src/index.ts)
```typescript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database";
import cameraApi from "./routes/camera.api";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/cameras", cameraApi);

// Test connection
pool.query("SELECT NOW()")
  .then(() => console.log("PostgreSQL connected ✅"))
  .catch((err) => console.error("PostgreSQL connection error:", err));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Request Flow Example
```
GET http://localhost:8080/api/cameras
    ↓
Express Middleware: cors() + express.json()
    ↓
Router: /api/cameras → cameraApi
    ↓
Controller: getAllCameras()
    ↓
Database: pool.query("SELECT...")
    ↓
Response: JSON { success, count, data }
```

## Development & Deployment

### Development Mode
```bash
npm run dev
# PostgreSQL connected ✅
# Server running on http://localhost:8080
```

### Production Build
```bash
npm run build  # TypeScript → JavaScript (/dist)
npm start      # Run production server
```

## Frontend Integration

Frontend fetch camera data khi mount:
```typescript
// client/src/contexts/SocketContext.tsx (useEffect)
const cameras = await getAllCameras();  // From backend API
setCameraInfoMap(cameras);              // Store static data
// Socket.IO updates real-time data sau đó
```

## Related Documentation

- **Database Schema**: `SQL_COMMAND.md`
- **Frontend Guide**: `../../../client/commands/CAMERA_API_INTEGRATION.md`
- **Setup Instructions**: `../../README.md`

---

**Version**: 1.0.0  
**Last Updated**: February 13, 2026