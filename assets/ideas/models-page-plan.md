# Kế hoạch Triển khai: Trang Quản lý ML Models (`models.tsx`)

> **Ngày tạo:** 28/02/2026  
> **Phạm vi:** `web/web-user/src/pages/models.tsx` (đổi tên từ `projects.tsx`)  
> **Liên quan:** Backend Server (`/api/models`), image-predict Deployment, image-predict CronJob (Training)

---

## 🏗️ Kiến trúc Tổng quan

```
Frontend (models.tsx)
    │
    ▼
Backend Server (Node.js)
    ├── GET /api/models              → PostgreSQL: ml_model_metadata
    ├── GET /api/models/:id          → PostgreSQL: ml_model_metadata + MinIO metadata
    ├── POST /api/models/train       → Kubernetes API: Create Job từ image-predict
    ├── GET /api/models/train/status → Kubernetes API: Job status + logs
    └── POST /api/models/:id/activate→ PostgreSQL: is_active=TRUE + restart Deployment
                                                        ↓
                                            image-predict Deployment
                                            (Rolling restart → download model mới từ MinIO)
```

---

## 📦 Dữ liệu Nguồn

### Bảng `ml_model_metadata` (PostgreSQL)
| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `model_type` | `yolo`, `random_forest_5m`, `random_forest_10m`, `random_forest_15m`, `random_forest_30m`, `random_forest_60m` |
| `model_version` | `v1_initial`, `20260227_143022`, ... |
| `minio_key` | Path trên MinIO |
| `base_model` | `yolov11m`, `RandomForestRegressor`, ... |
| `training_samples` | Số lượng samples |
| `training_duration_hours` | Thời gian train |
| `metrics` | `{"mae": 2.5, "rmse": 3.2, "r2": 0.85}` |
| `is_active` | Model đang được sử dụng |
| `created_at` | Timestamp |

---

## 🎯 3 Tính năng Chính

---

### 1. Xem Chi Tiết (`ModelDetailDrawer`)

**Trigger**: Nút "Xem chi tiết" → mở Drawer/Sheet từ phải

**Dữ liệu hiển thị** (query từ DB):
```
┌─────────────────────────────────────────────────┐
│  Random Forest - 5 phút                [Đang dùng]
│  ─────────────────────────────────────────────  │
│  Phiên bản:        20260227_143022              │
│  Base model:       RandomForestRegressor        │
│  Ngày tạo:         27/02/2026 14:30             │
│                                                 │
│  📊 Chỉ số Hiệu năng                           │
│  ┌──────┬──────┬──────┬──────────┐             │
│  │ MAE  │ RMSE │  R²  │ Samples  │             │
│  │ 2.5  │ 3.2  │ 0.85 │  12,450  │             │
│  └──────┴──────┴──────┴──────────┘             │
│                                                 │
│  ⏱ Thời gian huấn luyện: 2.5 giờ              │
│  📦 MinIO Path: ml-models/rf-5m/v2/...         │
│                                                 │
│  📋 Lịch sử Phiên bản (tất cả versions)        │
│  v2 ← hiện tại | v1 (21/02) | v0 (16/02)       │
└─────────────────────────────────────────────────┘
```

**API cần:**
- `GET /api/models` → list tất cả models (group by `model_type`, chỉ active model/type)
- `GET /api/models/:id/history` → lịch sử versions của cùng loại

---

### 2. Huấn Luyện Phiên Bản Mới (`TrainNewVersionModal`)

**Trigger**: Nút **"Huấn luyện phiên bản mới"** trên header (global) hoặc từng card → mở Modal chọn loại mô hình

> ⚠️ **Quan trọng**: Đây là tạo NEW version — model đang active **không bị ảnh hưởng** cho đến khi user chủ động kích hoạt version mới.

