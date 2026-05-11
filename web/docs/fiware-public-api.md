# FIWARE NGSI-v2 Public API

> **Base URL:** `https://fiware.devmindtan.uk`  
> **Engine:** FIWARE Orion Context Broker v4.4.0  
> **Trạng thái:** Public read-only — không cần API key (phase hiện tại)

---

## Tổng quan

API này expose trực tiếp FIWARE Orion Context Broker — nguồn dữ liệu giao thông thời gian thực từ hệ thống camera giám sát đô thị. Mỗi entity loại `Camera` chứa:

- Số phương tiện phát hiện (real-time)
- Trạng thái giao thông theo chuẩn LOS A–F
- Dự báo lưu lượng 5/10/15/30/60 phút tới
- Xu hướng GTI (Growth Traffic Index)

---

## Xác thực

| Phase                  | Yêu cầu                        |
| ---------------------- | ------------------------------ |
| **Hiện tại (Phase 1)** | Không cần API key              |
| **Phase sau**          | `x-api-key: <YOUR_KEY>` header |

---

## Headers bắt buộc

Với mọi request đến `/v2/...`:

```
fiware-service: traffic_monitor
fiware-servicepath: /
```

Endpoint `/version` không cần headers trên.

---

## Endpoints

| Method | Path                            | Mô tả                                           |
| ------ | ------------------------------- | ----------------------------------------------- |
| `GET`  | `/version`                      | Kiểm tra sức khoẻ và phiên bản Orion            |
| `GET`  | `/v2/entities`                  | Danh sách entities, lọc theo type và phân trang |
| `GET`  | `/v2/entities/{entityId}`       | Toàn bộ dữ liệu một Camera entity               |
| `GET`  | `/v2/entities/{entityId}/attrs` | Phần attributes của entity                      |
| `GET`  | `/v2/types`                     | Liệt kê tất cả entity types đang tồn tại        |

> **Chỉ đọc.** Mọi method ghi (POST, PATCH, PUT, DELETE) đều bị chặn ở phase 1.

---

## Ví dụ

### Kiểm tra Orion

```bash
curl -X GET 'https://fiware.devmindtan.uk/version'
```

**Response:**

```json
{
  "orion": {
    "version": "4.4.0",
    "uptime": "...",
    "doc": "https://fiware-orion.rtfd.io/en/4.4.0/"
  }
}
```

---

### Lấy danh sách 10 Camera (keyValues — compact)

```bash
curl -X GET 'https://fiware.devmindtan.uk/v2/entities?type=Camera&limit=10&options=keyValues' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

**Query params hữu ích:**

| Param     | Ví dụ                  | Mô tả                                                 |
| --------- | ---------------------- | ----------------------------------------------------- |
| `type`    | `Camera`               | Lọc theo entity type                                  |
| `limit`   | `10`                   | Số lượng kết quả (tối đa 100)                         |
| `offset`  | `20`                   | Phân trang                                            |
| `options` | `keyValues`            | Format rút gọn, giá trị thẳng thay vì `{value, type}` |
| `attrs`   | `total_objects,status` | Chỉ lấy một số attrs                                  |

---

### Lấy chi tiết một Camera

```bash
curl -X GET 'https://fiware.devmindtan.uk/v2/entities/urn:ngsi-ld:Camera:<id>' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

---

### Lấy chỉ attributes

