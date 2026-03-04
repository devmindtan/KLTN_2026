# Data Library - Thiết kế Chức năng

> **Ngày tạo**: 04/03/26  
> **Trạng thái**: Bản thiết kế - chưa implement  
> **Phạm vi**: Backend (CronJob Python Service) + Frontend (React) + MinIO Storage

---

## 1. Tổng quan

Data Library là module quản lý tập dữ liệu giao thông tập trung, gồm:
- **Internal data**: Dữ liệu được tự động xuất hàng ngày từ hệ thống (CronJob)
- **External data**: Dữ liệu được admin import thủ công từ bên ngoài (upload dialog)

Mục tiêu: Cung cấp nơi lưu trữ, xem và tải xuống các bộ dữ liệu đã được tổ chức, phục vụ nghiên cứu, báo cáo và tái huấn luyện mô hình.

---

## 2. MinIO Storage Structure

### Bucket mới: `data-library`

```
data-library/                          <- bucket
├── internal/                          <- dữ liệu xuất từ cronjob
│   ├── 20260304_010000_detections.csv.gz
│   ├── 20260304_010000_detections.json.gz
│   ├── 20260304_010000_forecasts.csv.gz
│   ├── 20260304_010000_forecasts.json.gz
│   └── 20260304_010000_summary.json   <- metadata + thống kê (không nén)
└── external/                          <- dữ liệu import từ ngoài vào
    ├── {uuid}_{filename}.csv.gz
    ├── {uuid}_{filename}.json.gz
    └── {uuid}_{filename}.csv          <- file gốc giữ nguyên nếu đã nhỏ
```

> **Lý do flat structure**: Không cần phân cấp `daily/` vì timestamp trong tên file đã đủ để sort/filter. Đơn giản hơn khi list objects từ MinIO.

### Naming Convention

| Source | Pattern | Ví dụ |
|--------|---------|-------|
| Internal | `internal/{YYYYMMDD_HHmmss}_{table}.{ext}.gz` | `internal/20260304_010000_detections.csv.gz` |
| External | `external/{uuid}_{original_name}.{ext}.gz` | `external/a1b2c3d4_traffic_survey.csv.gz` |

---

## 3. CronJob Service: `data-export`

### 3.1 Vị trí & Cấu trúc

```
backend/services/data-export/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── main.py          <- entry point, orchestrate các export tasks
│   ├── query.py         <- query PostgreSQL lấy dữ liệu
│   ├── exporter.py      <- convert và upload lên MinIO (CSV/JSON)
│   └── __init__.py
```

### 3.2 Schedule

- **Thời gian**: 01:00 UTC mỗi ngày (08:00 giờ Việt Nam)
- **K8s CronJob**: `0 1 * * *`
- **Logic**: Export dữ liệu của ngày hôm qua (D-1)

### 3.3 Dữ liệu được xuất

#### File 1: `{date}_detections.csv / .json`

Nguồn: Bảng `camera_detections`

| Cột | Mô tả |
|-----|-------|
| `camera_id` | ID camera |
| `minio_key` | Path ảnh (reference) |
| `total_objects` | Tổng phương tiện |
| `detections` | Chi tiết theo loại (car, motorbike...) |
| `created_at` | Timestamp UTC |

#### File 2: `{date}_forecasts.csv / .json`

Nguồn: Bảng `camera_forecasts`

| Cột | Mô tả |
|-----|-------|
| `camera_id` | ID camera |
| `forecast_for_time` | Thời điểm dự báo |
| `horizon_minutes` | Horizon (5/10/15/30/60) |
| `predicted_value` | Giá trị dự báo |
| `actual_value` | Giá trị thực tế đã sync |
| `error_value` | Sai số |
| `input_value` | Giá trị đầu vào lúc predict |
| `created_at` | Timestamp UTC |

#### File 3: `{date}_summary.json`

Metadata tổng hợp cho cả ngày:

