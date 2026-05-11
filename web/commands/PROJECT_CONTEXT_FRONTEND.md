# Frontend Context - Traffic Management System

**Last Updated**: 13/03/2026

> Đây là file context ngắn gọn. Chi tiết đầy đủ functions xem `reports/FUNCTION_LIST.md`

## Mô tả
Ứng dụng web giám sát & dự đoán lưu lượng giao thông đô thị thời gian thực. Tích hợp Camera Wall, ML Model Management, Data Library, Reports/Forecasts và JWT Auth (2 vai trò: viewer/technician).

---

## Tech Stack

| Nhóm | Packages |
|:---|:---|
| Core | React 19, TypeScript, Vite |
| UI/Styling | Tailwind CSS v4, Shadcn UI (new-york), Radix UI, Lucide + Tabler Icons |
| State/Real-time | Socket.IO Client, TanStack Table, Recharts, framer-motion |
| Auth | JWT (localStorage), `apiFetch` wrapper, `AuthContext` |
| Utils | Zod, Sonner (toast), React Router DOM v7, next-themes |

---

## Routes (`/:prefix/...`)

| Route | Page | Ghi chú |
|:---|:---|:---|
| `/` | redirect → `/user/dashboard` | |
| `/dashboard` | Dashboard | StatCards + ChartAreaInteractive + DataTable + TrafficDensityChart |
| `/monitoring` | Monitoring | Real-time camera cards + filter + **Camera Wall mode** (toggle) |
| `/analytics` | Analytics | Model metrics, confidence scores, horizon table |
| `/projects` | Projects | Placeholder |
| `/models` | Models | ML version grid, train/activate/hot-reload |
| `/data-library` | DataLibrary | Collections + entries + download/import |
| `/reports-forecasts` | ReportsForecasts | Tab: Báo cáo / Dự báo / Lịch sử |
| `/search` | Search | Tìm kiếm camera/model (API thực) + Báo cáo/Dự báo (mock) |
| `/settings` | Settings | Viewer (badge) / Technician (account+pw+log) |
| `/login` | Login | Technician login |
| `/assistant`, `/team`, `/help` | Static | Basic UI |
| `/sandbox` | Sandbox | **DEV only** – component playground (technician guard) |

---

## File Structure Quan Trọng