**UI Flow:**
```
Bước 1 — Chọn loại mô hình:
┌─────────────────────────────────────────────────┐
│  Huấn luyện Phiên Bản Mới                       │
│  ─────────────────────────────────────────────  │
│  Chọn loại mô hình:                             │
│  ○ Random Forest - Dự báo 5 phút               │
│  ● Random Forest - Dự báo 10 phút  ← đang chọn │
│  ○ Random Forest - Dự báo 15 phút               │
│  ○ Random Forest - Dự báo 30 phút               │
│  ○ Random Forest - Dự báo 60 phút               │
│                                                 │
│  Phiên bản hiện tại: 20260227_143022 (MAE: 3.1) │
│  → Phiên bản mới sẽ KHÔNG tự động thay thế     │
│                                                 │
│  [Tiếp theo →]                                  │
└─────────────────────────────────────────────────┘

Bước 2 — Chọn dữ liệu & bắt đầu train:
┌─────────────────────────────────────────────────┐
│  Huấn luyện: RF Dự báo 10 phút                 │
│  ─────────────────────────────────────────────  │
│  📅 Phạm vi dữ liệu huấn luyện                 │
│  Từ ngày: [01/01/2026]   Đến ngày: [28/02/2026] │
│                                                 │
│  [  Bắt đầu Huấn luyện  ]                      │
└─────────────────────────────────────────────────┘

Bước 3 — Theo dõi tiến trình (live via WebSocket):
┌─────────────────────────────────────────────────┐
│  ⏳ Đang huấn luyện phiên bản mới...           │
│  [████████░░░░░░░] 45% - Query dữ liệu         │
│                                                 │
│  Kết thúc: Phiên bản mới sẽ xuất hiện trong    │
│  "Lịch sử phiên bản" để bạn xem xét và kích hoạt│
└─────────────────────────────────────────────────┘
```

**Luồng phía Backend:**
1. `POST /api/models/train` (body: `{model_type, start_date, end_date}`)
2. Server tạo Kubernetes Job mới:
   - Override command: `python train_single.py --model_type random_forest_10m --start_date ... --end_date ...`
3. `train_single.py` chạy, **KHÔNG set `is_active=TRUE`** — chỉ insert record mới vào `ml_model_metadata` với `is_active=FALSE`
4. FIWARE entity `TrainingJob` được update theo từng stage → WebSocket push
5. Khi hoàn thành → Frontend refetch danh sách models → version mới xuất hiện trong history drawer với badge **"Chưa kích hoạt"**

**Training Status Stages:**
- `pending` → Job được tạo, chờ Pod start
- `running` → Pod đang chạy (update FIWARE theo stage)
- `succeeded` → Version mới đã lưu, **chờ user kích hoạt**
- `failed` → Hiển thị error, model cũ vẫn active bình thường

---

### 3. Sử Dụng Mô Hình (`ActivateModelDialog`)

**Trigger**: Dropdown "Chọn phiên bản" → nút "Kích hoạt"

**UI:**
```
┌─────────────────────────────────────────────────┐
│  Kích hoạt Mô hình                              │
│  ─────────────────────────────────────────────  │
│  Loại:    Random Forest - 5 phút               │
│  Phiên bản đang dùng: 20260221_...             │
│  Phiên bản mới:       20260227_143022 ← chọn   │
│                                                 │
│  ⚠️ Tiến trình dự báo sẽ tải lại model mới.   │
│  Dự báo sẽ tạm dừng ~2-3 phút.                │
│                                                 │
│  [Hủy]              [Xác nhận Kích hoạt]        │
└─────────────────────────────────────────────────┘
```

**Luồng phía Backend:**
1. `POST /api/models/:id/activate`
2. Server → PostgreSQL: `UPDATE ml_model_metadata SET is_active=FALSE WHERE model_type=X` rồi `SET is_active=TRUE WHERE id=Y`
3. Server → Kubernetes API: `kubectl rollout restart deployment/image-predict -n backend`
4. image-predict Pod restart → `download_model.py` chạy → tải model `is_active=TRUE` từ MinIO
5. Server trả về `{status: "activating", estimated_restart_seconds: 120}`

**Trạng thái sau kích hoạt:**
- Frontend poll deployment rollout status hoặc đơn giản là show thông báo "Đang áp dụng..."
- Optional: thêm badge "Đang restart" vào card của model type đó

---

## 🃏 Layout Giao Diện Chính

