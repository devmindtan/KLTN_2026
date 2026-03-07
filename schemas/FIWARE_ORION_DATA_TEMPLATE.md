# FIWARE Orion Context Broker - Camera Data Template

## Mô tả
Template dữ liệu NGSI-LD format từ FIWARE Orion Context Broker được gửi qua Socket.IO event "CAMERA_UPDATED".

## Full Data Structure với Prediction

```javascript
{
    _id: {
        id: 'urn:ngsi-ld:Camera:5d9dde1f766c880017188c98',
        type: 'Camera',
        servicePath: '/'
    },
    attrNames: [
        'total_objects',
        'detections',
        'minio_key',
        'last_updated',
        'prediction',
        'last_predicted',
        'status'
    ],
    attrs: {
        total_objects: {
            value: 17,
            type: 'Integer',
            creDate: 1770986279.4666724,
            modDate: 1771235594.385183,
            mdNames: []
        },
        detections: {
            value: {
                motorbike: 15,
                car: 2
            },
            type: 'StructuredValue',
            creDate: 1770986279.4666724,
            modDate: 1771235594.3851888,
            mdNames: []
        },
        minio_key: {
            value: '5d9dde1f766c880017188c98/20260216_165322.jpg',
            type: 'Text',
            creDate: 1770986279.4666724,
            modDate: 1771235603.0193129,
            mdNames: []
        },
        last_updated: {
            value: '2026-02-27T14:08:00.348Z',  // ISO 8601 format
            type: 'DateTime',
            creDate: 1770986279.4666724,
            modDate: 1771235603.0193207,
            mdNames: []
        },
        last_predicted: {
            creDate: 1770989762.1913393,
            mdNames: [],
            modDate: 1771235475.4473288,
            type: 'DateTime',
            value: '2026-02-27T14:10:00.123Z'  // ISO 8601 format
        },
        status: {
            creDate: 1771235518.4650993,
            mdNames: [],
            modDate: 1771235518.4650993,
            type: 'StructuredValue',
            value: {
                current: 'free_flow',  // Từ image-process (real-time ~5-30s)
                realtime: {  // Thông tin chi tiết real-time detection
                    current_volume: 17,  // Số phương tiện thực tế phát hiện
                    detections: {  // Chi tiết theo loại xe
                        car: 2,
                        motorbike: 15
                    },
                    capacity: 120.0,  // Capacity camera (MAX 7 ngày)
                    vc_ratio: 0.1417,  // 17 / 120 ≈ 14%
                    timestamp: '2026-02-27T14:08:00.385Z'  // ISO 8601 format
                }
            }
        },
        prediction: {
            creDate: 1770989762.1913345,
            mdNames: [],
            modDate: 1771235475.447323,
            type: 'StructuredValue',
            value: {
                input_value: 17.0,          // Giá trị trung bình 5p (avg_objects) dùng làm input cho model
                forecasts: {
                    '5m': 11.3,
                    '10m': 12.1,
                    '15m': 11.9,
                    '30m': 11.9,
                    '60m': 12.5
                },
                status: {
                    forecast: 'smooth',  // Từ predict_realtime (cronjob 5 phút)
                    calculation: {
                        predicted_volume: 11.3,  // Giá trị dự đoán 5p
                        capacity: 120.0,          // Capacity camera (MAX 7 ngày)
                        vc_ratio: 0.09            // 11.3 / 120 = 9%
                    }
                },
                // GTI-based trend object (thay thế string đơn kể từ 07/03/26)
                trend: {
                  direction: 'increasing',      // increasing | decreasing | stable
                  gti_state: 'normal',          // free_flow | normal | congestion_start | congestion_risk
                  gti: 38.5,                    // GTI (%) = Σ(P_i×w_i)/Max×100
                  current_ratio: 24.0,          // Current/Max×100 (%)
                  diff: 14.5                    // GTI - current_ratio (%)
                }
            }
        }
    },
    creDate: 1770986279.4666724,
    modDate: 1771235603.0193279,
    lastCorrelator: '54d1beb4-0b1d-11f1-8151-b6899d3e9cd7'
}
```

## Attribute Details

### total_objects
- **Type**: Integer
- **Description**: Tổng số phương tiện được phát hiện
- **Value**: Số nguyên >= 0

### detections
- **Type**: StructuredValue (Object)
- **Description**: Chi tiết số lượng theo loại phương tiện
- **Fields**:
  - `car`: Số lượng ô tô
  - `motorbike`: Số lượng xe máy

