# Commands / Documentation Folder

Folder này chứa các tài liệu hướng dẫn và reference cho dự án Traffic Monitoring System.

## Files Overview

### 📘 [PROJECT_CONTEXT_FRONTEND.md](./PROJECT_CONTEXT_FRONTEND.md)
**Mục đích**: Tài liệu tổng quan về frontend architecture

**Nội dung**:
- Mô tả dự án và mục tiêu
- Công nghệ stack (React, TypeScript, Vite, Tailwind, Shadcn UI)
- Cấu trúc components và pages
- Data flow architecture (Socket.IO + Database API)
- Real-time integration với FIWARE Orion
- Recent improvements và bug fixes

**Sử dụng khi**:
- Onboarding developer mới
- Hiểu kiến trúc tổng thể
- Reference về component structure
- Debug data flow issues

---

### 🔌 [CAMERA_API_INTEGRATION.md](./CAMERA_API_INTEGRATION.md)
**Mục đích**: Hướng dẫn backend implement Camera API endpoints

**Nội dung**:
- API endpoints cần implement (GET /api/cameras, /:cam_id, /nearby)
- Request/Response format chi tiết
- Frontend service implementation
- Data flow giữa frontend và backend
- Testing checklist
- Environment variables setup

**Sử dụng khi**:
- Backend team implement Camera API
- Frontend team verify API integration
- Debugging API calls
- API documentation reference

**Phối hợp**: Frontend đã implement `camera.service.ts`, backend cần implement endpoints

---

### 📊 [FIWARE_ORION_DATA_TEMPLATE.md](./FIWARE_ORION_DATA_TEMPLATE.md)
**Mục đích**: Reference format dữ liệu từ FIWARE Orion Context Broker

**Nội dung**:
- NGSI-LD data structure
- Attribute definitions (total_objects, detections, minio_key, prediction)
- Socket.IO event format
- Frontend transformation logic
- Handler examples

**Sử dụng khi**:
- Debug Socket.IO data
- Hiểu Orion data structure
- Implement data transformation
- Add new attributes

**Note**: Dữ liệu này được stream qua Socket.IO event "CAMERA_UPDATED"

---

### 🗄️ [SQL_COMMAND.md](./SQL_COMMAND.md)
**Mục đích**: Database schema reference

**Nội dung**:
- Table schemas (camera_data, camera_detections, camera_forecasts)
- 20 camera locations với INSERT statements
- Index optimizations
- Sample queries

**Sử dụng khi**:
- Setup database
- Verify camera IDs
- Backend query reference
- Database debugging

**Note**: File này được reference bởi cả frontend và backend teams

---

## Workflow & Dependencies

```
┌─────────────────────────────────────────────┐
│  PROJECT_CONTEXT_FRONTEND.md                │
│  (Tổng quan kiến trúc & data flow)          │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌────────────────────┐
│ CAMERA_API  │  │ FIWARE_ORION_DATA  │
│ INTEGRATION │  │ TEMPLATE           │
│             │  │                    │
│ (Database)  │  │ (Socket.IO)        │
└──────┬──────┘  └─────────┬──────────┘
       │                   │
       │    ┌──────────────┘
       │    │
       ▼    ▼
    ┌─────────────┐
    │ SQL_COMMAND │
    │ (Schema)    │
    └─────────────┘
```

## Data Sources

### Static Data (Database)
- **Source**: PostgreSQL → GET /api/cameras
- **Files**: `CAMERA_API_INTEGRATION.md`, `SQL_COMMAND.md`
- **Content**: cam_id, display_name, location
- **Frequency**: Fetch once on app mount

### Real-time Data (Socket.IO)
- **Source**: FIWARE Orion → Socket.IO
- **Files**: `FIWARE_ORION_DATA_TEMPLATE.md`
- **Content**: total_objects, detections, predictions, images
- **Frequency**: Continuous streaming

### Frontend Merge
- **File**: `src/contexts/SocketContext.tsx`
- **Logic**: Merge cameraInfoMap (DB) + cameras (Socket)
- **Output**: processedCameras array

## Update Guidelines

### Khi nào cần update các files:

**PROJECT_CONTEXT_FRONTEND.md**:
- ✏️ Thêm component/page mới
- ✏️ Thay đổi data flow
- ✏️ Thêm library/dependency mới
- ✏️ Fix bug quan trọng

**CAMERA_API_INTEGRATION.md**:
- ✏️ Thêm/sửa API endpoint
- ✏️ Thay đổi request/response format
- ✏️ Update backend implementation status

**FIWARE_ORION_DATA_TEMPLATE.md**:
- ✏️ Thêm attribute mới từ Orion
- ✏️ Thay đổi data structure
- ✏️ Update transformation logic

**SQL_COMMAND.md**:
- ✏️ Thêm/sửa table schema
- ✏️ Thêm camera mới
- ✏️ Update indexes

## Quick Links

- Frontend Code: `../src/`
- API Service: `../src/services/camera.service.ts`
- Socket Context: `../src/contexts/SocketContext.tsx`
- Data Table: `../src/components/data-table.tsx`
- Dashboard: `../src/pages/dashboard.tsx`

## Contact

- Frontend Team: [Frontend Lead]
- Backend Team: [Backend Lead]
- DevOps: [DevOps Lead]

---

**Last Updated**: February 13, 2026  
**Version**: 1.0  
**Maintained by**: Development Team
