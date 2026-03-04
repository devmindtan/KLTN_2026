# Chủ đề:
Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị

## Mô tả dự án:
Ứng dụng web sử dụng Machine Learning để dự đoán lưu lượng giao thông đô thị và cung cấp giao diện hỗ trợ ra quyết định cho việc quản lý giao thông. Hệ thống thu thập và phân tích dữ liệu từ camera và sensors để:
- Giám sát lưu lượng giao thông thời gian thực
- Dự đoán tình trạng giao thông tại các điểm quan trọng
- Đưa ra khuyến nghị tự động để tối ưu hóa luồng giao thông
- Phát hiện và cảnh báo ùn tắc tiềm năng
- Hỗ trợ ra quyết định cho việc điều chỉnh đèn tín hiệu và phân luồng

## Các mô hình ML được sử dụng:
- **LSTM (Long Short-Term Memory)** - Dự đoán lưu lượng theo chuỗi thời gian
- **Random Forest** - Phân loại mức độ ùn tắc
- **XGBoost** - Phát hiện điểm ùn tắc tiềm năng
- **CNN (Computer Vision)** - Phân tích hình ảnh từ camera giao thông

# Công nghệ sử dụng trong dự án:
**Core Technologies**
- React 19.1.1 - Framework JavaScript chính
- TypeScript - Ngôn ngữ lập trình với type safety
- Vite - Build tool & development server hiện đại
**Styling & UI**
- Tailwind CSS v4 - Utility-first CSS framework
- Shadcn UI (style: new-york) - Component library dựa trên Radix UI
- Radix UI - Headless UI primitives
- Lucide React & Tabler Icons - Icon libraries
- next-themes - Quản lý theme (dark/light mode)
- tailwindcss-animate - CSS animations
**Features & Utilities**
- React Router DOM v7 - Client-side routing
- TanStack Table (React Table) - Data table management
- Recharts - Charting library
- DnD Kit - Drag and drop functionality
- Zod - Schema validation
- Sonner - Toast notifications
- Vaul - Drawer component
**Real-time & API Integration**
- Socket.IO Client - WebSocket connection cho real-time data
- Fetch API - HTTP requests cho camera database
- SocketContext - Global state management cho camera data
**Luồng chạy chính:**
1. index.html → Entry point, load script từ main.tsx
2. src/main.tsx → Khởi tạo React app
   - Render App component vào #root element
   - Wrap trong StrictMode
3. src/App.tsx → Core application logic
   - Tạo browser router với base path /user
   - Setup layout với SidebarProvider, AppSidebar, và SiteHeader
   - Định nghĩa các routes cho ứng dụng dự đoán lưu lượng giao thông:
     - /user (index) → Dashboard - Tổng quan hệ thống
     - /user/dashboard → Dashboard
     - /user/lifecycle → Giám Sát Lưu Lượng (Traffic Monitoring)
     - /user/analytics → Phân Tích Dự Đoán (Predictive Analytics)
     - /user/projects → Mô Hình ML (ML Models Management)
     - /user/team → Đội Ngũ Phát Triển
     - /user/data-library → Dữ Liệu Giao Thông (Traffic Data)
     - /user/reports → Báo Cáo Giao Thông (Traffic Reports)
     - /user/word-assistant → Hỗ Trợ Ra Quyết Định (Decision Support System)
     - /user/settings → Cài Đặt
     - /user/help → Trung Tâm Hỗ Trợ
     - /user/search → Tìm Kiếm
4. Layout Structure: SidebarProvider → AppSidebar + SidebarInset (với SiteHeader và main content)

**Pages**: (Chi tiết routes & functions xem `reports/FUNCTION_LIST.md`)
- `/user/dashboard`: Tổng quan hệ thống (metrics, charts)
- `/user/lifecycle`: **Giám Sát** real-time (search, filter, grid cards)
- `/user/analytics`, `/user/projects`: Phân tích ML (🚧 TODO)
- `/user/{team,data-library,reports,word-assistant}`: Quản lý dự án
- `/user/{settings,help,search}`: Tiện ích