### minio_key
- **Type**: Text
- **Description**: Đường dẫn file ảnh trên MinIO storage (không có bucket prefix)
- **Format**: `images/{camera_id}/{YYYYMMDD_HHMMSS}.jpg`
- **Full URL**: `${VITE_MINIO_URL}/${minio_key}` (minio_key đã chứa `images/` prefix)

### last_updated
- **Type**: DateTime
- **Description**: Timestamp ISO 8601 lần cập nhật dữ liệu cuối (image-process upload lên FIWARE)
- **Format**: ISO 8601 string (e.g., `2026-02-27T14:08:00.348Z`) – UTC

### status (Optional)
- **Type**: StructuredValue (Object)
- **Description**: Trạng thái giao thông hiện tại từ image-process service (real-time)
- **Fields**:
  - `current`: Trạng thái HIỆN TẠI (từ image-process, tính từ total_objects thực tế, cập nhật ~5-30s)
  - `realtime`: Object chứa thông tin chi tiết real-time (giống calculation trong prediction)
    - `current_volume`: Số phương tiện thực tế phát hiện được (real-time detection)
    - `detections`: Object chi tiết theo loại xe {car: X, motorbike: Y}
    - `capacity`: Capacity realtime - **MAX(ĐÒNG lớn nhất)** trong 7 ngày, KHÔNG qua trung bình 5p
    - `vc_ratio`: Tỷ lệ volume/capacity (0.0 - 1.0+)
    - `timestamp`: ISO 8601 string của lần detection (UTC, e.g. `2026-03-07T01:23:45.123Z`)
  - **Các giá trị LOS cho `current`**:
    - `free_flow`: LOS A (< 60% capacity) - Lưu lượng thông thoáng
    - `smooth`: LOS B-C (60-75% capacity) - Lưu lượng ổn định  
    - `moderate`: LOS D (75-85% capacity) - Lưu lượng trung bình
    - `heavy`: LOS E (85-100% capacity) - Lưu lượng nặng
    - `congested`: LOS F (>= 100% capacity) - Ùn tắc
    - `unknown`: Không đủ dữ liệu

### prediction (Optional)
- **Type**: StructuredValue (Object)
- **Description**: Dự đoán lưu lượng từ ML models (predict_realtime service, cronjob 5 phút)
- **Fields**:
  - `forecasts`: Object chứa dự đoán cho 5m, 10m, 15m, 30m, 60m
  - `status`: Object chứa trạng thái giao thông dự báo
    - `forecast`: Trạng thái DỰ BÁO 5 phút sau (tính từ ML prediction, cập nhật mỗi 5 phút)
    - `calculation`: Object chứa thông tin tính toán (giúp frontend hiển thị công thức)
      - `predicted_volume`: Giá trị dự đoán 5 phút sau (vehicles/5min)
      - `capacity`: Capacity prediction - **MAX(trung bình 5p)** trong 7 ngày
      - `vc_ratio`: Tỉ lệ Volume/Capacity (0.00-1.00+)
    - **Các giá trị LOS**: giống như `status.current`
  - `trend`: Object GTI-based (cập nhật 07/03/26, thay thế string đơn)
    - `direction`: xu hướng tổng hợp – `increasing` | `decreasing` | `stable` (ngưỡng ±5% absolute)
    - `gti_state`: phân loại GTI – `free_flow` | `normal` | `congestion_start` | `congestion_risk`
    - `gti`: GTI (%) = Σ(P_i×w_i)/Max×100, tổng hợp 5 mốc dự đoán
    - `current_ratio`: Current Ratio (%) = current/capacity×100
    - `diff`: GTI - current_ratio (%)

### last_predicted (Optional)
- **Type**: DateTime  
- **Description**: Timestamp lần chạy prediction cuối (predict_realtime service upload)
- **Format**: ISO 8601 string - UTC (e.g., `2026-03-07T01:25:00.000Z`)

### input_value (Embedded in prediction)
- **Embedded path**: `attrs.prediction.value.input_value`
- **Description**: Giá trị đầu vào của model (avg_objects trong cửa sổ cuối – ví dụ 15 phút gần nhất)
- **Type**: Number (float)
- **Added**: Entry 085 (07/03/26) – dùng trong ForecastAccuracyCard để hiển thị input của mô hình