```json
{
  "date": "2026-03-04",
  "generated_at": "2026-03-05T02:05:00Z",
  "detections": {
    "total_records": 12480,
    "cameras": 12,
    "avg_total_objects_per_5min": 45.3
  },
  "forecasts": {
    "total_records": 2880,
    "cameras": 12,
    "horizons": [5, 10, 15, 30, 60],
    "avg_error_by_horizon": {
      "5": 2.1,
      "15": 4.8,
      "30": 7.2,
      "60": 12.5
    }
  },
  "files": [
    "internal/20260304_010000_detections.csv.gz",
    "internal/20260304_010000_detections.json.gz",
    "internal/20260304_010000_forecasts.csv.gz",
    "internal/20260304_010000_forecasts.json.gz"
  ]
}
```

### 3.4 Luồng xử lý (main.py)

```
1. Tính date range: yesterday 00:00:00 UTC → 23:59:59 UTC
2. Query detections từ PostgreSQL
3. Query forecasts từ PostgreSQL
4. Export → CSV bytes (pandas to_csv) → nén gzip
5. Export → JSON bytes (orient='records') → nén gzip
6. Upload tất cả lên MinIO bucket 'data-library' (key: internal/{timestamp}_{table}.{ext}.gz)
7. Tạo và upload summary.json (không nén để dễ đọc trực tiếp)
8. Insert metadata vào bảng data_library_entries
9. Log kết quả
```

> **Nén gzip**: Dùng `gzip.compress()` trong Python — không cần thư viện ngoài, tích hợp sẵn. CSV ~5-10MB/ngày → sau nén còn ~0.5-1MB. Download client tự giải nén; nếu muốn trả file gốc thì API layer decompress trước khi stream.

---

## 4. Database: 2 bảng phân cấp

### 4.1 Bảng `data_library_collections` — Card (nhóm logic)

Mỗi collection tương ưỪng 1 card trên giao diện.

```sql
CREATE TABLE data_library_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(10) NOT NULL CHECK (source IN ('internal', 'external')),
    title       VARCHAR(255) NOT NULL,        -- Tên hiển thị: "Dữ liệu phát hiện & Dự báo"
    description TEXT,                         -- Mô tả tùy chọn
    data_type   VARCHAR(50) NOT NULL,         -- 'detections', 'forecasts', 'custom'...
    tags        TEXT[],
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collections_source ON data_library_collections(source);
CREATE INDEX idx_collections_type   ON data_library_collections(data_type);
```

### 4.2 Bảng `data_library_entries` — Snapshot (nhóm theo ngày)

Mỗi entry = 1 lần export (1 ngày cụ thể) hoặc 1 lần import external, thuộc về 1 collection.

```sql
CREATE TABLE data_library_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID NOT NULL REFERENCES data_library_collections(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,            -- Ngày dữ liệu (VD: 2026-03-04)
    minio_keys      JSONB NOT NULL,
    -- Internal VD: {"detections_csv": "internal/20260304_..._detections.csv.gz",
    --               "detections_json": "internal/20260304_..._detections.json.gz",
    --               "forecasts_csv":   "internal/20260304_..._forecasts.csv.gz",
    --               "forecasts_json":  "internal/20260304_..._forecasts.json.gz",
    --               "summary":         "internal/20260304_..._summary.json"}
    -- External VD: {"csv": "external/{uuid}_{name}.csv.gz"}
    file_sizes      JSONB,                    -- Kích thước từng file (bytes, cùng key với minio_keys)
    record_count    INTEGER,                  -- Tổng số records của snapshot này
    uploaded_by     VARCHAR(100),             -- null nếu internal, email nếu external
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_entries_collection_date ON data_library_entries(collection_id, snapshot_date);
CREATE INDEX idx_entries_date_desc ON data_library_entries(snapshot_date DESC);
```

