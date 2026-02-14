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
        'last_predicted'
    ],
    attrs: {
        total_objects: {
            value: 17,
            type: 'Integer',
            creDate: 1770986279.4666724,
            modDate: 1770987589.739725,
            mdNames: []
        },
        detections: {
            value: {
                car: 5,
                motorbike: 12
            },
            type: 'StructuredValue',
            creDate: 1770986279.4666724,
            modDate: 1770987589.7397308,
            mdNames: []
        },
        minio_key: {
            value: '5d9dde1f766c880017188c98/20260213_195955.jpg',
            type: 'Text',
            creDate: 1770986279.4666724,
            modDate: 1770987596.6636603,
            mdNames: []
        },
        last_updated: {
            value: 1771012795.8005981,
            type: 'DateTime',
            creDate: 1770986279.4666724,
            modDate: 1770987596.6636634,
            mdNames: []
        },
        prediction: {
            value: {
                forecasts: {
                    "5m": 18,
                    "10m": 20,
                    "15m": 22,
                    "30m": 25,
                    "60m": 30
                },
                status: "clear",      // clear | congestion | unknown
                trend: "increasing"   // increasing | decreasing | stable
            },
            type: 'StructuredValue',
            creDate: 1770986279.4666724,
            modDate: 1770987596.6636634,
            mdNames: []
        },
        last_predicted: {
            value: "2026-02-13T19:59:55.800Z",
            type: 'DateTime',
            creDate: 1770986279.4666724,
            modDate: 1770987596.6636634,
            mdNames: []
        }
    },
    creDate: 1770986279.4666724,
    modDate: 1770987596.6636863,
    lastCorrelator: 'e5831d84-08db-11f1-a160-b6899d3e9cd7'
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
- **Description**: Đường dẫn file ảnh trên MinIO storage
- **Format**: `{camera_id}/{YYYYMMDD_HHMMSS}.jpg`
- **Full URL**: `${VITE_MINIO_URL}/images/${minio_key}`

### last_updated
- **Type**: DateTime
- **Description**: Timestamp (Unix epoch) lần cập nhật dữ liệu cuối
- **Format**: Seconds since epoch (e.g., 1771012795.8005981)

### prediction (Optional)
- **Type**: StructuredValue (Object)
- **Description**: Dự đoán lưu lượng từ ML models
- **Fields**:
  - `forecasts`: Object chứa dự đoán cho 5m, 10m, 15m, 30m, 60m
  - `status`: Trạng thái giao thông (clear/congestion/unknown)
  - `trend`: Xu hướng (increasing/decreasing/stable)

### last_predicted (Optional)
- **Type**: DateTime  
- **Description**: Timestamp lần chạy prediction cuối
- **Format**: ISO 8601 string hoặc Unix epoch

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
  imageUrl: string;              // ${MINIO_URL}/images/${minio_key}
  lastUpdated: string;           // attrs.last_updated.value (as string)
  status: string;                // attrs.prediction.value.status
  trend: string;                 // attrs.prediction.value.trend
  forecasts: {                   // attrs.prediction.value.forecasts
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  lastPredicted: string;         // attrs.last_predicted.value
}
```

## Notes
- Tất cả attributes đều optional (`?`) trong interface để xử lý missing data
- Frontend sử dụng nullish coalescing (`??`) cho default values
- `creDate` và `modDate` là Unix timestamps (seconds)
- Socket connection URL: `VITE_SOCKET_URL` from environment variables