# MinIO Storage Schema

## Bucket Structure

```
{MINIO_BUCKET_NAME}/
├── images/
│   ├── {camera_id}/
│   │   ├── {timestamp}.jpg
│   │   └── YYYYMMDD_HHMMSS.jpg
│   └── 662b86c41afb9c00172dd31c/
│       └── 20260227_143022.jpg
│
└── ml-models/
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
- **Latest**: File với LastModified mới nhất = Production model

## Model Types

| Type | Version | Files | Extension |
|------|---------|-------|-----------|
| yolo | v1 | yolo_{date}_{name}.pt | .pt |
| random-forest | v1 | random-forest_{date}_{horizon}.joblib | .joblib |
| random-forest | v1 | random-forest_{date}_encoder.joblib | .joblib |

## Access Patterns

### Upload (image-process, image-predict)
```python
# Images
minio_key = f"{camera_id}/{timestamp}.jpg"

# Models
minio_key = f"ml-models/{model_type}/{version}/{model_type}_{date}_{name}.ext"
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