```
┌─────────────────────────────────────────────────────────────────┐
│ Mô Hình Machine Learning              [Huấn luyện mô hình mới]  │
│ Quản lý và theo dõi các mô hình dự đoán                         │
├──────────────────────┬──────────────────────┬───────────────────┤
│ 🌲 Random Forest     │ 🌲 Random Forest     │ 🌲 Random Forest  │
│    Dự báo 5 phút     │    Dự báo 10 phút    │   Dự báo 15 phút  │
│ [Đang dùng]          │ [Đang dùng]          │ [Đang dùng]       │
│ MAE: 2.5  R²: 0.85   │ MAE: 3.1  R²: 0.82  │ MAE: 3.8 R²:0.79  │
│ Cập nhật: 27/02      │ Cập nhật: 27/02      │ Cập nhật: 27/02   │
│                      │                      │                   │
│ [Xem chi tiết] [▼]   │ [Xem chi tiết] [▼]   │ [Xem chi tiết][▼] │
│ [Huấn luyện lại]     │ [Huấn luyện lại]     │ [Huấn luyện lại]  │
├──────────────────────┼──────────────────────┼───────────────────┤
│ 🌲 Random Forest     │ 🌲 Random Forest     │ 👁 YOLO           │
│    Dự báo 30 phút    │   Dự báo 60 phút     │   Phát hiện xe    │
│ ...                  │ ...                  │ ...               │
└──────────────────────┴──────────────────────┴───────────────────┘
```

**Nút "Huấn luyện phiên bản mới"** (header): mở modal chọn loại → chọn ngày → train  
**Dropdown [▼] trên mỗi card:** xem & chọn version cũ/mới để kích hoạt  
**Chú ý**: Card hiển thị luôn là version **đang active**. Version mới train xong chỉ xuất hiện trong history (badge "Chưa kích hoạt") cho đến khi user kích hoạt thủ công

---

## 🔌 Backend API Endpoints Cần Tạo

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/api/models` | Danh sách tất cả active models (1/type) |
| `GET` | `/api/models/all` | Tất cả versions (để chọn kích hoạt) |
| `GET` | `/api/models/:id` | Chi tiết 1 model |
| `GET` | `/api/models/:id/history` | Lịch sử versions cùng loại |
| `POST` | `/api/models/:id/activate` | Kích hoạt model + restart deployment |
| `POST` | `/api/models/train` | Tạo training job |
| `GET` | `/api/models/train/status` | Trạng thái job đang chạy |

---

## 🔧 Thay Đổi Backend Python Cần Thiết

### `image-predict/app/train.py`
- Thêm `argparse` để nhận `--model_type`, `--start_date`, `--end_date`
- Truyền date range vào `query_from_db_total()` để filter data

### `image-predict/app/db_queries.py`
- Cập nhật `query_from_db_total()` nhận `start_date`, `end_date` optional params

---

## 🔐 Kubernetes API Access

Backend Node.js cần quyền gọi Kubernetes API để:
1. Tạo Job từ CronJob spec (training)
2. Restart Deployment (activate model)

**Phương án:**
- Dùng `@kubernetes/client-node` npm package
- Server Pod cần `ServiceAccount` với `Role`: `create jobs`, `get/patch deployments`
- Thêm RBAC config vào k8s-configs/ (khi được phép)

---

## 📋 Thứ Tự Triển Khai

```
Phase 1: Data & Display (không cần k8s changes)
  ├── [BE] Tạo model.controller.ts + routes
  ├── [FE] Đổi tên projects.tsx → models.tsx + cập nhật sidebar nav
  ├── [FE] Render cards từ API thay vì mock data
  └── [FE] ModelDetailDrawer component

Phase 2: Activate Model (cần k8s RBAC)
  ├── [BE] POST /api/models/:id/activate (DB update + k8s restart)
  └── [FE] ActivateModelDialog component

Phase 3: Training (cần k8s RBAC + train.py changes)
  ├── [PY] Thêm argparse vào train.py + db_queries.py date filter
  ├── [BE] POST /api/models/train + GET /api/models/train/status
  └── [FE] TrainModelModal + polling progress
```

---

---

## ✅ Phân Tích Tinh Chỉnh (Sau khi xác nhận)

### Quyết định Kiến trúc

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | k8s RBAC | Tạo file **mới** (`k8s-configs/server-rbac.yaml`) tách biệt, không chỉnh file cũ. Manual delete khi sẵn sàng merge |
| 2 | Training scope | Giữ nguyên `train.py` (train cả 5). Tạo thêm **`train_single.py`** (entry point mới) cho tính năng train per-horizon từ UI |
| 3 | YOLO | **Ngoài scope** — card YOLO chỉ hiện "Xem chi tiết", không có nút "Huấn luyện lại" |
| 4 | Training Pod | Tạo `train_single.py` như script độc lập mới. CronJob hiện tại **không bị ảnh hưởng** vì vẫn chạy `train.py` cũ |
| 5 | Progress tracking | Dùng **FIWARE WebSocket** — tạo entity `TrainingJob` mới với `status`, `progress`, `logs` |
| 6 | Môi trường test | Test **local** trước, tránh ảnh hưởng production. Không build image cho đến khi local pass |

---

### Phân Tích Code Hiện Tại (`train.py`)

**Vấn đề:** `train.py` hiện là script thẳng (hardcode ở cuối file):
```python
# Dòng 270-284 trong train.py
data = query_from_db_total("2026-02-13", "2026-02-26")  # ← hardcoded dates!
models = train_camera_model(data)
if models:
    upload_models_to_minio(models, training_start_time, total_samples)
