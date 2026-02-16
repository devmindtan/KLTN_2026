# Image Process Service Context

**Last Updated**: 16/02/2026

## Chủ đề:
Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị

## Mô tả Service:
Python service sử dụng **YOLOv11** (Ultralytics) để phát hiện và đếm phương tiện từ camera giao thông, sau đó upload kết quả lên MinIO và cập nhật FIWARE Orion.

### Kiến trúc hệ thống:
```
┌────────────────────────────────────────────────┐
│  Traffic Cameras (20 cameras)                  │
│  - Stream: RTSP/HTTP                          │
│  - Source: go2rtc service                     │
└──────────────┬─────────────────────────────────┘
               │ HTTP GET (snapshot)
               ▼
┌────────────────────────────────────────────────┐
│  Image Process Service (YOLOv11)               │  ← You are here
│  ├─ Fetch camera snapshots                    │
│  ├─ Run object detection (best.pt)            │
│  ├─ Count vehicles: car, motorcycle, bus, etc │
│  ├─ Annotate image với bounding boxes         │
│  ├─ Upload to MinIO                           │
│  ├─ Save to PostgreSQL (camera_detections)    │
│  └─ Update FIWARE Orion (realtime status)     │
└──────────────┬─────────────────────────────────┘
               │ Store & Notify
               ▼
┌──────────────┬─────────────────────────────────┐
│  MinIO Object Storage                          │
│  - Bucket: traffic-images                     │
│  - Format: {YYYYMMDD}/{camera_id}_{HHmmSS}.jpg│
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  PostgreSQL Database                           │
│  - Table: camera_detections                    │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  FIWARE Orion Context Broker                   │
│  - Entity: urn:ngsi-ld:Camera:{id}            │
│  - Attributes: total_objects, detections, etc  │
└────────────────────────────────────────────────┘
```

### Tech Stack:
- **Runtime**: Python 3.11+
- **Computer Vision**: YOLOv11 (Ultralytics)
- **Image Processing**: OpenCV, numpy
- **Object Storage**: MinIO (boto3)
- **Database**: PostgreSQL (psycopg2 connection pool)
- **FIWARE Integration**: aiohttp (async HTTP client)
- **Concurrency**: asyncio

### Cấu trúc thư mục:
```
image-process/
├── src/
│   ├── main.py                # Entry point, async processing logic
│   ├── best.pt                # YOLOv11 trained model
│   ├── test_posgres_conn.py   # Database connection test
│   ├── .env.example           # Environment template
│   ├── Dockerfile             # Container configuration
│   └── requirements.txt       # Python dependencies
├── tests/
│   ├── conftest.py           # Pytest configuration
│   └── test_service_1.py     # Unit tests
└── commands/
    └── PROJECT_CONTEXT.md    # This file
```

### Chức năng chính:

#### 1. Camera Snapshot Fetching:
- **Source**: go2rtc service (HTTP snapshot endpoint)
- **Cameras**: 20 cameras (hardcoded list)
- **Concurrency**: Async fetch với `aiohttp.ClientSession`
- **Timeout**: 5 seconds per camera

#### 2. YOLOv11 Object Detection:
- **Model**: `best.pt` (custom trained hoặc pretrained)
- **Classes**: car, motorcycle, bus, truck, person, bicycle, etc.
- **Confidence threshold**: Default (có thể config)
- **Output**:
  - Bounding boxes (x1, y1, x2, y2)
  - Class labels
  - Confidence scores
  - Detection counts per class

#### 3. Image Annotation & Upload:
- **Annotation**: 
  - Draw bounding boxes trên ảnh gốc
  - Line width: 1px, Font size: 0.5
  - Không hiển thị labels (labels=False)
- **Upload to MinIO**:
  - Bucket: `traffic-images` (hoặc MINIO_BUCKET_NAME)
  - Path: `{YYYYMMDD}/{camera_id}_{HHmmss}.jpg`
  - Content-Type: `image/jpeg`

#### 4. Database Persistence:
- **Table**: `camera_detections`
- **Columns**:
  - `minio_key`: Đường dẫn file trên MinIO
  - `camera_id`: ID camera
  - `detections`: JSONB (chi tiết đếm, e.g., {"car": 5, "motorcycle": 10})
  - `total_objects`: Tổng số phương tiện
  - `created_at`: Timestamp
