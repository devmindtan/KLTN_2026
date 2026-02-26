# Quick Start Guide - Backup với rclone

## Bước 1: Setup rclone local (5 phút)

```bash
# Cài rclone
sudo pacman -S rclone

# Config rclone
rclone config

# Làm theo wizard:
# n) New remote
# name> gdrive
# Storage> google drive (chọn số tương ứng)
# client_id> [Enter - để trống]
# client_secret> [Enter - để trống]
# scope> 1 (Full access)
# root_folder_id> [Enter - để trống]
# service_account_file> [Enter - để trống]
# Edit advanced config? n
# Auto config? Y
# → Browser sẽ mở, login Google account 2TB
# → Allow access
# Configure this as a Shared Drive? n
# y) Yes this is OK
# q) Quit

# Test connection
rclone lsd gdrive:

# Tạo folder backup
rclone mkdir gdrive:KLTN_Backups
```

## Bước 2: Test backup local

```bash
cd /home/devmindtan/Documents/code/KLTN_2026/backend/services/backup-postgres

# Setup env
export RCLONE_REMOTE="gdrive"
export RCLONE_FOLDER="KLTN_Backups"

# Port-forward PostgreSQL
kubectl port-forward -n database svc/postgres-postgresql 5432:5432 &

# Run backup test
python3 app/backup.py

# Verify upload
rclone ls gdrive:KLTN_Backups
```

## Bước 3: Deploy to K8s

```bash
# Build Docker image
cd /home/devmindtan/Documents/code/KLTN_2026/backend/services
docker build -f backup-postgres/Dockerfile -t devmindtan/dev-repo:backup-postgres-v1.1.0 .
docker push devmindtan/dev-repo:backup-postgres-v1.1.0

# Tạo K8s Secret từ rclone config
kubectl create secret generic rclone-config \
  --from-file=rclone.conf=$HOME/.config/rclone/rclone.conf \
  -n database

# Verify secret
kubectl get secret rclone-config -n database

# Apply CronJob
kubectl apply -f k8s-configs/backup-postgres-cronjob.yaml

# Test manual backup
kubectl create job --from=cronjob/backup-postgres manual-test -n database
kubectl logs -f job/manual-test -n database
```

## Bước 4: Verify trong DB

```bash
kubectl exec -it postgres-postgresql-0 -n database -- psql -U admin -d kltn_db
```

```sql
SELECT 
    id,
    backup_type,
    started_at AT TIME ZONE 'Asia/Ho_Chi_Minh' as started_vn,
    duration_seconds,
    file_size_mb,
    status,
    storage_location
FROM backup_logs
ORDER BY started_at DESC
LIMIT 5;
```

## Troubleshooting

### Lỗi "command not found: rclone"
```bash
# Verify rclone trong container
docker run --rm devmindtan/dev-repo:backup-postgres-v1.1.0 rclone version
```

### Lỗi "Failed to create file system"
```bash
# Check rclone config trong secret
kubectl get secret rclone-config -n database -o jsonpath='{.data.rclone\.conf}' | base64 -d

# Recreate secret nếu cần
kubectl delete secret rclone-config -n database
kubectl create secret generic rclone-config \
  --from-file=rclone.conf=$HOME/.config/rclone/rclone.conf \
  -n database
```

### Test rclone trong container
```bash
kubectl run rclone-test --rm -it --image=devmindtan/dev-repo:backup-postgres-v1.1.0 \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "rclone-test",
      "image": "devmindtan/dev-repo:backup-postgres-v1.1.0",
      "command": ["/bin/sh"],
      "volumeMounts": [{
        "name": "rclone-config",
        "mountPath": "/root/.config/rclone"
      }]
    }],
    "volumes": [{
      "name": "rclone-config",
      "secret": {"secretName": "rclone-config"}
    }]
  }
}' \
  -n database -- sh

# Trong container:
rclone lsd gdrive:
rclone ls gdrive:KLTN_Backups
exit
```