> **Lý do tách 2 bảng**: Collection là "nhãn" tồn tại mãi; entries thêm dần theo ngày. Frontend list collection (it), click vào mới fetch entries (nhiều).

---

## 5. Backend API (Node.js Server)

### 5.1 Routes

```
-- Collections (cards) --
GET    /api/data-library/collections              <- Danh sách collections (filter/paginate)
GET    /api/data-library/collections/:id          <- Chi tiết collection + danh sách entries
POST   /api/data-library/collections              <- Tạo collection mới (external) [TECHNICIAN]
DELETE /api/data-library/collections/:id          <- Xóa collection + tất cả entries [TECHNICIAN]

-- Entries (snapshots) --
GET    /api/data-library/entries/:id/download     <- Tải toàn bộ snapshot (zip các file) hoặc 1 file
POST   /api/data-library/entries                  <- Import 1 file vào collection [TECHNICIAN]
DELETE /api/data-library/entries/:id              <- Xóa 1 snapshot [TECHNICIAN]
```

### 5.2 Query Params cho GET /api/data-library/collections

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `source` | `internal\|external` | Lọc theo nguồn |
| `type` | string | Lọc theo data_type |
| `page` | number | Pagination |
| `limit` | number | Số items/page (default: 20) |

### 5.3 GET /api/data-library/collections/:id

Trả về collection detail + danh sách entries (sorted by `snapshot_date DESC`):

```jsonc
{
  "id": "...",
  "title": "Dữ liệu phát hiện & Dự báo",
  "source": "internal",
  "data_type": "detections",
  "entries": [
    {
      "id": "...",
      "snapshot_date": "2026-03-04",
      "record_count": 15360,
      "minio_keys": { "detections_csv": "...", "detections_json": "...", ... },
      "file_sizes": { "detections_csv": 512000, ... }
    }
  ]
}
```

### 5.4 POST /api/data-library/entries (Import - Technician Only)

**Request**: `multipart/form-data`

```
collection_id:  string (required) - ID collection hiện có, hoặc "new"
new_title:      string (required nếu collection_id === "new")
data_type:      string (required nếu collection_id === "new")
description:    string (optional)
snapshot_date:  date (required)
file:           File (required) - csv/json
```

**Logic**:
1. Nếu `collection_id === "new"` → tạo `data_library_collections` trước
2. Validate file MIME type (`text/csv`, `application/json`)
3. Nén gzip → upload lên MinIO: `external/{uuid}_{originalname}.gz`
4. Đếm số records
5. INSERT vào `data_library_entries` với `collection_id`, `uploaded_by=req.user.email`
6. Return entry mới + collection info

### 5.5 GET /api/data-library/entries/:id/download

**Query**: `?file=detections_csv` (tải 1 file) hoặc `?file=all` (tải toàn bộ)

**Logic**:
- `?file={key}`: Lấy minio_key tương ứng → decompress gzip → stream về client
- `?file=all`: Lấy tất cả files trong snapshot → đóng gói vào `.zip` (in-memory) → stream

> **Không dùng presigned URL** — server decompress và re-stream để user nhận file gốc.

### 5.6 Về `data_type`: Cố định hay Linh hoạt?

**Phân tích**:

| Approach | Ưu điểm | Nhược điểm |
|----------|---------|------------|
| **Cố định** (enum) | Filter UI gọn, không typo, dễ validate | Cứng nhắc, external data không đủ loại |
| **Linh hoạt** (free text) | Tự do, phù hợp external import | Khó filter, dễ trùng lặp ("Forecast" vs "forecasts") |
| **Hybrid** (suggested + free) | Cân bằng cả 2 | Phức tạp hơn chút |

**Đề xuất: Hybrid**
- Internal data: luôn dùng enum cố định (`detections`, `forecasts`)
- External data import: combobox có gợi ý sẵn nhưng cho phép nhập tự do
- DB: `data_type VARCHAR(50)` — không constraint enum ở DB, validate ở API layer
- Filter UI: hiển thị danh sách `data_type` distinct từ DB (dynamic)

