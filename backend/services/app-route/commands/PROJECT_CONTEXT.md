# App Route Service Context

**Last Updated**: 16/02/2026

## Chủ đề:
Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị

## Mô tả Service:
Python Flask-SocketIO service đóng vai trò **WebSocket Gateway** - nhận FIWARE Orion webhook và phát sóng realtime data sang Frontend React qua Socket.IO.

### Kiến trúc hệ thống:
```
┌─────────────────────────────────────────────┐
│  FIWARE Orion Context Broker                │
│  - Lưu trữ Camera Entities (20 cameras)     │
│  - Subscription với Webhook notification    │
└──────────────┬──────────────────────────────┘
               │ HTTP POST /webhook
               ▼
┌──────────────────────────────────────────────┐
│  App Route Service (Flask + SocketIO)       │  ← You are here
│  - Route: POST /webhook                     │
│  - Emit: CAMERA_UPDATED event               │
│  - Transport: WebSocket (gevent)            │
└──────────────┬───────────────────────────────┘
               │ Socket.IO emit
               ▼
┌──────────────────────────────────────────────┐
│  Frontend (React + TypeScript)              │
│  - SocketContext.tsx                        │
│  - Listen: CAMERA_UPDATED event             │
│  - Update React state realtime              │
└──────────────────────────────────────────────┘
```

### Tech Stack:
- **Runtime**: Python 3.11+
- **Framework**: Flask 3.x
- **WebSocket**: Flask-SocketIO với Gevent
- **Concurrency**: Gevent (monkey patching)
- **Logging**: Python logging module

### Cấu trúc thư mục:
```
app-route/
├── src/
│   ├── main.py              # Entry point, Flask app, SocketIO logic
│   ├── .env.example         # Environment template
│   ├── Dockerfile           # Container configuration
│   └── requirements.txt     # Python dependencies
├── tests/
│   ├── conftest.py         # Pytest configuration
│   └── test_service_2.py   # API endpoint tests
└── commands/
    └── PROJECT_CONTEXT.md  # This file
```

### Chức năng chính:

#### 1. FIWARE Webhook Handler (`POST /webhook`):
- **Input**: FIWARE Orion notification payload (JSON)
- **Format**:
  ```json
  {
    "data": [
      {
        "id": "urn:ngsi-ld:Camera:662b86c41afb9c00172dd31c",
        "type": "Camera",
        "total_objects": {"type": "Integer", "value": 45},
        "detections": {"type": "StructuredValue", "value": {...}},
        "minio_key": {"type": "Text", "value": "..."},
        "last_updated": {"type": "DateTime", "value": "2026-02-16T10:30:00"}
      }
    ]
  }
  ```
- **Logic**: Loop qua từng entity trong `data` array, emit Socket.IO event
- **Response**: HTTP 204 No Content

#### 2. Socket.IO Event Broadcasting:
- **Event name**: `CAMERA_UPDATED`
- **Payload**: Raw entity object từ FIWARE
- **Namespace**: Default (`/`)
- **CORS**: Cho phép tất cả origins (`*`)

#### 3. Network Discovery:
- Utility function `get_ip()`: Lấy IP nội bộ của container/máy
- Utility function `show_all_ips()`: Hiển thị tất cả IP interfaces cho debugging

### Environment Variables:
```bash
# Không có ENV riêng (Service đơn giản)
# Port mặc định: 5000
# Host: 0.0.0.0 (Listen trên tất cả interfaces)
```

### Deployment:
- **Container Port**: 5000
- **Health Check**: Không có endpoint health (có thể thêm `GET /health`)
- **Scaling**: Single instance (Stateless, có thể scale ngang nếu cần)

### Logging Format:
```
%(asctime)s - %(levelname)s - %(message)s
2026-02-16 10:30:00 - INFO - --- Nhận từ Orion ---
2026-02-16 10:30:00 - INFO - Đã emit dữ liệu của: urn:ngsi-ld:Camera:662b86c41afb9c00172dd31c
```

### Integration Points:

#### Upstream (Input):
- **Source**: FIWARE Orion Context Broker
- **Method**: HTTP POST webhook
- **URL Pattern**: `http://<app-route-ip>:5000/webhook`

#### Downstream (Output):
- **Target**: Frontend React App (port 5173 local, production varies)
- **Method**: Socket.IO event emission
- **Event**: `CAMERA_UPDATED`

### Known Limitations:
- Không có validation cho webhook payload (tin tưởng FIWARE hoàn toàn)
- Không có authentication/authorization
- Không có retry mechanism nếu frontend disconnect
- Không persist data (pure relay service)

### Future Enhancements:
- Thêm JWT authentication cho Socket.IO connections
- Health check endpoint
- Metrics endpoint (Prometheus compatible)
- Request validation với Pydantic
- Rate limiting cho webhook endpoint
