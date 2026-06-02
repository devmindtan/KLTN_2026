# KLTN_2026 · Traffic Prediction and Decision Support System

He thong du doan luu luong giao thong va ho tro ra quyet dinh cho giao thong do thi.

## Muc tieu

- Giam sat realtime luu luong tu he thong camera.
- Du doan luu luong 5-60 phut toi.
- Danh gia LOS theo ty le volume/capacity.
- Ho tro ra quyet dinh van hanh qua Decision-Making module.

## Kien truc tong quan

- Frontend: React + Vite (`web/`).
- Backend API: Node.js + Express (`backend/server/`).
- Dich vu nen: Python services trong `backend/services/`.
- Realtime hub: `app-route` nhan webhook tu FIWARE va emit Socket.IO.
- Luu tru: PostgreSQL + MinIO + FIWARE Orion.
- Van hanh: Kubernetes manifests trong `k8s-configs/`.

## Cau truc chinh

```text
KLTN_2026/
|- backend/
|  |- server/                 # Node.js API, middleware auth, routes, migrations
|  \- services/               # Python/Node microservices
|     |- app-route/
|     |- backup-postgres/
|     |- data-export/
|     |- decision-analyzer/
|     |- image-predict/
|     |- image-process/
|     |- model-performance/
|     |- report-generator/
|     |- sync-actual/
|     \- shared/
|- web/                       # Frontend React + Vite
|- schemas/                   # DB/FIWARE/MinIO schema docs
|- reports/                   # AGENT_LOG, FUNCTION_LIST, DATA_FLOW, report docs
\- k8s-configs/               # service/cronjob manifests
```

## Tinh nang da co

- Camera detection realtime va dong bo Orion.
- Forecast 5 horizon (5/10/15/30/60 phut) + trend GTI.
- Sync actual de danh gia do chinh xac du bao.
- Model performance snapshots va API phan tich.
- Decision-Making system:
  - API `/api/decisions/*`
  - Service `decision-analyzer`
  - Realtime `DECISION_UPDATED` qua `DecisionReady` webhook.
- Dashboard tab lich su luu luong da moc ngay (actual vs forecast 5-phut).
- Traffic Map nang cao: route overlay, chon diem A/B tren map, danh gia camera tren tuyen.
- Data Library import/download.
- Smart Reports (PDF/XLSX) va report history.
- JWT auth (viewer guest-token, technician login/refresh/logout).

## Backend API hien tai

Base URL mac dinh local: `http://localhost:8080`

Nhom route chinh:

- `/api/auth`
- `/api/cameras`
- `/api/models`
- `/api/model-metrics`
- `/api/forecast`
- `/api/traffic`
- `/api/data-library`
- `/api/reports`
- `/api/decisions`
- `/api/help`

Luu y: Swagger dang tam dong trong `backend/server/src/index.ts` de cho dot revamp.

## Chay local

### 1) Backend server

```bash
cd backend/server
npm install
npm run dev
```

Server chay mac dinh port `8080`.
Migrations duoc goi tu `runMigrations()` khi server startup.

### 2) Frontend

```bash
cd web
npm install
npm run dev
```

Frontend chay mac dinh `http://localhost:5173`.

### 3) Python service vi du (decision-analyzer)

```bash
cd backend/services/decision-analyzer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd app
python main.py
```

Chi tiet service nay xem tai `backend/services/decision-analyzer/README.md`.

## Build va quality checks

Backend:

```bash
cd backend/server
npm run build
```

Frontend:

```bash
cd web
npm run build
npm run lint
```

## K8s va cronjobs

- Service manifests: `k8s-configs/services/`
- Cronjobs: `k8s-configs/cronjob/`

Cronjobs hien co gom backup, export, sync-actual, model-performance, decision-analyzer, va cac jobs refresh MV.

## Tai lieu nguon su that

- Kien truc/flow: `reports/DATA_FLOW.md`
- Tong hop chuc nang: `reports/report.md`
- Functional decomposition: `reports/Functional Decomposition.md`
- Function inventory: `reports/FUNCTION_LIST.md`
- Lich su thay doi: `reports/AGENT_LOG.md`

## Luu y release

- Ban release v1 duoc tong hop trong `reports/RELEASE_v1.0.0.md`.
- Cac thong tin trong README nay da duoc canh chinh theo codebase hien tai, khong dung gia dinh cu nhu port 3000 hay script `npm run migrate`.
