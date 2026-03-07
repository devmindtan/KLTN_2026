# Frontend Context - Traffic Management System

**Last Updated**: 07/03/2026

> Đây là file context ngắn gọn. Chi tiết đầy đủ functions xem `reports/FUNCTION_LIST.md`

## Mô tả
Ứng dụng web giám sát & dự đoán lưu lượng giao thông đô thị thời gian thực. Tích hợp Camera Wall, ML Model Management, Data Library và JWT Auth (2 vai trò: viewer/technician).

---

## Tech Stack

| Nhóm | Packages |
|:---|:---|
| Core | React 19, TypeScript, Vite |
| UI/Styling | Tailwind CSS v4, Shadcn UI (new-york), Radix UI, Lucide + Tabler Icons |
| State/Real-time | Socket.IO Client, TanStack Table, Recharts, DnD Kit |
| Auth | JWT (localStorage), `apiFetch` wrapper, `AuthContext` |
| Utils | Zod, Sonner (toast), React Router DOM v7, next-themes |

---

## Routes (`/user/...`)

| Route | Page | Ghi chú |
|:---|:---|:---|
| `/` | redirect → dashboard | |
| `/dashboard` | Dashboard | Metrics, charts, DataTable |
| `/lifecycle` | Lifecycle | Real-time cards + **Camera Wall mode** (toggle) |
| `/analytics` | Analytics | Model metrics, confidence scores, horizon table |
| `/projects` | Models | ML version grid, train/activate/hot-reload |
| `/data-library` | TrafficDataLibrary | Collections + entries + download/import |
| `/settings` | Settings | Viewer (badge+login) / Technician (account+pw+log) |
| `/login` | Login | Technician login |
| `/team`, `/reports`, `/word-assistant`, `/help`, `/search` | Static | Basic UI |

---

## File Structure Quan Trọng

```
web/src/
├── App.tsx                           # Router, AuthProvider, CustomSidebarProvider, Toaster
├── contexts/
│   ├── AuthContext.tsx               # JWT state (viewer/technician), silent refresh 30m trước hết hạn
│   ├── SocketContext.tsx             # Socket.IO: CAMERA_UPDATED / TRAINING_JOB_UPDATED / MODEL_RELOAD_UPDATED
│   └── ThemeContext.tsx              # Dark/Light + localStorage
├── lib/apiFetch.ts                   # HTTP wrapper tự động gắn Authorization: Bearer
├── services/
│   ├── auth.service.ts, camera.service.ts, model.service.ts
│   ├── model-metrics.service.ts, data-library.service.ts
├── components/
│   ├── custom-sidebar.tsx            # Custom sidebar (thay shadcn sidebar – fix overflow, width px cố định)
│   ├── app-sidebar.tsx               # Nav data inline, filter navTechnicianOnly theo role
│   ├── page-header.tsx               # PageHeader chung cho 10 pages (icon slot + title + children)
│   ├── data-table.tsx                # TanStack Table, DnD, dual-status badge, Sheet detail
│   ├── camera-wall-cell.tsx          # Ô camera: img + overlay tên + status dot
│   ├── camera-wall-view.tsx          # Wall: 6 presets (4-25 ô), fullscreen API, auto-rotate, keyboard
│   ├── traffic-density-chart.tsx     # Biểu đồ mật độ traffic
│   ├── chart-area-interactive.tsx    # Recharts area chart forecast per camera (% change labels)
│   ├── section-cards.tsx             # 4 dashboard metrics cards
│   ├── forecast-accuracy-card.tsx    # Mini accuracy card trên Dashboard (fetch metrics độc lập)
│   ├── auth/ProtectedRoute.tsx       # Route guard theo role
│   └── data-library/
│       ├── collection-detail-sheet.tsx   # Sheet + accordion entries, download file/zip, delete
│       ├── import-dialog.tsx             # Import CSV/JSON, drag&drop, new/existing collection
│       └── edit-collection-dialog.tsx    # Edit collection title/desc/type (technician)
└── pages/
    ├── dashboard.tsx, lifecycle.tsx, analytics.tsx, models.tsx
    ├── login.tsx, setting.tsx, data-library.tsx
    └── team.tsx, reports.tsx, word-assistant.tsx, help.tsx, search.tsx
```

---

## Data Flow

```
App Boot ──► AuthContext: verify token → fallback guest JWT
          ──► SocketContext: GET /api/cameras (static info)
                           → Socket.IO connect (FIWARE via app-route)
                           → CAMERA_UPDATED → processedCameras (useMemo merge)
                           → Consumed: Dashboard / Lifecycle / DataTable / ChartAreaInteractive
```

**Socket events**:
- `CAMERA_UPDATED` → cập nhật camera status/prediction liên tục
- `TRAINING_JOB_UPDATED` → progress Modal huấn luyện (models.tsx)
- `MODEL_RELOAD_UPDATED` → progress Banner hot-reload (models.tsx)

---

## Auth Roles

| Role | JWT TTL | Quyền |
|:---|:---|:---|
| `viewer` | 24h, anonymous | Đọc tất cả, không write |
| `technician` | 8h + refresh 30d | Viewer + train/activate, import/delete data-library |

---

## UI/UX Rules (đã implement ở base components — không cần thêm ở từng nơi)

- **Dialog margin**: `w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto` trong `dialog.tsx` + `alert-dialog.tsx`
- **Tooltip hover-only**: `tooltip.tsx` dùng `TooltipPointerCtx` — chặn focus trigger
- **Custom scrollbar**: class `.scrollbar` (index.css, 4px bo tròn, dark/light auto) — dùng kèm `overflow-y-auto`
- **Text overflow**: `truncate` + `max-w-*` cho mọi text có thể vượt container

---

## Environment Variables (.env)

```env
VITE_SOCKET_URL=https://socket.devmindtan.uk      # WebSocket (app-route)
VITE_MINIO_URL=https://api-minio.devmindtan.uk    # MinIO camera images
VITE_BACKEND_URL=http://localhost:8080            # Backend API
```

---

## Related Documentation
- `reports/FUNCTION_LIST.md` — Master function list (84 functions)
- `schemas/FIWARE_ORION_DATA_TEMPLATE.md` — FIWARE data format
- `web/commands/CAMERA_API_INTEGRATION.md` — API integration guide