## 6. Frontend UI

### 6.1 Route mới

```
/data-library                <- Trang chính
```

### 6.2 Layout

```
[Data Library]                                    [+ Import] (admin only)

[Filter Bar: Source | Type | Date Range | Search]

[Cards/Table View Toggle]

┌──────────────────────────────────────────────────────────┐
│ 📊 Dữ liệu phát hiện - 04/03/2026           [Internal]  │
│ detections • 12,480 records • CSV, JSON                  │
│ Phát sinh từ camera_detections                           │
│                               [Chi tiết] [Tải xuống ▼]  │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ 📈 Dữ liệu dự báo - 04/03/2026              [Internal]  │
│ forecasts • 2,880 records • CSV, JSON                    │
│ 5 mức horizon: 5/10/15/30/60 phút                       │
│                               [Chi tiết] [Tải xuống ▼]  │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ 📁 Khảo sát giao thông Quận 1 Q1/2026       [External]  │
│ custom • 5,240 records • CSV                             │
│ Import bởi admin@system.vn                               │
│                               [Chi tiết] [Tải xuống ▼]  │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Dialog: Chi tiết Entry

Hiển thị:
- Title, description, source badge
- Data type, date range, tags
- Record count, file sizes theo format
- Danh sách files có thể tải (checkbox chọn format)
- Nút "Tải xuống" với dropdown format

### 6.4 Dialog: Import Dữ liệu (Admin Only)

```
┌──────────────────────────────────┐
│ Import Dữ liệu                 X │
├──────────────────────────────────┤
│ Tiêu đề *                        │
│ [________________________________]│
│                                  │
│ Mô tả                            │
│ [________________________________]│
│                                  │
│ Loại dữ liệu *                   │
│ [Chọn loại ▼]                    │
│  • Phát hiện phương tiện         │
│  • Dự báo lưu lượng             │
│  • Dữ liệu khảo sát             │
│  • Khác                          │
│                                  │
│ Khoảng thời gian dữ liệu         │
│ Từ [__/__/____] Đến [__/__/____] │
│                                  │
│ Nhãn (tags)                      │
│ [________________________] [+]   │
│                                  │
│ File dữ liệu *                   │
│ [Kéo thả hoặc chọn file]        │
│ Hỗ trợ: .csv, .json             │
│                                  │
│        [Hủy]  [Import]           │
└──────────────────────────────────┘
```

### 6.5 Dropdown Tải xuống

```
[Tải xuống ▼]
 ├── CSV (.csv)
 └── JSON (.json)
```

> Excel (.xlsx) không cần thiết — CSV đủ dùng cho Excel, tốn CPU không đáng.

---

## 7. Phân quyền

| Quyền | Guest (anonymous) | Viewer | Technician (admin) |
|-------|-------|------|-------|
| Xem danh sách | ✗ | ✓ | ✓ |
| Xem chi tiết | ✗ | ✓ | ✓ |
| Tải xuống | ✗ | ✓ | ✓ |
| Import | ✗ | ✗ | ✓ |
| Xóa | ✗ | ✗ | ✓ |

**Mapping với hệ thống auth hiện tại** (`auth.middleware.ts`):
- "Technician" = role `technician` trong JWT payload
- Dùng middleware **`requireTechnician`** (đã có sẵn) cho POST/DELETE — **không cần tạo middleware mới**
- Route config trong `index.ts`:
  ```typescript
  // GET routes: tất cả authenticated user
  app.use("/api/data-library", requireAuth, dataLibraryApi);
  // POST/DELETE xử lý requireTechnician bên trong route file
  ```
- `requireTechnician` kiểm tra `payload.role !== 'technician'` → trả 403 nếu chỉ là viewer
- Kết quả: nút “+ Tạo bộ dữ liệu” và nút “Import vào đây” chỉ render khi `auth.role === 'technician'`

---

## 8. K8s CronJob Config (Proposed)

```yaml
# k8s-configs/data-export-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: data-export
spec:
  schedule: "0 1 * * *"    # 01:00 UTC = 08:00 ICT
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: data-export
            image: registry/data-export:v1.0.0
            env:
            - name: DB_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: url
            - name: MINIO_ENDPOINT
              value: "minio-service:9000"
            - name: MINIO_BUCKET
              value: "data-library"
          restartPolicy: OnFailure
      backoffLimit: 2