**Key Components**: (Chi tiết xem `reports/FUNCTION_LIST.md`)
- Navigation: `app-sidebar`, `nav-main`, `nav-documents`, `nav-secondary`, `nav-user`
- Data: `data-table` (TanStack Table + drag-drop), `chart-area-interactive` (Recharts)
- Layout: `site-header`, `section-cards`
- UI primitives: Shadcn UI (40+ components trong `components/ui/*`)

**Context & Services:**
- src/contexts/SocketContext.tsx - WebSocket connection & camera data management
- src/services/camera.service.ts - Camera API client (GET /api/cameras)

## Data Architecture

### Real-time Data Flow
```
1. App Mount
   ↓
2. SocketProvider Initialize
   ↓
3. Fetch camera list from Database API (getAllCameras)
   │  - GET /api/cameras → 20 cameras với name, location
   │  - Store in cameraInfoMap
   │  - Create initial cameras với default values (0 vehicles, unknown status)
   ↓
4. Connect Socket.IO to FIWARE Orion
   │  - Event: "CAMERA_UPDATED" (continuous updates)
   │  - Update cameras state với real-time data
   ↓
5. Process & Merge Data (useMemo)
   │  - Merge cameraInfoMap (static) + cameras (real-time)
   │  - Output: processedCameras array
   ↓
6. Components Consume (useSocket hook)
   │  - Dashboard, DataTable, Charts
   │  - Auto re-render on updates
```

### Data Sources

**Static Data (từ Database - fetch once)**
- cam_id (primary key)
- display_name (tên hiển thị vị trí)
- location (tọa độ GPS)
- Source: PostgreSQL table `camera_data`

**Real-time Data (từ Socket.IO - continuous)**
- total_objects (tổng phương tiện)
- detections {car, motorbike} (chi tiết loại xe)
- minio_key (đường dẫn ảnh)
- last_updated (timestamp cập nhật cuối)
- prediction {forecasts, status, trend} (dự đoán AI)
- last_predicted (timestamp dự đoán)
- Source: FIWARE Orion Context Broker qua Socket.IO

**Development:**
- `npm run dev` - Khởi động Vite dev server
- `npm run build` - Build production
- `npm run lint` - Chạy ESLint
- `npm run preview` - Preview production build

## Environment Variables (.env)
```env
VITE_SOCKET_URL=https://socket.devmindtan.uk      # WebSocket server for FIWARE Orion
VITE_MINIO_URL=https://api-minio.devmindtan.uk    # MinIO storage for camera images
VITE_BACKEND_URL=http://localhost:8080            # Backend API cho camera database
```

## Recent Improvements & Fixes

### Socket.IO Integration (February 2026)
- ✅ Global SocketContext cho real-time camera updates
- ✅ Auto-reconnect với error handling
- ✅ NGSI-LD data transformation
- ✅ Event: "CAMERA_UPDATED" continuous streaming

### Camera Database Integration
- ✅ Camera API service (`camera.service.ts`)
- ✅ Fetch 20 cameras từ PostgreSQL on mount
- ✅ Merge static data (name, location) với real-time data
- ✅ Initial cameras với default values → Không còn empty table

### DataTable Enhancements
- ✅ Fixed: Initial load hiển thị ngay 20 cameras
- ✅ Fixed: Pagination không reset khi socket update (`autoResetPageIndex: false`)
- ✅ Real-time sync với `useEffect` on `initialData` change
- ✅ Drag & drop reordering
- ✅ Column visibility toggle
- ✅ Sheet detail viewer với forecast chart

### Data Architecture
- ✅ Separation of concerns: Static DB data + Real-time socket data
- ✅ Efficient merging trong `useMemo` để avoid unnecessary re-renders
- ✅ Type-safe với Zod schema validation

## File Structure Important
```
client/
├── src/
│   ├── services/
│   │   └── camera.service.ts          # Camera API client
│   ├── contexts/
│   │   └── SocketContext.tsx          # Socket.IO integration & data merge
│   ├── components/
│   │   ├── data-table.tsx             # Main data table với real-time updates
│   │   ├── chart-area-interactive.tsx # Traffic chart
│   │   └── section-cards.tsx          # Metrics cards
│   └── pages/
│       └── dashboard.tsx              # Main dashboard consuming SocketContext
└── commands/
    ├── PROJECT_CONTEXT_FRONTEND.md    # This file
    ├── CAMERA_API_INTEGRATION.md      # Backend API guide
    ├── FIWARE_ORION_DATA_TEMPLATE.md  # Orion data format reference
```