- **Connection**: ThreadedConnectionPool (minconn=1, maxconn=20)

#### 5. FIWARE Orion Integration:
- **Method**: HTTP POST với `options=upsert`
- **Entity ID**: `urn:ngsi-ld:Camera:{camera_id}`
- **Attributes**:
  ```json
  {
    "id": "urn:ngsi-ld:Camera:662b86c41afb9c00172dd31c",
    "type": "Camera",
    "total_objects": {"type": "Integer", "value": 45},
    "detections": {"type": "StructuredValue", "value": {"car": 30, "motorcycle": 15}},
    "minio_key": {"type": "Text", "value": "20260216/662b86c4_103000.jpg"},
    "last_updated": {"type": "DateTime", "value": "2026-02-16T10:30:00"}
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `fiware-service: traffic_monitor`
  - `fiware-servicepath: /`

### Environment Variables:
```bash
# MinIO Configuration
MINIO_ENDPOINT_URL=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=traffic-images

# FIWARE Orion
FIWARE_ORION_BASE=orion:1026

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_DBS=traffic_db
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=password
POSTGRES_PORT=5432
```

### Camera List (20 cameras):
```python
CAMERA_LIST = [
    "662b86c41afb9c00172dd31c",  # Trần Quang Khải - Trần Khắc Chân
    "5a6065c58576340017d06615",  # Tô Ngọc Vân – TX25
    "6623f4df6f998a001b2528eb",  # Quốc Lộ 13 - cầu Ông Dầu
    # ... (total 20 cameras)
]
```

### Processing Flow:

1. **Main Loop** (Continuous):
   ```
   for camera_id in CAMERA_LIST:
       → Fetch snapshot from go2rtc
       → Process with YOLOv11 (in thread pool)
       → Save to PostgreSQL
       → Upload to MinIO
       → Update FIWARE Orion
       → Sleep 1 second between cameras
   ```

2. **Thread Pool Execution**:
   - YOLOv11 inference chạy trong thread riêng
   - Tránh block async event loop
   - Concurrent với database và MinIO operations

### Performance Considerations:

#### Throughput:
- **20 cameras** / loop
- **1 second** delay per camera
- **~20 seconds** per full cycle
- **~3 cycles/minute** = 60 images/minute

#### Resource Usage:
- **CPU**: High (YOLOv11 inference)
- **Memory**: ~2-4GB (model + opencv buffers)
- **Network**: ~10-20MB/min upload to MinIO
- **Storage**: ~50-100MB/hour (depends on image quality)

### Deployment:

#### Container Configuration:
- **Base Image**: python:3.11-slim
- **GPU Support**: Optional (CUDA runtime needed)
- **Restart Policy**: Always
- **Health Check**: None (có thể thêm)

#### Kubernetes CronJob (Alternative):
```yaml
schedule: "*/5 * * * *"  # Mỗi 5 phút
concurrencyPolicy: Forbid
```

### Logging Format:
```
%(asctime)s - %(levelname)s - %(message)s
2026-02-16 10:30:00 - INFO - [662b86c41afb9c00172dd31c] Phát hiện: {'car': 30, 'motorcycle': 15}
2026-02-16 10:30:00 - INFO - [662b86c41afb9c00172dd31c] FIWARE Update OK
2026-02-16 10:30:00 - INFO - 20260216/662b86c4_103000.jpg DB Save OK
```

### Known Limitations:
- Hardcoded camera list (không dynamic)
- Không có retry mechanism cho failed snapshots
- Sequential processing (không parallel cho tất cả cameras)
- Không có model versioning
- Không có confidence threshold configuration
- ThreadedConnectionPool có thể exhaust nếu too many concurrent requests

### Future Enhancements:
- Dynamic camera list từ database/config
- Parallel processing với ProcessPoolExecutor
- Retry logic với exponential backoff
- Health check endpoint
- Metrics endpoint (Prometheus)
- Model versioning và hot-reload
- Configurable detection confidence threshold
- Object tracking (DeepSORT) để đếm chính xác hơn
- Video processing thay vì snapshots