```

---

## 9. Thứ tự Implement

> **Lưu ý**: Bucket `data-library`, migration bảng `data_library_collections` và `data_library_entries` do bạn tự tạo thủ công trước khi bắt đầu Phase 1.

```
Phase 1 - CronJob Service (data-export):
  [ ] Tạo cấu trúc thư mục backend/services/data-export/
  [ ] Viết query.py (query detections + forecasts từ PostgreSQL)
  [ ] Viết exporter.py (pandas → gzip → upload MinIO)
  [ ] Viết main.py (orchestrate, insert vào data_library_collections nếu chưa có, insert data_library_entries)
  [ ] Viết Dockerfile (multi-stage, copy shared/ nếu cần)
  [ ] Test chạy thủ công với 1 ngày cụ thể

Phase 2 - Backend API (Node.js):
  [ ] Tạo data-library.controller.ts
      - GET /collections (list + filter)
      - GET /collections/:id (detail + entries list)
      - POST /collections (tạo collection external)
      - DELETE /collections/:id
      - GET /entries/:id/download?file={key|all}
      - POST /entries (import file vào collection)
      - DELETE /entries/:id
  [ ] Tạo data-library.route.ts (requireAuth cho GET, requireTechnician cho write)
  [ ] Đăng ký route trong index.ts
  [ ] Implement stream download: MinIO → decompress gzip → stream về client
  [ ] Implement bulk download: nhiều files → đóng gói zip in-memory → stream
  [ ] Implement multipart upload: nhận file → gzip → upload MinIO → insert DB
  [ ] Validation schema (Zod) cho body POST collections + entries

Phase 3 - Frontend:
  [ ] Tạo page /data-library (route + sidebar entry)
  [ ] Component CollectionList: danh sách cards + filter bar (source, type, search)
  [ ] Component CollectionDetailSheet: Sheet/Drawer bên phải, accordion theo ngày
  [ ] Component SnapshotFileRow: 1 hàng file trong accordion (tên, size, nút tải)
  [ ] Component ImportDialog: form 2 nhánh (collection có sẵn vs tạo mới)
  [ ] Service data-library.service.ts: gọi API collections + entries + download
  [ ] Xử lý download: trigger file save từ blob response (cả single file và zip)
```

---

## 10. Quyết định thiết kế

| Vấn đề | Quyết định |
|--------|------------|
| **File retention** | Không xóa — giữ toàn bộ dữ liệu lịch sử |
| **Excel export** | Không cần — CSV đủ dùng, tiết kiệm CPU |
| **Nén file** | Nén toàn bộ bằng **gzip** (`.csv.gz`, `.json.gz`) — đơn giản, không cần thư viện ngoài, giảm ~90% size |
| **API auth** | Dùng `requireTechnician` middleware có sẵn — không cần tạo mới (xem Section 7) |
| **MinIO structure** | Flat: `internal/{timestamp}_{table}.ext.gz` — không phân cấp daily/monthly |
| **CronJob schedule** | `0 1 * * *` — 01:00 UTC (08:00 ICT) |
| **data_type** | Hybrid: internal dùng enum cố định, external dùng combobox có gợi ý (xem Section 5.6) |
| **UI structure** | 2 tầng: Collection (card) → Snapshot theo ngày (accordion) → Files |