```

**Giải pháp**: Tạo `train_single.py` **mới** — wrapper dùng lại hàm từ `train.py`:
```
image-predict/app/
  ├── train.py           ← KHÔNG CHẠM (giữ nguyên, dev dùng thủ công)
  ├── train_single.py    ← MỚI: CLI entry point cho tính năng mới
  └── db_queries.py      ← KHÔNG CHẠM (query date range đã có sẵn)
```

`train_single.py` nhận args:
```
python train_single.py --model_type random_forest_5m \
                       --start_date 2026-01-01 \
                       --end_date 2026-02-28
```

> **Note**: `query_from_db_total(start_date, end_date)` đã nhận params — không cần sửa `db_queries.py`

---

### FIWARE: Entity `TrainingJob` Mới

Entity để track trạng thái training theo thời gian thực qua WebSocket:

```json
{
  "id": "urn:ngsi-ld:TrainingJob:latest",
  "type": "TrainingJob",
  "job_id": "train_rf_5m_20260228_143022",
  "model_type": "random_forest_5m",
  "status": "running",        // pending → running → succeeded / failed
  "progress_pct": 65,         // 0-100 (ước tính dựa trên stage)
  "current_stage": "Đang huấn luyện horizon 5m...",
  "start_date": "2026-01-01",
  "end_date": "2026-02-28",
  "total_samples": 12450,
  "started_at": "2026-02-28T07:30:01Z",
  "finished_at": null,
  "error_message": null,
  "result_metrics": null      // Điền sau khi succeeded: {"mae": 2.5, "r2": 0.85}
}
```

**Stages → Progress mapping:**
```
10%  Kết nối database
20%  Query dữ liệu lịch sử (bước chậm nhất)
40%  Tiền xử lý features
60%  Huấn luyện model
80%  Đánh giá & lưu model
90%  Upload lên MinIO
100% Hoàn thành
```

`train_single.py` tự update entity này trong quá trình chạy.  
SocketContext subscribe event `TRAINING_JOB_UPDATED` → Frontend cập nhật UI live.

---

### Luồng Hoàn Chỉnh cho Tính Năng Training

```
[User nhấn "Huấn luyện lại" → chọn ngày → xác nhận]
         │
         ▼
POST /api/models/train
{model_type: "random_forest_5m", start_date: "...", end_date: "..."}
         │
         ▼
Server tạo Kubernetes Job mới:
  - Tạo từ CronJob spec image-predict (hoặc Deployment spec)
  - Override command: python train_single.py --model_type rf_5m --start ... --end ...
  - Job name: train-rf5m-{timestamp}
         │
         ▼
train_single.py chạy trong Pod:
  1. Update FIWARE entity: status=running, progress=10%
  2. Query dữ liệu → progress=20%
  3. Train model → progress=60%
  4. Upload MinIO + save metadata (is_active=FALSE) → progress=90%
  5. Update FIWARE entity: status=succeeded, result_metrics={...}, progress=100%
         │
         ▼
Backend WebSocket → TRAINING_JOB_UPDATED event
         │
         ▼
Frontend TrainModelModal: Progress bar update live
Khi succeeded → refetch models → Modal hiển thị:
  "✅ Phiên bản mới đã sẵn sàng: 20260228_143022
   MAE: 2.8 | R²: 0.87
   👉 Mở chi tiết để kích hoạt nếu kết quả tốt hơn"
         │
         ▼
