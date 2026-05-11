# GitHub Actions CI/CD Workflows

## Setup Instructions

### 1. Cấu hình Docker Hub Secrets

Vào **Settings → Secrets and variables → Actions** của GitHub repo, thêm:

- `DOCKER_USERNAME`: Username Docker Hub của bạn
- `DOCKER_PASSWORD`: Access Token từ Docker Hub (Settings → Security → New Access Token)

### 2. Branch Strategy & Versioning

**Branch → Docker Hub Repo Mapping:**
- `develop` → `devmind/dev-repo:<service>-v1.0.0`
- `main` → `devmind/pro-repo:<service>-v1.0.0`

**Auto-versioning:**
- Mỗi service có **2 file VERSION riêng biệt**:
  - `VERSION.dev` - Track version develop branch → dev-repo
  - `VERSION.prod` - Track version main branch → pro-repo
- Push code → version tự động tăng theo semantic versioning:
  - `v1.0.0` → `v1.0.1` ... `v1.0.9` → `v1.1.0` ... `v1.9.9` → `v2.0.0`
- Version bump được commit lại repo bởi `github-actions[bot]`
- **Develop và Production có version history độc lập**

**Examples:**
```bash
# Push vào develop (sử dụng VERSION.dev)
devmind/dev-repo:image-process-v1.0.0    # Lần đầu
devmind/dev-repo:image-process-v1.0.1    # Push lần 2
devmind/dev-repo:image-process-latest

# Merge vào main (sử dụng VERSION.prod)
devmind/pro-repo:image-process-v1.0.0    # Stable release
devmind/pro-repo:image-process-latest

# Sau nhiều lần phát triển:
# Develop có thể ở v1.5.3 trong khi Production vẫn stable ở v1.0.1
```

## Workflows

### 📦 backend-services.yml
Build Python services trong `backend/services/`:
- ✅ Detect thay đổi từng service (tiết kiệm thời gian)
- ✅ Build parallel 6 services
- ✅ Cache layers để build nhanh hơn
- ✅ Chỉ push khi merge vào main

**Services:**
- image-process
- image-predict  
- model-performance
- app-route
- sync-actual
- backup-postgres

### 🖥️ backend-server.yml
Build Node.js API server

### 🎨 frontend.yml
Build React frontend

## How It Works

### 1. Detect Changes
- Workflow chỉ chạy khi có thay đổi trong folder tương ứng
- Phát hiện services nào thay đổi → chỉ build service đó

### 2. Auto Versioning
- Đọc version từ `VERSION.dev` (develop) hoặc `VERSION.prod` (main)
- Increment version theo semantic versioning
- Tags: `<service>-v1.0.0` và `<service>-latest`
- **Develop và Production có version line riêng biệt**

**Development (develop branch → VERSION.dev):**
```
devmind/dev-repo:image-process-v1.0.0
devmind/dev-repo:image-process-latest
devmind/dev-repo:backend-server-v1.0.0
devmind/dev-repo:frontend-v1.0.0
```

**Production (main branch → VERSION.prod):**
```
devmind/pro-repo:image-process-v1.0.0
devmind/pro-repo:image-process-latest
devmind/pro-repo:backend-server-v1.0.0
devmind/pro-repo:frontend-v1.0.0
``
### 4. Commit Version Bump
- Bot tự động commit file VERSION mới
- Commit message: `chore: bump <service> version to v1.0.1`

## Version Management

**Cấu trúc VERSION files:**
```
backend/services/image-process/VERSION    → 1.0.0
backend/services/image-predict/VERSION    → 1.0.0
backend/server/VERSION                    → 1.0.0
web/web-user/VERSION                      → 1.0.0
```

**Semantic Versioning Logic:**
- Patch increment: `1.0.0` → `1.0.1`
- Minor rollover: `1.0.9` → `1.1.0`
- Major rollover: `1.9.9` → `2.0.0`

**Manual version bump** (nếu cần):
```bash
# Bump patch: 1.0.0 → 1.0.1
echo "1.0.1" > backend/services/image-process/VERSION

# Bump minor: 1.0.9 → 1.1.0
echo "1.1.0" > backend/services/image-process/VERSION

# Bump major: 1.9.9 → 2.0.0
echo "2.0.0" > backend/services/image-process/VERSION
```

## Image Naming Convention

```
docker.io/<username>/traffic-<service>:<tag>
```

Ví dụ:
- `devmindtan/traffic-image-process:latest`
- `devmindtan/traffic-backend-server:abc123f`

## Manual Trigger

Có thể trigger manually từ GitHub Actions UI nếu cần rebuild.

## Local Testing

Test workflow locally bằng [act](https://github.com/nektos/act):
```bash
act -j build-image-process
```

## Next Steps

Sau khi setup xong secrets:
1. Push code lên branch `develop` để test
2. Tạo PR vào `main` để review
3. Merge PR → auto build & deploy