```
web/src/
├── App.tsx                                # Router, Providers, lazy-load all pages, route loaders
├── contexts/
│   ├── AuthContext.tsx                    # JWT (viewer/technician), silent refresh, guest token
│   ├── LoadingContext.tsx                 # startLoading/stopLoading (debounce 300ms) → PageLoadingOverlay
│   ├── SocketContext.tsx                  # Socket.IO: CAMERA_UPDATED / TRAINING_JOB_UPDATED / MODEL_RELOAD_UPDATED
│   └── ThemeContext.tsx                   # Dark/Light + localStorage
├── hooks/
│   └── use-mobile.tsx
├── lib/apiFetch.ts                        # HTTP wrapper, Bearer token auto-inject
├── services/
│   ├── auth.service.ts
│   ├── camera.service.ts
│   ├── model.service.ts
│   ├── model-metrics.service.ts
│   ├── data-library.service.ts
│   └── traffic-pattern.service.ts        # Materialized View traffic pattern API
├── components/
│   ├── layout/                           # Sidebar + header layout components
│   │   ├── custom-sidebar.tsx            # Custom sidebar (width px cố định, collapsible groups, framer-motion)
│   │   ├── app-sidebar.tsx               # Nav data, role filter, DocItem, sandbox link (technician)
│   │   ├── site-header.tsx
│   │   ├── nav-user.tsx, nav-main.tsx, nav-secondary.tsx, nav-documents.tsx
│   ├── custom/                           # Shared utility components
│   │   ├── card-section-header.tsx       # Unified card header: icon + title + badge + action + menu
│   │   ├── stat-card.tsx                 # Shared stats card: title + value + sub1/sub2 + tooltip
│   │   ├── info-tooltip.tsx              # InfoTooltip (icon trigger) + TermTooltip (inline underline)
│   │   ├── highlight-text.tsx            # <HighlightText> – BẮT BUỘC dùng cho filter/search list
│   │   ├── page-header.tsx               # PageHeader (icon + title + children)
│   │   ├── page-loading-overlay.tsx      # Blur overlay khi API > 300ms
│   │   ├── top-progress-bar.tsx          # NProgress-style bar via useNavigation()
│   │   ├── scroll-to-top.tsx             # Scroll-to-top button (threshold 300px)
│   │   ├── search-input.tsx              # Input + prefix icon + clear button
│   │   ├── custom-select.tsx             # shadcn Select wrapper với options array
│   │   └── select-with-search.tsx        # Select + sticky search bar per-option icon
│   ├── auth/
│   │   └── ProtectedRoute.tsx
│   ├── dashboard/
│   │   ├── section-cards.tsx             # 4 metric StatCards: tổng xe/camera hoạt động/trạng thái/trung bình
│   │   ├── chart-area-interactive.tsx    # Recharts AreaChart forecast per camera + V/C% dual axis
│   │   ├── data-table.tsx                # TanStack Table, ClickableRow, dual-status badge, Sheet detail
│   │   ├── forecast-accuracy-card.tsx    # Mini accuracy card (fetch metrics độc lập)
│   │   └── traffic-density-chart.tsx     # Bar chart Materialized View (hour/dow/week/month)
│   ├── monitoring/
│   │   ├── camera-wall-cell.tsx          # Ô camera: img MinIO + gradient overlay + status dot
│   │   ├── camera-wall-view.tsx          # Wall: 6 presets (4–25 ô), fullscreen, auto-rotate, keyboard
│   │   ├── camera-detail-dialog.tsx      # Dialog chi tiết camera: stats + V/C bar + forecast area chart
│   │   └── camera-utils.tsx             # getStatusBadge() helper (LOS colors)
│   ├── models/
│   │   ├── model-card.tsx, model-detail-sheet.tsx
│   │   ├── train-new-version-modal.tsx, activate-model-dialog.tsx, metric-chip.tsx
│   ├── data-library/
│   │   ├── collection-detail-sheet.tsx   # Sheet + accordion entries, download file/zip, delete
│   │   ├── import-dialog.tsx             # Import CSV/JSON, drag&drop, new/existing collection
│   │   └── edit-collection-dialog.tsx    # Edit collection title/desc/type (technician)
│   ├── reports-forecasts/
│   │   ├── reports-types.ts              # Types + mock data (ReportData, ForecastSlot, TimelinePoint...)
│   │   ├── report-row.tsx, report-card.tsx
│   │   ├── forecast-summary-bar.tsx      # 4 stats cards ngang (Accuracy/Next/Risk/Trend)
│   │   ├── forecast-timeline-chart.tsx + forecast-timeline-chart-zone.tsx
│   │   ├── forecast-next-panel.tsx, forecast-history-table.tsx
│   │   └── history-table.tsx             # Audit log với pagination
│   ├── search/
│   │   ├── search-types.ts, result-item.tsx, result-skeleton.tsx, detail-sheet.tsx
│   ├── sandbox/                          # DEV only
│   │   ├── library/ (tab-*.tsx files)
│   │   └── playground/ (pg-dashboard, pg-monitoring, pg-analytics)
│   └── ui/                              # shadcn primitives
└── pages/
    ├── dashboard.tsx, monitoring.tsx, analytics.tsx
    ├── models.tsx, projects.tsx, data-library.tsx
    ├── reports-forecasts.tsx, search.tsx
    ├── login.tsx, setting.tsx, team.tsx, help.tsx, word-assistant.tsx
    └── sandbox.tsx                       # DEV only – guard: role !== "technician" → Navigate
```

---

## Data Flow

```
App Boot ──► AuthContext: verify token → fallback guest JWT (AuthGate blocks pages until ready)
          ──► SocketContext: GET /api/cameras (static info → cameraInfoMap)
                           → Socket.IO connect (FIWARE via app-route)
                           → CAMERA_UPDATED → processedCameras (useMemo merge)
                           → Consumed: Dashboard / Monitoring / DataTable / ChartAreaInteractive
```

**Socket events**:
- `CAMERA_UPDATED` → cập nhật camera status/prediction liên tục
- `TRAINING_JOB_UPDATED` → progress Modal huấn luyện (models.tsx)
- `MODEL_RELOAD_UPDATED` → progress Banner hot-reload (models.tsx)

**Loading system**:
- `TopProgressBar` – tự quản lý via `useNavigation()` (route transition)
- `LoadingContext` + `PageLoadingOverlay` – API-level loading (debounce 300ms, blur overlay)
- Route loader `() => new Promise(r => setTimeout(r, 0))` – macrotask để bar render kịp

---

## Auth Roles

| Role | JWT TTL | Quyền |
|:---|:---|:---|
| `viewer` | 24h, anonymous | Đọc tất cả, không write |
| `technician` | 8h + refresh 30d | Viewer + train/activate, import/delete data-library, truy cập sandbox |

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