## Socket.IO Event

### Event Name: `CAMERA_UPDATED`

### Handler Example
```typescript
socket.on("CAMERA_UPDATED", (data: NGSILDCamera) => {
    const cameraId = data._id.id;
    const totalVehicles = data.attrs.total_objects?.value ?? 0;
    const carCount = data.attrs.detections?.value?.car ?? 0;
    const motorbikeCount = data.attrs.detections?.value?.motorbike ?? 0;
    
    // Update state
    setCameras(prev => ({
        ...prev,
        [cameraId]: data
    }));
});
```

## Frontend Processing

### SocketContext Transformation
```typescript
// Input: NGSI-LD format (above)
// Output: CameraData interface

interface CameraData {
  id: string;                    // urn:ngsi-ld:Camera:...
  shortId: string;               // 5d9dde1f766c880017188c98
  name: string;                  // From database (Hồng Bàng - Hoàng Lê Kha)
  totalObjects: number;          // attrs.total_objects.value
  carCount: number;              // attrs.detections.value.car
  motorbikeCount: number;        // attrs.detections.value.motorbike
  imageUrl: string;              // ${MINIO_URL}/${minio_key}  (minio_key chứa images/ prefix)
  lastUpdated: string;           // attrs.last_updated.value (ISO 8601 UTC string)
  status: {                      // Dual status system
    current: string;             // attrs.status.value.current (real-time từ image-process)
    forecast: string;            // attrs.prediction.value.status.forecast (ML từ predict_realtime)
  };
  realtimeData?: {               // attrs.status.value.realtime
    current_volume: number;
    detections: { car: number; motorbike: number };
    capacity: number;
    vc_ratio: number;
    timestamp: string;           // ISO 8601 UTC
  };
  trend: {                       // attrs.prediction.value.trend (GTI object - đổi từ string 07/03/26)
    direction: string;           // increasing | decreasing | stable
    gti_state: string;           // free_flow | normal | congestion_start | congestion_risk
    gti: number;                 // GTI (%)
    current_ratio: number;       // Current Ratio (%)
    diff: number;                // GTI - Current Ratio (%)
  };
  forecasts: {                   // attrs.prediction.value.forecasts
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  inputValue?: number;           // attrs.prediction.value.input_value (avg_objects - input ML)
  lastPredicted: string;         // attrs.last_predicted.value (ISO 8601 UTC)
}
```

## Notes
- Tất cả attributes đều optional (`?`) trong interface để xử lý missing data
- Frontend sử dụng nullish coalescing (`??`) cho default values
- `creDate` và `modDate` của Orion là Unix timestamps (seconds) - không dùng trong app
- Socket connection URL: `VITE_SOCKET_URL` from environment variables
- Tất cả timestamp trong app đều là **ISO 8601 UTC** (không dùng Unix epoch nữa kể từ entry 055)

---

## Socket Events: Training & Reload (Added entry 061/067)

### Event: `TRAINING_JOB_UPDATED`
- **Trigger**: model-performance service gỏi webhook → app-route → Socket.IO
- **Payload**:
```json
{
  "type": "TRAINING_JOB_UPDATED",
  "data": {
    "jobId": "train_rf_20260307_012345",
    "modelType": "random_forest_5m",
    "status": "completed",       // 'pending' | 'running' | 'completed' | 'failed'
    "progress": 100,             // 0-100 (%)
    "metrics": { "mae": 2.5, "rmse": 3.1, "r2": 0.87 },
    "updatedAt": "2026-03-07T01:23:45.000Z"
  }
}
```

### Event: `MODEL_RELOAD_UPDATED`
- **Trigger**: Sau khi kỹ thuật viên activate model mới → backend call `/reload` endpoint → image-predict service nạp model → broadcast
- **Payload**:
```json
{
  "type": "MODEL_RELOAD_UPDATED",
  "data": {
    "modelType": "random_forest_5m",
    "modelVersion": "20260307_012345",
    "status": "success",         // 'reloading' | 'success' | 'failed'
    "activatedAt": "2026-03-07T01:25:00.000Z"
  }
}
```

### Frontend Handlers (app-route → WebSocket → React context `SocketContext`):
- `TRAINING_JOB_UPDATED` → `useTrainingJobSocket()` hook (updates training modal state)
- `MODEL_RELOAD_UPDATED` → `useModelReloadSocket()` hook (updates model reload status badge)