```bash
curl -X GET 'https://fiware.devmindtan.uk/v2/entities/urn:ngsi-ld:Camera:<id>/attrs' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

---

## Cấu trúc Camera Entity

```json
{
  "id": "urn:ngsi-ld:Camera:5d9dde1f766c880017188c98",
  "type": "Camera",
  "total_objects": { "type": "Integer", "value": 17 },
  "detections": {
    "type": "StructuredValue",
    "value": { "car": 2, "motorbike": 15 }
  },
  "status": {
    "type": "StructuredValue",
    "value": {
      "current": "free_flow",
      "realtime": {
        "current_volume": 17,
        "capacity": 120,
        "vc_ratio": 0.1417,
        "timestamp": "2026-05-11T07:00:00.000Z"
      }
    }
  },
  "prediction": {
    "type": "StructuredValue",
    "value": {
      "forecasts": {
        "5m": 11.3,
        "10m": 12.1,
        "15m": 11.9,
        "30m": 11.9,
        "60m": 12.5
      },
      "trend": {
        "direction": "stable",
        "gti": 38.5,
        "gti_state": "normal"
      }
    }
  },
  "minio_key": { "type": "Text", "value": "5d9dde.../20260511_070000.jpg" },
  "last_updated": { "type": "DateTime", "value": "2026-05-11T07:00:00.000Z" }
}
```

### Giải thích trường quan trọng

| Trường                       | Kiểu            | Mô tả                                                                                |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `total_objects`              | Integer         | Tổng phương tiện phát hiện trong khung hình                                          |
| `detections`                 | StructuredValue | Chi tiết theo loại xe: `{ car, motorbike }`                                          |
| `status.current`             | Text            | Trạng thái LOS hiện tại: `free_flow` / `smooth` / `moderate` / `heavy` / `congested` |
| `status.realtime.vc_ratio`   | Number          | V/C ratio (0–1): lưu lượng / năng lực đường                                          |
| `prediction.forecasts`       | StructuredValue | Dự báo số phương tiện: `5m`, `10m`, `15m`, `30m`, `60m`                              |
| `prediction.trend.direction` | Text            | `increasing` / `decreasing` / `stable`                                               |
| `prediction.trend.gti`       | Number          | GTI index (%) — chỉ số tăng trưởng lưu lượng                                         |
| `minio_key`                  | Text            | Key để tải ảnh snapshot từ MinIO                                                     |
| `last_updated`               | DateTime        | Thời điểm cập nhật cuối (UTC ISO 8601)                                               |

---

## Level of Service (LOS)

| Giá trị     | V/C Ratio | Mô tả                                  |
| ----------- | --------- | -------------------------------------- |
| `free_flow` | < 40%     | Lưu lượng thấp, xe di chuyển tự do     |
| `smooth`    | 40–60%    | Ổn định, ít bị ảnh hưởng               |
| `moderate`  | 60–75%    | Lưu lượng trung bình, bắt đầu chậm lại |
| `heavy`     | 75–90%    | Đông xe, tốc độ giảm rõ rệt            |
| `congested` | > 90%     | Tắc nghẽn                              |

---

## Mã lỗi

| HTTP  | Ý nghĩa                            | Xử lý                                |
| ----- | ---------------------------------- | ------------------------------------ |
| `200` | Thành công                         | Đọc body JSON                        |
| `404` | Entity không tồn tại hoặc path sai | Kiểm tra lại `entityId`              |
| `422` | Query param không hợp lệ           | Xem log `description` trong response |
| `429` | Vượt rate limit                    | Retry với exponential backoff        |
| `5xx` | Lỗi upstream Orion                 | Retry sau vài giây                   |

---

## Khuyến nghị tích hợp

- **Polling interval:** 5–10 giây cho real-time display; 30 giây cho dashboard tổng quan.
- **Retry policy:** Backoff bắt đầu từ 1s, tăng gấp đôi tối đa 30s.
- **Timestamp:** Mọi giá trị thời gian là UTC — convert sang Asia/Ho_Chi_Minh (+07:00) khi hiển thị.
- **`options=keyValues`:** Dùng khi chỉ cần giá trị; bỏ đi để lấy đầy đủ `{value, type, creDate, modDate}`.

---

## Tài liệu tham khảo

- [FIWARE Orion API v2](https://fiware-orion.rtfd.io/en/4.4.0/)
- [NGSI-v2 Specification](https://fiware.github.io/specifications/ngsiv2/stable/)