## Tính năng chính của các Page:

### 1. Dashboard (src/pages/dashboard.tsx)
- Hiển thị tổng quan về hệ thống giao thông real-time
- Các card thống kê:
  - Total Vehicles (tổng phương tiện hiện tại)
  - Active Cameras (số camera hoạt động)
  - Traffic Status (clear/congestion)
  - Vehicle Breakdown (cars vs motorbikes)
- Biểu đồ lưu lượng giao thông tương tác (ChartAreaInteractive)
- Bảng dữ liệu live camera feed (DataTable):
  - 20 cameras với real-time updates
  - Drag & drop để sắp xếp
  - Pagination không reset khi data update
  - Columns: Camera ID, Location Name, Vehicles, Status, Trend, Forecast
  - Sheet detail với image preview và forecast chart

### 2. Giám Sát Lưu Lượng (src/pages/lifecycle.tsx)
- Theo dõi lưu lượng thời gian thực tại 4+ điểm quan trọng
- Hiển thị trạng thái: Bình thường, Cảnh báo, Ùn tắc
- Số phương tiện hiện tại và thời gian cập nhật cuối
- Giao diện card với icon và badge màu sắc

### 3. Phân Tích Dự Đoán (src/pages/analytics.tsx)
- Dự đoán lưu lượng theo khung giờ
- Hiển thị độ chính xác trung bình của mô hình (91.2%)
- Danh sách dự đoán với địa điểm và độ tin cậy
- Cảnh báo điểm dự báo ùn tắc cao

### 4. Mô Hình ML (src/pages/projects.tsx)
- Quản lý 4 mô hình: LSTM, Random Forest, XGBoost, CNN
- Hiển thị độ chính xác, trạng thái, thời gian huấn luyện
- Phân loại: Deep Learning, Machine Learning, Computer Vision
- Chức năng: Xem chi tiết, Huấn luyện lại

### 5. Đội Ngũ (src/pages/team.tsx)
- Danh sách 6 thành viên dự án
- Vai trò: ML Engineer, Data Scientist, Backend/Frontend Dev, DevOps, PM
- Thông tin liên hệ: Email, Phone
- Chuyên môn của từng thành viên

### 6. Dữ Liệu Giao Thông (src/pages/data-library.tsx)
- 6 bộ dữ liệu: Streaming, Historical, Weather, Event, Training, Labels
- Thông tin: Nguồn, Kích thước, Số bản ghi, Thời gian cập nhật
- Trạng thái: Hoạt động, Đang xử lý, Lưu trữ
- Chức năng: Xem chi tiết, Truy xuất, Import mới

### 7. Báo Cáo Giao Thông (src/pages/reports.tsx)
- Báo cáo theo: Tháng, Tuần, Đặc biệt, Kỹ thuật
- Hiển thị: Loại báo cáo, Khoảng thời gian, Kích thước file
- Trạng thái: Hoàn thành, Đang xử lý
- Chức năng: Xem trước, Tải xuống

### 8. Hỗ Trợ Ra Quyết Định (src/pages/word-assistant.tsx)
- Khuyến nghị tự động dựa trên AI
- 3 mức ưu tiên: Cao, Trung bình, Thấp
- Nội dung: Điều chỉnh đèn, Cảnh báo lưu lượng, Tối ưu luồng, Bảo trì
- Hiển thị: Tác động dự kiến, Độ tin cậy
- Chức năng: Áp dụng, Bỏ qua

### 9. Trung Tâm Hỗ Trợ (src/pages/help.tsx)
- Tài liệu hướng dẫn sử dụng
- Câu hỏi thường gặp (FAQ)
- Thông tin liên hệ: Email, Hotline, Live Chat
- Phân loại theo chuyên mục

### 10. Tìm Kiếm (src/pages/search.tsx)
- Tìm kiếm toàn cục trong hệ thống
- Lịch sử tìm kiếm gần đây
- Truy cập nhanh: Vị trí, Dự đoán, Báo cáo
- Badge phân loại kết quả