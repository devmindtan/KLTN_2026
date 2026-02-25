# Server - Traffic Management API

Backend REST API cho hệ thống quản lý và dự đoán lưu lượng giao thông đô thị. Server cung cấp camera data cho frontend dashboard thông qua RESTful API.

## Tech Stack

- **Node.js 20+** + **TypeScript 5.9**
- **Express.js 5.1** - Web framework
- **PostgreSQL** - Relational database
- **pg (node-postgres)** - PostgreSQL client
- **CORS** - Cross-Origin Resource Sharing
- **dotenv** - Environment variables management
- **ts-node-dev** - Development với hot reload

## Cấu trúc thư mục

```
server/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   └── database.ts       # PostgreSQL connection pool
│   ├── controllers/          # Business logic
│   │   ├── test.controller.ts
│   │   └── camera.controller.ts
│   └── routes/              # API routes
│       ├── test.api.ts
│       └── camera.api.ts
└── package.json
```

## Cài đặt

### 1. Cài đặt dependencies:
```bash
cd server
npm install
```

### 2. Cấu hình môi trường:
Copy file `.env.example` thành `.env` và cập nhật:

```env
PORT=8080
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

**Ví dụ**:
```env
PORT=8080
DATABASE_URL=postgresql://postgres:admin@localhost:5432/traffic_db
```

### 3. Tạo database và bảng:

**Bước 1**: Tạo database
```bash
psql -U postgres
CREATE DATABASE traffic_db;
\c traffic_db
```

**Bước 2**: Chạy SQL commands
```bash
# Copy tất cả SQL từ src/commands/SQL_COMMAND.md
# Hoặc chạy từng lệnh trong psql
```

**Bước 3**: Verify data
```sql
SELECT COUNT(*) FROM camera_data;
-- Kết quả: 20 cameras
```

## Chạy ứng dụng

### Development mode (với hot reload):
```bash
npm run dev
```
**Output**:
```
PostgreSQL connected ✅
Server running on http://localhost:8080
```

### Build production:
```bash
npm run build      # Compile TypeScript → JavaScript
npm start          # Run compiled code
```

## API Endpoints

### Health Check
```http
GET /
```
**Response**: `"Hello from testController!"`

---

### Camera API (`/api/cameras`)

#### 1. Get All Cameras
```http
GET /api/cameras
```

**Response**:
```json
{
  "success": true,
  "count": 20,
  "data": [
    {
      "cam_id": "662b86c41afb9c00172dd31c",
      "location": "[10.7918902432446, 106.691054105759]",
      "display_name": "Trần Quang Khải - Trần Khắc Chân"
    },
    {
      "cam_id": "5d9dde1f766c880017188c98",
      "location": "[10.7618218104557, 106.633900254965]",
      "display_name": "Hồng Bàng - Hoàng Lê Kha"
    }
    // ... 18 cameras khác
  ]
}
```

**Usage trong Frontend**:
```typescript
// client/src/services/camera.service.ts
const cameras = await getAllCameras();
// => Array of 20 cameras
```

#### 2. Lấy thông tin chi tiết camera
```http
GET /api/cameras/:cam_id
```

**Example**:
```bash
curl http://localhost:8080/api/cameras/662b86c41afb9c00172dd31c
```

**Response**:
```json
{
  "success": true,
  "data": {
    "cam_id": "662b86c41afb9c00172dd31c",
    "location": "[10.7918902432446, 106.691054105759]",
    "display_name": "Trần Quang Khải - Trần Khắc Chân"
  }
}
```

**Error (404)**:
```json
{
  "success": false,
  "message": "Không tìm thấy camera với ID này"
}
```

#### 3. Tìm camera gần (Basic Implementation)
```http
GET /api/cameras/nearby?lat=10.791&lng=106.691&radius=1
```

**Query Parameters**:
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Bán kính tìm kiếm (km), default = 1

**Response**:
```json
{
  "success": true,
  "count": 20,
  "data": [...],
  "note": "Chức năng tìm kiếm theo vị trí có thể được nâng cấp với PostGIS"
}
```

**Note**: Implementation hiện tại chỉ return tất cả cameras. Cần nâng cấp với PostGIS để tính khoảng cách chính xác.

---

## Architecture

### Request Flow
```
Client Request
    ↓
Express Router (/api/cameras)
    ↓
Camera Controller (camera.controller.ts)
    ↓
PostgreSQL Pool (database.ts)
    ↓
Database Query
    ↓
JSON Response
```

### CORS Configuration
Server enable CORS cho phép frontend gọi API:
```typescript
// src/index.ts
app.use(cors());  // Allow all origins (development)
```

**Production**: Cần config CORS specific origin:
```typescript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Scripts

- `npm run dev` - Chạy development server với hot reload
- `npm run build` - Build TypeScript sang JavaScript
- `npm start` - Chạy production server

## Database Schema

### Bảng `camera_data` (Main Table)
| Column | Type | Description | Example |
|--------|------|-------------|--------|
| cam_id | VARCHAR(50) | ID camera (PK) | `662b86c41afb9c00172dd31c` |
| location | TEXT | GPS [lat, lng] | `[10.7918, 106.6910]` |
| display_name | TEXT | Tên vị trí | `Trần Quang Khải - Trần Khắc Chân` |

**Record Count**: 20 cameras (Hồ Chí Minh City)

