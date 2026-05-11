# MinIO Storage Schema
<!-- Last Updated: 07/03/2026 | 3 buckets total -->

## Bucket Structure

```
images/
├── {camera_id}/
│   ├── {timestamp}.jpg
│   └── YYYYMMDD_HHMMSS.jpg
└── 662b86c41afb9c00172dd31c/
    └── 20260227_143022.jpg
ml-models/
├── yolo/
│   └── v1/
│       ├── yolo_20260227_best.pt
│       └── yolo_20260301_retrain.pt
│
 └── random-forest/
    └── v1/
        ├── random-forest_20260227_5m.joblib
        ├── random-forest_20260227_10m.joblib
        ├── random-forest_20260227_15m.joblib
        ├── random-forest_20260227_30m.joblib
        ├── random-forest_20260227_60m.joblib
        └── random-forest_20260227_encoder.joblib
data-library/                        (Added entry 080, 07/03/26)
└── {data_type}/
    └── {YYYY-MM-DD}.csv.gz
    └── 2026-03-06.csv.gz
```

## Path Patterns

### Camera Images
- **Pattern**: `images/{camera_id}/{YYYYMMDD_HHMMSS}.jpg`
- **Example**: `images/662b86c41afb9c00172dd31c/20260227_143022.jpg`
- **Service**: image-process
- **Purpose**: Lưu ảnh đã detect với annotations

### ML Models
- **Pattern**: `ml-models/{model_type}/{version}/{model_type}_{YYYYMMDD}_{name}.ext`
- **Example**: `ml-models/yolo/v1/yolo_20260227_best.pt`
- **Service**: image-process (YOLO), image-predict (Random Forest)
- **Version**: v1, v2, v3... (major versions)
- **Active Model**: Xác định qua `is_active = TRUE` trong bảng `ml_model_metadata` (DB), không dựa vào LastModified (có thể bị latch khi upload cú)

### Data Library (Added entry 080)
- **Pattern**: `data-library/{data_type}/{YYYY-MM-DD}.csv.gz`
- **Example**: `data-library/detections/2026-03-06.csv.gz`
- **Service**: data-export (CronJob daily 01:00 UTC)
- **Purpose**: Lưu trữ bản snapshot hàng ngày của dữ liệu camera (đỞ nén gzip)
- **Metadata**: Key path lưu trong `data_library_entries.minio_keys` (JSONB) – link tới bản ghi DB

## Model Types

| Type | Version | Files | Extension |
|------|---------|-------|-----------|
| yolo | v1 | yolo_{date}_{name}.pt | .pt |
| random-forest | v1 | random-forest_{date}_{horizon}.joblib | .joblib |
| random-forest | v1 | random-forest_{date}_encoder.joblib | .joblib |

### Active model query:
```sql
SELECT minio_key FROM ml_model_metadata
WHERE model_type = 'random_forest_5m' AND is_active = TRUE
ORDER BY activated_at DESC LIMIT 1;
```

## Access Patterns

### Upload (image-process, image-predict)
```python
# Images (key includes 'images/' prefix – stored as-is in FIWARE minio_key attr)
minio_key = f"images/{camera_id}/{timestamp}.jpg"
presigned_url = f"{MINIO_URL}/{minio_key}"

# Models
minio_key = f"ml-models/{model_type}/{version}/{model_type}_{date}_{name}.ext"

# Data Library snapshots
minio_key = f"data-library/{data_type}/{snapshot_date}.csv.gz"
```

### Download (Dockerfile)
```python
# List files trong version folder
prefix = f"ml-models/{model_type}/{version}/"
# Lấy file mới nhất by LastModified
```

## Retention Policy

- **Images**: Không auto-delete (manage manually hoặc via lifecycle policy)
- **Models**: Keep all versions (no archive folder, no auto-delete)
- **Backup**: MinIO data được backup định kỳ theo storage provider policy