⚠️ Model cũ VẪN ĐANG CHẠY — user tự quyết định có kích hoạt không
```

---

### Xử Lý Isolation (Tránh Ảnh Hưởng Production)

| Rủi ro | Giải pháp |
|--------|-----------|
| CronJob image-predict bị ảnh hưởng | `train_single.py` là file mới, CronJob vẫn chạy `predict_realtime.py` qua Deployment riêng |
| MinIO models bị ghi đè | `train_single.py` dùng timestamp trong filename → không ghi đè file cũ. **`is_active=FALSE` khi train xong** — user phải kích hoạt thủ công qua UI |
| DB `ml_model_metadata` conflict | `UNIQUE(model_type, model_version)` — version dùng timestamp nên không trùng |
| Training Pod chiếm tài nguyên node | Job có `resources.limits` riêng, CronJob/Deployment vẫn chạy độc lập |
| Test local | Chạy `python train_single.py` trực tiếp, không cần k8s — test end-to-end trước khi build image |

---

### Thứ Tự Triển Khai Cập Nhật

```
Phase 1: Data & Display (không cần k8s, an toàn nhất)
  ├── [BE] model.controller.ts: GET /api/models, GET /api/models/:id, GET /api/models/:id/history
  ├── [BE] Đăng ký routes
  ├── [FE] models.tsx: đổi tên, render từ API
  └── [FE] ModelDetailDrawer component (Sheet + metrics table + version history)

Phase 2: Activate Model
  ├── [BE] POST /api/models/:id/activate (chỉ DB update trước — không k8s)
  │         └── Restart Deployment thêm sau khi có RBAC
  ├── [FE] ActivateModelDialog component
  └── [k8s] server-rbac.yaml (file MỚI, tách biệt)

Phase 3: Training via UI (test local trước)
  ├── [PY] train_single.py (file MỚI — không sửa train.py)
  ├── [PY] Thêm FIWARE update calls trong train_single.py
  ├── [BE] POST /api/models/train + k8s Job creation
  ├── [FE] SocketContext: subscribe TRAINING_JOB_UPDATED event
  └── [FE] TrainModelModal + live progress bar

Phase 4: Build & Deploy (sau khi local test pass)
  └── Build image mới (v1.3.x) với train_single.py
```

---

## 🔔 FIWARE Subscription: TrainingJob

Subscription này được đăng ký **một lần** trên Orion, cho phép app-route nhận webhook mỗi khi `TrainingJob` entity được update → emit socket `TRAINING_JOB_UPDATED` tới Frontend.

### Lệnh đăng ký

```bash
curl -iX POST 'http://10.43.45.12:1026/v2/subscriptions' \
  -H 'Content-Type: application/json' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /' \
  -d '{
    "description": "Notify app-route on TrainingJob entity updates",
    "subject": {
      "entities": [
        {
          "idPattern": "urn:ngsi-ld:TrainingJob:.*",
          "type": "TrainingJob"
        }
      ],
      "condition": {
        "attrs": ["status", "progress_pct", "current_stage", "result_metrics", "error_message"]
      }
    },
    "notification": {
      "http": {
        "url": "http://10.43.50.50/webhook"
      },
      "attrs": [
        "job_id",
        "model_type",
        "status",
        "progress_pct",
        "current_stage",
        "start_date",
        "end_date",
        "total_samples",
        "started_at",
        "finished_at",
        "error_message",
        "result_metrics"
      ],
      "attrsFormat": "normalized"
    },
    "throttling": 1
  }'
```

**Giải thích các field:**
| Field | Giá trị | Lý do |
|-------|---------|-------|
| `fiware-service` | `traffic_monitor` | Namespace chung toàn project |
| `fiware-servicepath` | `/` | Root path |
| `idPattern` | `urn:ngsi-ld:TrainingJob:.*` | Match mọi TrainingJob entity (hiện chỉ có `latest`) |
| `condition.attrs` | 5 attrs | Chỉ trigger webhook khi các attr này thay đổi |
| `notification.url` | `http://10.43.50.50/webhook` | ClusterIP của `app-route-service` trong namespace `backend` |
| `throttling` | `1` | Tối thiểu 1 giây giữa 2 notification (tránh flood) |

### Kiểm tra subscriptions hiện có

```bash
# Xem tất cả subscriptions
curl -s 'http://10.43.45.12:1026/v2/subscriptions' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /' | python3 -m json.tool

# Xóa subscription theo ID nếu cần đăng ký lại
curl -iX DELETE 'http://10.43.45.12:1026/v2/subscriptions/{subscription_id}' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

### Kiểm tra entity TrainingJob sau khi job chạy

```bash
curl -s 'http://10.43.45.12:1026/v2/entities/urn:ngsi-ld:TrainingJob:latest' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /' | python3 -m json.tool
```

---

## 🧪 Kịch Bản Test Hậu Phase 3

> **Mục tiêu**: Xác nhận toàn bộ luồng Phase 1–3 hoạt động đúng trước khi vào Phase 4.  
> **Môi trường**: Cluster k8s (local test trên cluster thật), image-predict v1.3.0 đã build.

---

### TC-01: Kiểm tra K8s RBAC (Server ServiceAccount)

**Mục tiêu**: Xác nhận `server-sa` có đủ quyền tạo Job và patch Deployment.

```bash
# Kiểm tra ServiceAccount tồn tại
kubectl get serviceaccount server-sa -n backend