### Bảng `camera_detections` (Future Use)
Lưu kết quả phân tích từ computer vision:
- camera_id, minio_key, total_objects, detections (JSONB), created_at

### Bảng `camera_forecasts` (Future Use)  
Lưu dự đoán ML:
- camera_id, forecast_for_time, horizon_minutes, predicted_value, actual_value, error_value

📖 **Chi tiết**: Xem `src/commands/SQL_COMMAND.md`

## Frontend Integration

### Environment Variables (Frontend)
```env
# client/.env
VITE_BACKEND_URL=http://localhost:8080
```

### API Client (Frontend)
```typescript
// client/src/services/camera.service.ts
import { BACKEND_API_URL } from '@/config';

export async function getAllCameras() {
  const response = await fetch(`${BACKEND_API_URL}/api/cameras`);
  const result = await response.json();
  return result.data; // Array<CameraInfo>
}
```

### Data Flow
```
┌─────────────────────────────────────────────┐
│  Frontend (React + Socket.IO)              │
│  - SocketContext: Real-time vehicle data   │
│  - camera.service: Static camera info      │
└─────────────┬───────────────────────────────┘
              │
      ┌───────┴────────┐
      │                │
      ▼                ▼
┌──────────┐    ┌─────────────┐
│ Socket.IO│    │  REST API   │ ← This Server
│  Server  │    │  (Express)  │
└──────────┘    └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ PostgreSQL  │
                │ camera_data │
                └─────────────┘
```

**Static Data** (Backend API):
- cam_id, display_name, location
- Fetched once on app mount

**Real-time Data** (Socket.IO):
- total_objects, detections, predictions, images
- Continuous streaming from FIWARE Orion

## Testing

### Manual Testing với curl
```bash
# Test health check
curl http://localhost:8080/

# Get all cameras
curl http://localhost:8080/api/cameras

# Get specific camera
curl http://localhost:8080/api/cameras/662b86c41afb9c00172dd31c

# Get nearby cameras
curl "http://localhost:8080/api/cameras/nearby?lat=10.791&lng=106.691"
```

### Testing với Postman/Thunder Client
1. Import API collection (tạo file `api-collection.json`)
2. Test từng endpoint
3. Verify response format

## Troubleshooting

### PostgreSQL Connection Error
```
PostgreSQL pool error: connection refused
```
**Solution**:
- Kiểm tra PostgreSQL service đang chạy: `sudo systemctl status postgresql`
- Verify DATABASE_URL trong `.env`
- Test connection: `psql -U postgres -d traffic_db`

### CORS Error
```
Access to fetch blocked by CORS policy
```
**Solution**:
- Verify server có `app.use(cors())`
- Kiểm tra frontend đang gọi đúng `VITE_BACKEND_URL`

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::8080
```
**Solution**:
```bash
# Find process using port 8080
lsof -i :8080
# Kill process
kill -9 <PID>
```

## Development Roadmap

### ✅ Completed (Phase 1)
- [x] Basic Express server setup
- [x] PostgreSQL connection pool
- [x] Camera API endpoints (GET all, GET by ID, GET nearby)
- [x] CORS configuration
- [x] TypeScript configuration
- [x] Development hot reload

### 🚧 In Progress (Phase 2)
- [ ] Add authentication/authorization (JWT)
- [ ] Implement PostGIS for accurate nearby search
- [ ] Add API pagination
- [ ] Setup logging system (Winston, Morgan)
- [ ] Add request validation (Joi/Zod)
- [ ] Error handling middleware

### 📋 Planned (Phase 3)
- [ ] Camera detections API
- [ ] Camera forecasts API
- [ ] Rate limiting
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Unit & integration tests
- [ ] Docker containerization
- [ ] CI/CD pipeline

## Project Structure Details

```
server/
├── src/
│   ├── index.ts                 # Server entry point, middleware setup
│   ├── config/
│   │   └── database.ts          # PostgreSQL connection pool config
│   ├── controllers/             # Business logic layer
│   │   ├── camera.controller.ts # Camera CRUD operations
│   │   └── test.controller.ts   # Health check endpoint
│   ├── routes/                  # Route definitions
│   │   ├── camera.api.ts        # /api/cameras routes
│   │   └── test.api.ts          # / health check route
│   └── commands/                # Documentation
│       ├── PROJECT_CONTEXT_BACKEND.md
│       └── SQL_COMMAND.md
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Template for .env
├── package.json                 # Dependencies & scripts
└── tsconfig.json                # TypeScript configuration
```

## Contributing

1. Create feature branch: `git checkout -b feature/new-endpoint`
2. Make changes and test
3. Commit: `git commit -m "Add new endpoint"`
4. Push: `git push origin feature/new-endpoint`
5. Create Pull Request

## Documentation

- **Backend Context**: `src/commands/PROJECT_CONTEXT_BACKEND.md`
- **Database Schema**: `src/commands/SQL_COMMAND.md`
- **Frontend Integration**: `../client/commands/CAMERA_API_INTEGRATION.md`

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [node-postgres Documentation](https://node-postgres.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Support

- **Backend Team**: [Your Name]
- **Issues**: [GitHub Issues Link]
- **Slack**: #backend-support

---

**Last Updated**: February 13, 2026  
**Version**: 1.0.0  
**License**: ISC
