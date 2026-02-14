# Commands / Documentation Folder (Backend)

Documentation folder cho backend Traffic Management API Server.

## Files Overview

### 📘 [PROJECT_CONTEXT_BACKEND.md](./PROJECT_CONTEXT_BACKEND.md)
**Mục đích**: Backend architecture và implementation guide

**Nội dung**:
- Server tech stack (Node.js, Express, TypeScript, PostgreSQL)
- Folder structure và file organization
- Database schema chi tiết (camera_data, camera_detections, camera_forecasts)
- API endpoints implementation (GET /api/cameras, /:cam_id, /nearby)
- Environment variables configuration
- Request flow diagram
- Frontend integration guide
- Development & deployment workflow

**Sử dụng khi**:
- Onboarding backend developer mới
- Hiểu kiến trúc server
- Implement new endpoints
- Debug API issues
- Reference code patterns

---

### 🗄️ [SQL_COMMAND.md](./SQL_COMMAND.md)
**Mục đích**: Database schema và setup commands

**Nội dung**:
- CREATE TABLE statements cho 3 tables:
  - `camera_data` (20 cameras - currently used)
  - `camera_detections` (future use)
  - `camera_forecasts` (future use)
- CREATE INDEX statements
- INSERT statements cho 20 cameras (Hồ Chí Minh City)
- Sample data với GPS coordinates

**Sử dụng khi**:
- Setup database lần đầu
- Add thêm cameras
- Verify database structure
- Reference table schemas
- Troubleshoot database issues

**Note**: File này giống với `client/commands/SQL_COMMAND.md` (shared reference)

---

## Workflow & Dependencies

```
┌─────────────────────────────────────────────┐
│  PROJECT_CONTEXT_BACKEND.md                 │
│  (Server architecture & implementation)     │
└──────────────┬──────────────────────────────┘
               │
               ▼
         ┌────────────┐
         │ SQL_COMMAND │
         │ (Database)  │
         └─────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ PostgreSQL  │
        │ Database    │
        └─────────────┘
               │
               ▼ Query Results
        ┌─────────────┐
        │ Express API │
        │ Controllers │
        └─────┬───────┘
               │
               ▼ JSON Response
        ┌─────────────┐
        │  Frontend   │
        │   Client    │
        └─────────────┘
```

## Implementation Status

### ✅ Completed
- [x] Basic Express server setup
- [x] PostgreSQL connection pool
- [x] CORS middleware
- [x] Camera API endpoints (GET all, GET by ID, GET nearby)
- [x] Error handling
- [x] TypeScript configuration
- [x] Development scripts (hot reload)

### 🚧 Future Implementation
- [ ] Authentication & JWT
- [ ] PostGIS for nearby search
- [ ] Camera detections API
- [ ] Camera forecasts API
- [ ] Request validation
- [ ] Rate limiting
- [ ] API documentation (Swagger)
- [ ] Unit tests

## Related Documentation

### Backend Files
- **Main README**: `../../README.md` - Setup guide & API documentation
- **Database Config**: `../config/database.ts` - PostgreSQL connection pool
- **Controllers**: `../controllers/camera.controller.ts` - Business logic
- **Routes**: `../routes/camera.api.ts` - Route definitions

### Frontend Files
- **API Integration Guide**: `../../../client/commands/CAMERA_API_INTEGRATION.md`
- **Frontend Context**: `../../../client/commands/PROJECT_CONTEXT_FRONTEND.md`
- **FIWARE Data**: `../../../client/commands/FIWARE_ORION_DATA_TEMPLATE.md`

## Quick Reference

### Start Development Server
```bash
cd server
npm run dev
```

### Test API Endpoints
```bash
# Get all cameras
curl http://localhost:8080/api/cameras

# Get specific camera
curl http://localhost:8080/api/cameras/662b86c41afb9c00172dd31c

# Get nearby cameras
curl "http://localhost:8080/api/cameras/nearby?lat=10.791&lng=106.691"
```

### Database Setup
```bash
psql -U postgres
CREATE DATABASE traffic_db;
\c traffic_db
# Copy SQL from SQL_COMMAND.md
```

### Environment Setup
```bash
cp .env.example .env
# Edit DATABASE_URL
```

## API Response Format

All API responses follow this format:

**Success Response**:
```json
{
  "success": true,
  "count": 20,          // Optional: number of records
  "data": [...]         // Array or Object
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Technical error message"  // Optional
}
```

## Data Flow Overview

### Static Data (Backend → Frontend)
```
PostgreSQL (camera_data)
    ↓ SQL Query
Express API (/api/cameras)
    ↓ HTTP GET
Frontend (camera.service.ts)
    ↓ Store
SocketContext (cameraInfoMap)
    ↓ Merge with real-time
Dashboard Display
```

### Real-time Data (Separate Flow)
```
Cameras → FIWARE Orion → Socket.IO → Frontend
(Not handled by this backend server)
```

## Update Guidelines

### Khi nào cần update files:

**PROJECT_CONTEXT_BACKEND.md**:
- ✏️ Thêm endpoint mới
- ✏️ Thay đổi server architecture
- ✏️ Update dependencies
- ✏️ Thêm middleware mới
- ✏️ Thay đổi error handling

**SQL_COMMAND.md**:
- ✏️ Thêm table mới
- ✏️ Modify table schema
- ✏️ Add/remove cameras
- ✏️ Update indexes
- ✏️ Add constraints

## Troubleshooting

### Common Issues

**PostgreSQL Connection Error**:
- Check service: `sudo systemctl status postgresql`
- Verify DATABASE_URL in `.env`
- Test connection: `psql -U postgres -d traffic_db`

**CORS Error from Frontend**:
- Verify `app.use(cors())` in `src/index.ts`
- Check frontend VITE_BACKEND_URL
- Clear browser cache

**Port 8080 Already in Use**:
```bash
lsof -i :8080
kill -9 <PID>
```

## Contact

- **Backend Team**: [Your Name]
- **Database Admin**: [DBA Name]
- **DevOps**: [DevOps Name]

---

**Last Updated**: February 13, 2026  
**Version**: 1.0  
**Maintained by**: Backend Development Team
