# Camera API Integration Guide

## Tổng quan
File này hướng dẫn backend implementation cho các API endpoints liên quan đến camera. Frontend đã sẵn sàng để consume các API này.

## API Service Frontend
- **File**: `client/src/services/camera.service.ts`
- **Base URL**: `VITE_BACKEND_URL` (defined in `.env`)

## Endpoints cần implement

### 1. GET /api/cameras
**Mô tả**: Lấy danh sách tất cả camera từ database

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "cam_id": "5d9dde1f766c880017188c98",
      "location": "[10.7618218104557, 106.633900254965]",
      "display_name": "Hồng Bàng - Hoàng Lê Kha"
    },
    {
      "cam_id": "662b86c41afb9c00172dd31c",
      "location": "[10.7918902432446, 106.691054105759]",
      "display_name": "Trần Quang Khải - Trần Khắc Chân"
    }
  ],
  "message": "Successfully retrieved cameras"
}
```

**Error Response**:
```json
{
  "success": false,
  "data": [],
  "message": "Error message here"
}
```

**Backend Implementation Notes**:
- Query table `camera_data` (theo DATABASE_SCHEMA.md)
- Return ALL cameras có trong database
- Ensure `cam_id` matches với camera ID từ Orion Context Broker

---

### 2. GET /api/cameras/:cam_id
**Mô tả**: Lấy chi tiết một camera theo ID

**URL Parameters**:
- `cam_id`: Camera ID (string)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "cam_id": "5d9dde1f766c880017188c98",
      "location": "[10.7618218104557, 106.633900254965]",
      "display_name": "Hồng Bàng - Hoàng Lê Kha"
    }
  ],
  "message": "Camera found"
}
```

**404 Response**:
```json
{
  "success": false,
  "data": [],
  "message": "Camera not found"
}
```

---

### 3. GET /api/cameras/nearby
**Mô tả**: Tìm camera gần vị trí hiện tại (trong bán kính cho trước)

**Query Parameters**:
- `lat`: Latitude (number)
- `lng`: Longitude (number)  
- `radius`: Bán kính tìm kiếm (meters, default: 1000)

**Example Request**:
```
GET /api/cameras/nearby?lat=10.7618&lng=106.6339&radius=2000
```

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "cam_id": "5d9dde1f766c880017188c98",
      "location": "[10.7618218104557, 106.633900254965]",
      "display_name": "Hồng Bàng - Hoàng Lê Kha"
    }
  ],
  "message": "Found 1 nearby cameras"
}
```

**Backend Implementation Notes**:
- Sử dụng PostGIS hoặc haversine formula để tính khoảng cách
- Parse location string `[lat, lng]` thành coordinates
- Filter cameras trong bán kính `radius`
- Sort by distance (gần nhất trước)

---

## Frontend Data Flow

### 1. Khởi tạo (Component Mount)
```
SocketProvider mount
  ↓
useEffect fetch getAllCameras()
  ↓
Store in cameraInfoMap: { cam_id → CameraInfo }
```

### 2. Real-time Updates (Socket)
```
Socket.IO event "CAMERA_UPDATED"
  ↓
Update cameras state (real-time data)
  ↓
useMemo processedCameras
  ↓
Merge: cameraInfoMap[cam_id] + socketData
  ↓
Result: {
  id, shortId, name ← from DB,
  totalObjects, carCount, motorbikeCount... ← from Socket
}
```

### 3. Data Structure Merged
**From Database** (Static - query once):
- `cam_id`
- `display_name` (→ `name`)
- `location`

**From Socket** (Real-time - continuous updates):
- `total_objects`
- `detections` (car, motorbike count)
- `minio_key` (image URL)
- `last_updated`
- `prediction` (forecasts, status, trend)
- `last_predicted`

---

## Database Schema Reference
Xem file: `/schemas/DATABASE_SCHEMA.md`

**Table**: `camera_data`
```sql
CREATE TABLE camera_data (
    cam_id VARCHAR(50) PRIMARY KEY,
    location TEXT,
    display_name TEXT
);
```

---

## Testing Checklist

### Backend Testing
- [ ] GET /api/cameras returns all cameras
- [ ] Response format matches specification
- [ ] cam_id matches Orion Camera IDs
- [ ] display_name is populated correctly
- [ ] GET /api/cameras/:cam_id works for valid ID
- [ ] GET /api/cameras/:cam_id returns 404 for invalid ID
- [ ] GET /api/cameras/nearby returns correct cameras
- [ ] Nearby search respects radius parameter
- [ ] CORS headers allow frontend domain

### Integration Testing
- [ ] Frontend successfully fetches camera list on load
- [ ] Camera names appear in data table
- [ ] Real-time socket data merges with database data
- [ ] Camera detail sheet shows both DB and real-time info
- [ ] No console errors related to missing camera data

---

## Environment Variables

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:8080
VITE_SOCKET_URL=https://socket.devmindtan.uk
VITE_MINIO_URL=https://api-minio.devmindtan.uk
```

### Backend (.env)
```env
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=traffic_monitoring
DB_USER=your_user
DB_PASSWORD=your_password

# API Port
PORT=8080

# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## Error Handling

### Frontend Handles:
- ✅ Network errors (fetch fails)
- ✅ Invalid response format
- ✅ Empty camera list
- ✅ Missing camera info (fallback to cam_id)

### Backend Should Handle:
- ❌ Database connection errors
- ❌ Invalid cam_id format
- ❌ SQL injection attempts
- ❌ Invalid lat/lng values
- ❌ Missing query parameters

---

## Migration Path

### Phase 1: ✅ COMPLETED (Frontend)
- Created camera.service.ts
- Updated CameraData interface with `name`
- Modified SocketContext to fetch and merge data
- Updated data-table schema and columns

### Phase 2: ⏳ PENDING (Backend)
- Implement GET /api/cameras
- Implement GET /api/cameras/:cam_id
- Implement GET /api/cameras/nearby
- Populate camera_data table with existing cameras

### Phase 3: Testing & Deployment
- Test API endpoints manually
- Integration test with frontend
- Deploy backend changes
- Verify production data

---

## Contact & Support
- Frontend Developer: [Your Name]
- Backend Developer: [Backend Team]
- Issue Tracker: [Link to Issues]

## Files Modified
1. `client/src/services/camera.service.ts` (NEW)
2. `client/src/contexts/SocketContext.tsx` (UPDATED)
3. `client/src/components/data-table.tsx` (UPDATED)

## Related Documentation
- `client/commands/API_BACKEND.md` - API endpoints overview
- `/schemas/DATABASE_SCHEMA.md` - Database schema
- `/schemas/FIWARE_ORION_DATA_TEMPLATE.md` - FIWARE format
- `client/commands/PROJECT_CONTEXT_FRONTEND.md` - Project overview
