# KLTN_2026 · Traffic Prediction & Decision Support System

> Hệ thống dự đoán lưu lượng giao thông và hỗ trợ ra quyết định cho giao thông đô thị.

![GitHub](https://img.shields.io/badge/status-active-brightgreen)
![Node.js](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB)
![Python](https://img.shields.io/badge/ml-Python%203.8%2B-3776AB)

---

## 📋 Mục đích

Ứng dụng giúp:

- **Giám sát thời gian thực** lưu lượng giao thông qua hệ thống camera AI (YOLO detection)
- **Dự báo 5–60 phút** lưu lượng tương lai dựa trên mô hình ML
- **Phân loại Level of Service (LOS)** để đánh giá chất lượng giao thông
- **Hỗ trợ quyết định** giao thông thông qua insights và recommendations

---

## 🏗️ Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│    Dashboard • Monitoring • Analytics • Public FIWARE API   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌─────▼────────┐
│ Backend API  │  │ FIWARE Orion   │  │  MinIO/S3    │
│ (Node.js)    │  │ Context Broker │  │  (Images)    │
└───────┬──────┘  └────────▲───────┘  └──────────────┘
        │                  │
        └──────────────────┼──────────────────┐
                           │                  │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌─────▼────────┐
│ PostgreSQL   │  │ ML Services    │  │  Kubernetes  │
│ (Time-series)│  │ (Python CronJob)  │  CronJobs    │
└──────────────┘  └────────────────┘  └──────────────┘
```

**Dòng dữ liệu:**

1. Camera → image-process (YOLO detection real-time)
2. Phát hiện → FIWARE Orion (update current status)
3. Cronjob 5 phút → image-predict (forecast ML)
4. Forecast → FIWARE + PostgreSQL
5. Frontend WebSocket → Real-time updates

---

## 📂 Cấu trúc Folder

```
KLTN_2026/
├── backend/
│   ├── server/                    # Node.js API & migrations
│   │   └── src/
│   │       ├── controllers/       # API endpoints
│   │       ├── routes/            # Route definitions
│   │       ├── config/            # DB, migrations
│   │       └── migrations/        # SQL schema
│   └── services/                  # Microservices (Python + Node.js)
│       ├── image-process/         # YOLO real-time detection
│       ├── image-predict/         # ML forecast (5–60 min)
│       ├── model-performance/     # Model metrics & GTI calculation
│       ├── sync-actual/           # Sync actual values from DB
│       ├── report-generator/      # PDF/XLSX smart reports
│       ├── data-export/           # Export data archives
│       ├── app-route/             # Route planning service
│       └── shared/                # Common utilities (LOS calc, etc.)
├── web/                           # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/                 # Page components
│   │   ├── components/            # Reusable UI components
│   │   ├── services/              # API clients
│   │   ├── contexts/              # React contexts (Socket, Theme, etc.)
│   │   └── lib/                   # Utils & constants
│   ├── docs/                      # API & integration guides
│   └── public/                    # Static assets
├── schemas/                       # Database & FIWARE schemas
├── reports/                       # Documentation & logs
│   ├── AGENT_LOG.md               # Task completion history
│   ├── FUNCTION_LIST.md           # All functions reference
│   └── trend_analysis/            # Trend analysis scripts
├── k8s-configs/                   # Kubernetes manifests
│   ├── services/                  # Service deployments
│   └── cronjob/                   # Cronjob schedules
└── assets/                        # Design docs & ideas
```

---

## 🚀 Bắt đầu nhanh

### Yêu cầu

- **Node.js** 18+
- **Python** 3.8+
- **PostgreSQL** 13+
- **FIWARE Orion** 4.4.0
- **Docker** & **Docker Compose** (optional, recommended for services)

### Setup Backend

```bash
cd backend/server

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env với database credentials

# Run migrations
npm run migrate

# Start dev server (port 3000)
npm run dev

# Build for production
npm run build
npm start
```

**API docs:** http://localhost:3000/api-docs (Swagger)

### Setup Frontend

```bash
cd web

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env với backend URL

# Start dev server (port 5173)
npm run dev

# Build for production
npm run build
npm preview
```

**App URL:** http://localhost:5173

### Setup Python Services

```bash
cd backend/services/image-predict

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run (requires environment variables)
python app/main.py
```

---

## 📡 API Reference

### Backend API (Node.js)

**Base URL:** `http://localhost:3000`

- `GET /api/cameras` — List all cameras
- `GET /api/cameras/:id` — Get camera details
- `GET /api/forecast/rolling?cameraId=all` — Rolling forecast
- `GET /api/reports` — List smart reports
- `POST /api/reports/generate` — Generate new report

Xem đầy đủ: [Backend Documentation](backend/server/README.md)

### FIWARE Orion Public API

**Base URL:** `https://fiware.devmindtan.uk`

- `GET /version` — Orion health check
- `GET /v2/entities?type=Camera` — List Camera entities
- `GET /v2/entities/{id}` — Get entity details
- `GET /v2/entities/{id}/attrs` — Get attributes only

**Hướng dẫn tích hợp:** [FIWARE Public API Docs](web/docs/fiware-public-api.md)

---

## 🔧 Công nghệ

| Layer                | Stack                                                   |
| -------------------- | ------------------------------------------------------- |
| **Frontend**         | React 18, TypeScript, Vite, Tailwind CSS, ShadCN UI     |
| **Backend API**      | Node.js, Express, TypeScript, Swagger                   |
| **ML Services**      | Python, Scikit-learn, TensorFlow (traffic prediction)   |
| **Database**         | PostgreSQL 13, YOLO detection results, time-series data |
| **Context Broker**   | FIWARE Orion 4.4.0 (NGSI-LD/NGSI-v2)                    |
| **Message Queue**    | Socket.IO (real-time updates)                           |
| **Storage**          | MinIO (traffic images snapshots)                        |
| **Containerization** | Docker, Docker Compose                                  |
| **Orchestration**    | Kubernetes (K3s), CronJobs                              |

---

## 📊 Main Features

### Dashboard

- Real-time traffic monitoring per camera
- Current vs. forecast visualization
- Level of Service (LOS A–F) classification
- Trend indicators (↑ increasing, ↓ decreasing, → stable)

### Forecasting

- 5–60 minute ahead predictions
- GTI (Growth Traffic Index) trend analysis
- Model performance tracking
- Forecast accuracy metrics

### Reports

- Executive summary (PDF)
- Detailed analytics (XLSX)
- Scheduled report generation
- Historical trend analysis

### Public API

- Read-only FIWARE NGSI-v2 access
- Camera entity data & forecasts
- Integration guide for partners

---

## 📝 Docs

| Document                                                               | Mô tả                                        |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| [FIWARE_ORION_DATA_TEMPLATE.md](schemas/FIWARE_ORION_DATA_TEMPLATE.md) | Camera entity structure & attributes         |
| [DATABASE_SCHEMA.md](schemas/DATABASE_SCHEMA.md)                       | PostgreSQL tables & relationships            |
| [MINIO_STORAGE_SCHEMA.md](schemas/MINIO_STORAGE_SCHEMA.md)             | MinIO bucket structure                       |
| [AGENT_LOG.md](reports/AGENT_LOG.md)                                   | Development task history                     |
| [FUNCTION_LIST.md](reports/FUNCTION_LIST.md)                           | All functions reference (Backend + Frontend) |

---

## 🧪 Testing

```bash
# Backend
cd backend/server
npm run test

# Frontend
cd web
npm run test

# Lint
npm run lint
```

---

## 🐳 Docker & Kubernetes

### Build & run containers

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Logs
docker-compose logs -f
```

### Deploy to K3s

```bash
# Apply manifests
kubectl apply -f k8s-configs/services/
kubectl apply -f k8s-configs/cronjob/

# Check status
kubectl get pods -n production
kubectl get cronjob -n production
```

---

## 🔄 Development Workflow

1. **Create feature branch:** `git checkout -b feature/xyz`
2. **Make changes & test locally**
3. **Build & verify:** `npm run build` (backend & web)
4. **Commit:** Follow conventional commits
5. **Push & create PR**
6. **Deploy:** Auto via CI/CD on merge

---

## 📞 Support

- **Issues & bugs:** [GitHub Issues](https://github.com/yourusername/KLTN_2026/issues)
- **Documentation:** [/schemas](/schemas), [/web/docs](/web/docs)
- **API Docs:** [Swagger](http://localhost:3000/api-docs)

---

## 📄 License

[Specify your license here]

---

**Last updated:** May 11, 2026  
**Status:** Active Development