# Kiểm tra Role và RoleBinding
kubectl get role server-role -n backend
kubectl get rolebinding server-rolebinding -n backend

# Kiểm tra quyền tạo Job
kubectl auth can-i create jobs -n backend \
  --as=system:serviceaccount:backend:server-sa

# Kiểm tra quyền patch Deployment
kubectl auth can-i patch deployments -n backend \
  --as=system:serviceaccount:backend:server-sa
```

**Kết quả kỳ vọng**: Mỗi lệnh `auth can-i` trả về `yes`

---

### TC-02: Xem Danh Sách Mô Hình (Phase 1)

**Bước:**
1. Mở trình duyệt → `/user/models`
2. Kiểm tra 6 card hiển thị (5 RF + 1 YOLO)
3. Mỗi card RF hiển thị: badge `[Đang dùng]`, MAE, R², ngày cập nhật

**API test:**
```bash
curl -s http://localhost:3000/api/models | python3 -m json.tool
# Kết quả: array 6 objects, mỗi object có is_active=true
```

**Kết quả kỳ vọng**: 6 cards render đúng, không có lỗi console

---

### TC-03: Xem Chi Tiết Model (ModelDetailSheet)

**Bước:**
1. Click nút "Xem chi tiết" trên card RF 5 phút
2. Sheet trượt ra bên phải
3. Kiểm tra hiển thị: MAE, RMSE, R², samples, thời gian train, MinIO path
4. Mở tab "Lịch sử phiên bản" — xem danh sách versions

**API test:**
```bash
# Chi tiết 1 model
curl -s http://localhost:3000/api/models/{id} | python3 -m json.tool

# Lịch sử versions
curl -s http://localhost:3000/api/models/{id}/history | python3 -m json.tool
```

**Kết quả kỳ vọng**: Sheet hiển thị đúng thông tin, history table có ít nhất 1 row (version active hiện tại)

---

### TC-04: Kích Hoạt Model (ActivateModelDialog — Happy Path)

**Precondition**: Có ít nhất 2 versions của cùng 1 `model_type` trong DB (`is_active` khác nhau)

**Bước:**
1. Mở ModelDetailSheet của RF 5 phút
2. Trong tab Lịch sử, chọn version cũ hơn (hoặc version mới vừa train)
3. Click "Kích hoạt"
4. Dialog xuất hiện → so sánh MAE/R² giữa 2 versions
5. Click "Xác nhận Kích hoạt"
6. Chờ banner success xuất hiện

**Verify sau kích hoạt:**
```bash
# DB: kiểm tra is_active đổi đúng
psql -c "SELECT id, model_version, is_active, model_type FROM ml_model_metadata WHERE model_type='random_forest_5m' ORDER BY created_at DESC LIMIT 5;"

# k8s: kiểm tra deployment đang rollout
kubectl rollout status deployment/image-predict -n backend

# image-predict log: tải model mới từ MinIO
kubectl logs -f deployment/image-predict -n backend | grep -i "download\|model\|active"
```

**Kết quả kỳ vọng**: Chỉ 1 record `is_active=TRUE` cho `model_type=random_forest_5m`, Pod restart thành công, log hiển thị download model mới

---

### TC-05: Kích Hoạt Model — Model Đang Active

**Bước:**
1. Trong ModelDetailSheet, thử click "Kích hoạt" trên version đang `is_active=TRUE`

**Kết quả kỳ vọng**: Nút "Kích hoạt" bị disabled hoặc hiện badge "Đang dùng" — không thể tự kích hoạt bản đang chạy

---

### TC-06: Huấn Luyện Phiên Bản Mới — Happy Path (End-to-End)

**Bước:**
1. Click "Huấn luyện phiên bản mới" ở header
2. Bước 1: Chọn "Random Forest - Dự báo 5 phút" → Next
3. Bước 2: Chọn start/end date hợp lệ (ví dụ: 01/01/2026 → 28/02/2026) → "Bắt đầu Huấn luyện"
4. Bước 3: Modal chuyển sang progress view → Quan sát progress bar cập nhật live

**Verify theo stages:**
```bash
# Theo dõi k8s Job được tạo
kubectl get jobs -n backend -w

