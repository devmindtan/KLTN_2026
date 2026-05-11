# Camera API Integration Guide

## Tổng quan
Backend API endpoints cho camera data. Frontend consume từ `camera.service.ts`.  
**Base URL**: `VITE_BACKEND_URL` (từ `.env`)

---

## API Endpoints

### 1. GET /api/cameras
**Mô tả**: Lấy danh sách tất cả camera từ database

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "cam_id": "5d9dde1f766c880017188c98",
      "location": "[10.7618218104557, 106.633900254965]",
      "display_name": "Hồng Bàng - Hoàng Lê Kha"
    }
  ]
}
```

**Implementation**: Query bảng `camera_data`, return tất cả cameras

---

### 2. GET /api/cameras/:cam_id
**Mô tả**: Lấy chi tiết một camera theo ID

**Response**: Như endpoint 1 nhưng single object. Return 404 nếu không tìm thấy.

---

### 3. GET /api/cameras/nearby
**Mô tả**: Tìm camera gần vị trí GPS (trong bán kính)

**Query Parameters**:
- `lat`, `lng`: GPS coordinates (number)
- `radius`: Bán kính tìm kiếm meters (default: 1000)

**Example**: `GET /api/cameras/nearby?lat=10.7618&lng=106.6339&radius=2000`

**Implementation**: Sử dụng PostGIS hoặc Haversine formula, parse location string `[lat, lng]`, filter theo radius, sort by distance.

---

## Frontend Data Flow

### Khởi tạo:
```
SocketProvider mount → getAllCameras() → Store in cameraInfoMap
```

### Real-time Updates:
```
Socket "CAMERA_UPDATED" → Merge: DB data (static) + Socket data (realtime)
```

### Data Structure:
- **From DB** (static): `cam_id`, `display_name`, `location`
- **From Socket** (realtime): `total_objects`, `detections`, `forecasts`, `status`, `trend`

---

## Environment Variables

**Frontend** (`.env`):
```env
VITE_BACKEND_URL=http://localhost:8080
VITE_SOCKET_URL=https://socket.devmindtan.uk
VITE_MINIO_URL=https://api-minio.devmindtan.uk
```

**Backend** (`.env`):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=traffic_monitoring
DB_USER=your_user
DB_PASSWORD=your_password
PORT=8080
CORS_ORIGIN=http://localhost:5173
```

---

## Database Schema
**Reference**: `/schemas/DATABASE_SCHEMA.md`

```sql
CREATE TABLE camera_data (
    cam_id VARCHAR(50) PRIMARY KEY,
    location TEXT,
    display_name TEXT
);
```

---

## Related Documentation
- `/schemas/DATABASE_SCHEMA.md` - Database schema
- `/schemas/FIWARE_ORION_DATA_TEMPLATE.md` - FIWARE format
- `web/commands/PROJECT_CONTEXT_FRONTEND.md` - Frontend overview