# Xem log Pod training
kubectl logs -f job/{job-name} -n backend

# Kiểm tra FIWARE entity cập nhật theo thời gian thực
watch -n 2 'curl -s http://10.43.45.12:1026/v2/entities/urn:ngsi-ld:TrainingJob:latest \
  -H "fiware-service: traffic_monitor" \
  -H "fiware-servicepath: /" | python3 -m json.tool'
```

**Kết quả kỳ vọng:**
- Progress bar cập nhật 10% → 30% → 55% → 70% → 85% → 95% → 100%
- `current_stage` text đổi theo từng bước
- Sau 100%: Modal hiển thị MAE/R² mới, nút "Đóng" enable
- DB có record mới với `is_active=FALSE`

---

### TC-07: Huấn Luyện — Dữ Liệu Không Đủ

**Bước:**
1. Chọn date range quá ngắn (ví dụ: chỉ 1 ngày — 01/02/2026 → 01/02/2026)
2. Click "Bắt đầu Huấn luyện"

**Kết quả kỳ vọng**: 
- `train_single.py` phát hiện `total_samples < 100` → FIWARE update `status=failed`, `error_message="Không đủ dữ liệu"`
- Progress Modal hiển thị trạng thái lỗi (màu đỏ), message rõ ràng
- k8s Job kết thúc với `status: Failed`

---

### TC-08: Huấn Luyện — Date Range Không Hợp Lệ

**Bước:**
1. Step 2: nhập `start_date > end_date` (ví dụ: end = 01/01/2026, start = 28/02/2026)
2. Click "Bắt đầu Huấn luyện"

**Kết quả kỳ vọng**: Frontend validation báo lỗi ngay, không gọi API — hoặc backend trả `400 Bad Request`

---

### TC-09: Huấn Luyện — Lỗi k8s API

**Bước:**
1. Simulate bằng cách tạm thời set `serviceAccountName: nonexistent-sa` trong server.yaml → redeploy
2. Bấm "Bắt đầu Huấn luyện"

**Kết quả kỳ vọng**: API trả lỗi 500 hoặc 503, Frontend hiển thị thông báo lỗi, không treo modal

> **Restore**: Sau test, revert về `serviceAccountName: server-sa`

---

### TC-10: WebSocket Realtime — FIWARE → Socket → Frontend

**Bước:**
1. Đảm bảo subscription TC-01 (FIWARE → app-route) đã được đăng ký
2. Mở DevTools → Network tab → filter WS
3. Chạy training job
4. Quan sát events `TRAINING_JOB_UPDATED` trong WS stream

**Test thủ công gửi FIWARE update:**
```bash
# Giả lập stage "đang train" ở 55%
curl -iX POST 'http://10.43.45.12:1026/v2/entities?options=upsert' \
  -H 'Content-Type: application/json' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /' \
  -d '{
    "id": "urn:ngsi-ld:TrainingJob:latest",
    "type": "TrainingJob",
    "job_id": {"type": "Text", "value": "test-manual-001"},
    "model_type": {"type": "Text", "value": "random_forest_5m"},
    "status": {"type": "Text", "value": "running"},
    "progress_pct": {"type": "Number", "value": 55},
    "current_stage": {"type": "Text", "value": "Huấn luyện model..."},
    "error_message": {"type": "Text", "value": null},
    "result_metrics": {"type": "StructuredValue", "value": null}
  }'
```

**Kết quả kỳ vọng**: Frontend (nếu modal đang mở) cập nhật progress bar lên 55% ngay lập tức, không cần refresh

---

### TC-11: Kích Hoạt Phiên Bản Mới Sau Khi Train

**Precondition**: TC-06 đã hoàn thành (có version mới `is_active=FALSE`)

**Bước:**
1. Đóng TrainNewVersionModal
2. Mở ModelDetailSheet của RF 5 phút
3. Tab Lịch sử: xác nhận version mới hiện badge "Chưa kích hoạt"
4. Chọn version mới → Click "Kích hoạt"
5. So sánh metrics → Xác nhận

**Kết quả kỳ vọng**: Version mới trở thành active, Deployment restart, card ngoài grid cập nhật MAE/R² mới

---

### TC-12: K8s Job Cleanup (TTL = 3600s)

**Mục tiêu**: Xác nhận Job tự cleanup sau 1 giờ

**Bước:**
1. Chạy training job → để hoàn thành
2. Ghi lại job name
3. Chờ > 1 giờ (hoặc edit TTL xuống 60s để test nhanh)
4. Kiểm tra:
```bash
kubectl get job {job-name} -n backend
# Kết quả kỳ vọng: "Error from server (NotFound)" — job đã bị xóa tự động
```

---

### TC-13: Modal Khi Job Đang Chạy

**Bước:**
1. Trong khi job đang chạy (progress ~50%), nhấn "Xem chi tiết" một card khác
2. Mở TrainNewVersionModal một lần nữa (nếu UI cho phép)

**Kết quả kỳ vọng**: 
- Nút "Huấn luyện phiên bản mới" bị disabled khi job đang chạy (dựa theo `trainingJob.status === 'running'` trong SocketContext)
- Hoặc nếu không disable: Modal vẫn hoạt động, progress tiếp tục cập nhật từ job đang chạy

---

### TC-14: Refresh Trang Giữa Chừng Training

**Bước:**
1. Bắt đầu training → progress đang ở ~40%
2. Nhấn F5 (refresh trang)
3. Quan sát trạng thái sau refresh

**Kết quả kỳ vọng**:
- Trang load lại bình thường, modal / progress bar không còn hiển thị (đây là acceptable)
- Job vẫn tiếp tục chạy trong k8s (không bị cancel)
- FIWARE entity vẫn cập nhật (có thể kiểm tra bằng lệnh curl TC-10)

```bash
# Kiểm tra job vẫn đang chạy sau khi user refresh
kubectl get jobs -n backend
kubectl get pods -n backend | grep train
```

---

### TC-15: Card YOLO — Không Có Nút Train

**Bước:**
1. Quan sát card "YOLO - Phát hiện xe" trong grid
2. Kiểm tra không có nút "Huấn luyện mới" / "Huấn luyện phiên bản mới" áp dụng cho YOLO

**Kết quả kỳ vọng**: Card YOLO chỉ có nút "Xem chi tiết", không có nút train (vì YOLO ngoài scope)

---

### TC-16: API Endpoint Smoke Tests

```bash
BASE="http://localhost:3000/api"

# GET /api/models — danh sách active models
curl -s "$BASE/models" | python3 -m json.tool

# GET /api/models/:id — chi tiết 1 model
MODEL_ID=$(curl -s "$BASE/models" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s "$BASE/models/$MODEL_ID" | python3 -m json.tool

# GET /api/models/:id/history — lịch sử versions
curl -s "$BASE/models/$MODEL_ID/history" | python3 -m json.tool

# POST /api/models/train — trigger training
curl -iX POST "$BASE/models/train" \
  -H "Content-Type: application/json" \
  -d '{"model_type":"random_forest_5m","start_date":"2026-01-01","end_date":"2026-02-28"}'

# POST /api/models/:id/activate — kích hoạt
curl -iX POST "$BASE/models/$MODEL_ID/activate"
```

**Kết quả kỳ vọng**: Tất cả 2xx responses, không có 500 errors

---

### Checklist Tổng Kết Hậu Phase 3

| # | Kịch bản | Kết quả | Ghi chú |
|---|----------|---------|---------|
| TC-01 | RBAC permissions | ok | kubectl auth can-i = yes |
| TC-02 | Model list render | ok | 6 cards OK |
| TC-03 | ModelDetailSheet | ok | metrics + history |
| TC-04 | Activate happy path | ⬜ | DB + k8s restart |
| TC-05 | Activate current version | ⬜ | disabled hoặc warning |
| TC-06 | Training end-to-end | ok |  |
| TC-07 | Training — ít dữ liệu | ⬜ | failed gracefully |
| TC-08 | Training — invalid dates | ⬜ | validation error |
| TC-09 | Training — k8s error | ⬜ | 500 + error UI |
| TC-10 | WebSocket realtime | ok | progress live update |
| TC-11 | Activate new version | ⬜ | sau train xong |
| TC-12 | Job TTL cleanup | ⬜ | auto delete sau 1h |
| TC-13 | Concurrent job guard | ⬜ | button disabled |
| TC-14 | Refresh mid-training | ⬜ | job vẫn chạy |
| TC-15 | YOLO card no-train | ok | no train button |
| TC-16 | API smoke tests | ⬜ | tất cả 2xx |
