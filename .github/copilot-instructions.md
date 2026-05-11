# Workspace Awareness

- **Root Detection**: Luôn xác định thư mục gốc của dự án hiện tại bằng cách kiểm tra file `package.json` hoặc thư mục `.git` và ƯU TIÊN đọc file `reports/AGENT_LOG.md` để biết được task trước đã làm những gì, cùng với liên tục tham chiếu đến file `reports/FUNCTION_LIST.md` để bổ sung hoặc cập nhật chức năng.
- **Dynamic Path**: Các đường dẫn đến `commands/` phải luôn được tính từ Root của Workspace đang mở.
- **Project Isolation**: Không áp dụng logic của dự án này sang dự án khác nếu Workspace thay đổi.
- **Backend Structure (Updated 25/02/26)**: Backend services đã restructure từ `backend/src/` → `backend/services/` với structure mới: `services/{service-name}/app/` (thay vì `src/{service-name}/src/`). Shared utilities nằm tại `backend/services/shared/`. Container structure: `/app/` (flat, không nested `/app/app/`).
- **Frontend Structure (Updated 07/03/26)**: Frontend source đã chuyển từ `web/web-user/src/` → `web/src/`. Path đúng hiện tại: `web/src/pages/`, `web/src/components/`, `web/src/contexts/`, `web/src/services/`. FUNCTION_LIST entries cũ (trước 07/03/26) còn dùng `web/web-user/src/` là historical.
- **Exceptions (DO NOT TOUCH)**: Tuyệt đối không tự ý thay đổi nội dung trong các thư mục: `k8s-configs/`, `assets/` đến khi tôi cho phép.
- **Scope coding**: Dự án được phát triển trên máy cá nhân không phải master node nên những hành động nào liên quan đến thực hiện đến k3s phải ghi ra câu lệnh rồi tôi thực hiện và gửi bạn kết quả. Không được tự ý thực hiện trên máy cá nhân vì không hoạt động được

# Role & Project Context

- **Role**: Senior Full-stack Developer (Expert in Node.js, React, Python).
- **Project**: Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị.
- **Tech Stack**: Node.js (Backend), React + Tailwind + ShadCN (Frontend).

# Token Optimization Rules

- **Be Concise**: Trả lời ngắn gọn, đi thẳng vào vấn đề. Không giải thích lại những thứ đã biết trừ khi được yêu cầu.
- **Code Only (When appropriate)**: Khi yêu cầu sửa lỗi nhỏ, chỉ trả lời đoạn code thay đổi, không copy lại toàn bộ file.
- **Context Pruning**: Khi tham chiếu các file `.md` lớn, chỉ trích xuất các phần (Section) liên quan trực tiếp đến nhiệm vụ hiện tại.
- **No Verbosity**: Loại bỏ các câu chào hỏi, kết luận rườm rà như "I hope this helps".
- **Parallel Reads**: Khi cần đọc nhiều file, sử dụng parallel tool calls thay vì sequential để tiết kiệm thời gian.
- **Read Smart**: KHÔNG đọc toàn bộ file nếu chỉ cần 1 section. Sử dụng `startLine`/`endLine` chính xác.
- **File này (copilot-instructions.md) – quy tắc biên tập**: Khi cập nhật file này, CHỈ ghi tổng quan — nêu nguyên tắc, không viết code block minh họa dài. Chi tiết implementation → đặt vào file `style-guide/` riêng (ví dụ: `FRONTEND_RULES.md`, `BACKEND_RULES.md`). Giữ file < 250 lines.

# Global Coding Rules

- **Naming**:
  - PascalCase cho React Components.
  - camelCase cho biến, hàm, và instances.
  - kebab-case cho tên file và thư mục.
- **Component File Organization**: → `style-guide/frontend/FRONTEND_RULES.md#1`. Page-specific → `components/{page}/`, Shared → `components/` root. File >500 lines hoặc ≥3 inline sub-component → BẮT BUỘC tách.
- **Async/Logic**:
  - Ưu tiên tuyệt đối `async/await`.
  - Xử lý lỗi tập trung qua Middleware thay vì bọc `try/catch` rời rạc ở mọi nơi.
- **Validation (Node.js)**: → `style-guide/backend/BACKEND_RULES.md#1`. Dùng Zod/Joi cho mọi input, khớp với `schemas/DATABASE_SCHEMA.md`.
- **UI/UX**:
  - Chỉ sử dụng Shadcn UI và Tailwind CSS.
  - Icon ưu tiên Lucide React hoặc bộ icon thống nhất của dự án.
  - Hiển thị giao diện hãy sử dụng từ Tiếng Việt.
  - **Design System**: `style-guide/frontend/UI_STYLE_GUIDE.md` là nguồn sự thật cho màu sắc, badge, stats card, table row, threshold badge, LOS colors, chart pattern, empty state.
  - → **Đọc `style-guide/frontend/FRONTEND_RULES.md` khi implement UI** (component org, dialog, tooltip, text overflow, scroll, chart tooltip, loading, scrollbar, highlight, theme, navigate state, custom components).
  - **BẮT BUỘC**: filter/search list → dùng `<HighlightText>` từ `@/components/highlight-text`.
  - **BẮT BUỘC**: Page mới → 2-layer loading (`loader` trong App.tsx + `useLoading()` API-level).
  - **BẮT BUỘC**: Trước khi tạo component mới → kiểm tra `web/src/components/` xem đã có custom component phù hợp chưa. Ưu tiên tái sử dụng nếu bản thiết kế đã tham chiếu component đó (xem Rule #13 trong `FRONTEND_RULES.md`).

- **Documentation (Function Headers)**:
  - Mọi hàm (Function/Method) và API Route PHẢI có JSDoc/docstring ngắn gọn ngay phía trên.
  - Định dạng:
    /\*\*
    - [Mô tả chức năng bằng tiếng Việt]
    - [Phương thức HTTP + Path - nếu là API]
      \*/
  - Yêu cầu: Ngôn ngữ súc tích, đi thẳng vào mục đích của hàm.
- **Mock Data (Frontend)**:
  - **LUÔN dùng JSON file** thay vì generate tự động − dễ đọc, dễ debug, mô phỏng API response thực tế.
  - JSON structure PHẢI khớp với format API sẽ trả về (ví dụ: `{ metadata: {...}, data: [...] }`).
  - Đặt file JSON cùng folder với component sử dụng (ví dụ: `components/dashboard/forecast/forecast-mock-data.json`).
  - Trong JSON: bao gồm metadata (nowIndex, timeRange, description) + data arrays đầy đủ cho test cases.
  - Component chỉ import JSON và transform nếu cần − KHÔNG tự generate random/noise/math patterns.
  - Lợi ích: (1) Dễ share/review data, (2) Thay đổi data không cần rebuild logic, (3) Clear separation data/presentation, (4) Visual diff-friendly trong Git.
- **Docker + Timezone**: → `style-guide/backend/BACKEND_RULES.md#6-7`.

# Backend Server (Node.js) Rules

> **Đọc `style-guide/backend/BACKEND_RULES.md` khi thực hiện task backend** (migration, API, swagger, docker, timezone).

**Critical (luôn nhớ — không cần đọc lại):**

- `runMigrations()` PHẢI chạy trước khi server nhận request (`backend/server/src/migrations/runner.ts`).
- Swagger tạm đóng — **KHÔNG cập nhật** `swagger.ts` cho đến khi có kế hoạch revamp riêng.
- Migration: chỉ DDL, `IF NOT EXISTS`, KHÔNG INSERT/seed, lỗi chỉ log không throw.

# Context Reference Strategy

- **Smart Reading Priority**:
  1. `reports/AGENT_LOG.md` (entry cuối) - Hiểu context task trước
  2. `reports/FUNCTION_LIST.md` (tìm kiếm ID liên quan) - Xác định functions liên quan
  3. `schemas/*.md` (chỉ khi cần DB/FIWARE structure)
  4. `commands/PROJECT_CONTEXT_FRONTEND.md` hoặc `commands/PROJECT_CONTEXT_BACKEND.md` (chỉ khi cần architecture overview)
- **Style Guides — Đọc khi task liên quan**:
  - Frontend UI task → `style-guide/frontend/FRONTEND_RULES.md`
  - Frontend design/colors/layout → `style-guide/frontend/UI_STYLE_GUIDE.md`
  - Backend API/migration/docker → `style-guide/backend/BACKEND_RULES.md`
- **Conditional Reading**: KHÔNG đọc file nếu không liên quan trực tiếp đến task:
  - Task về Frontend → KHÔNG đọc backend PROJECT_CONTEXT
  - Task về Backend API → KHÔNG đọc image-process/image-predict context
  - Task về UI → KHÔNG đọc DATABASE_SCHEMA
- **Auto-Update**: Sau khi thay đổi code ảnh hưởng cấu trúc/logic, cập nhật `.md` files để maintain "Single Source of Truth".

# Environment Specifics

- **OS**: Arch Linux (Sử dụng lệnh `pacman` hoặc `yay` nếu cần cài đặt công cụ hỗ trợ).
- **Editor**: Visual Studio Code (Tận dụng tối đa Copilot Chat và Inline Suggestion).
- **Python**: Sử dụng `venv` command để activate virtual env (ví dụ: `venv venv-py314`)
- **Testing**: Luôn test functions với real data trước khi commit logic quan trọng.

# Documentation Maintenance

- **Single Source of Truth**: `FUNCTION_LIST.md` là master reference cho tất cả functions
- **Avoid Duplication**: PROJECT_CONTEXT files nên reference FUNCTION_LIST.md thay vì list lại
- **Keep Updated**: Mỗi lần thay đổi logic → update AGENT_LOG + FUNCTION_LIST trong cùng 1 task
- **.md File Size**: Giữ files <300 lines, nếu quá dài thì tách sections hoặc reference external docs

# Logic Regression Check (Kiểm tra trước khi hoàn thành)

Trước khi xác nhận hoàn thành bất kỳ chức năng mới nào, BẮT BUỘC kiểm tra:

1. **Logic cũ có bị ảnh hưởng không?** — Đọc lại tất cả hàm/component bị sửa. Nếu có sự thay đổi props, interface, state — trace ngược lên tất cả consumer hiện tại.
2. **Hook rules** — Không gọi hook sau `if` / `return null`. Hooks phải gọi vô điều kiện ở top level component.
3. **Side effect mới** — `useEffect` mới có thể chạy luôn khi mount? Có cleanup không? Có dependency vòng lặp không?
4. **Navigate state** — Sau khi consume `location.state`, BUỘC phải clear bằng `navigate(pathname, { replace: true, state: {} })` tránh re-trigger sau navigate qua lại.
5. **TypeScript 0 errors** — Chạy `get_errors` sau mọi batch change trước khi báo hoàn thành.

# Post-Task Protocol (Quy trình sau nhiệm vụ)

## Khi nào cần update documentation:

### LUÔN update `schemas/*.md` khi:

- Thêm/xóa table hoặc column trong PostgreSQL → cập nhật `schemas/DATABASE_SCHEMA.md`
- Thay đổi attribute hoặc format trong FIWARE Orion entity → cập nhật `schemas/FIWARE_ORION_DATA_TEMPLATE.md`
- Thêm bucket, thay đổi key pattern hoặc logic chọn model active trong MinIO → cập nhật `schemas/MINIO_STORAGE_SCHEMA.md`
- Thay đổi kiểu dữ liệu, format timestamp, hoặc CameraData interface → cập nhật file schema tương ứng
- **KHÔNG** để code và schema lệch nhau quá 1 task – schema là "single source of truth" cho DB, FIWARE, và Storage

### LUÔN update AGENT_LOG.md khi:

- Hoàn thành task có thay đổi code (>10 dòng)
- Fix bug nghiêm trọng ảnh hưởng logic
- Implement tính năng mới
- Refactor/tối ưu architecture

### Update FUNCTION_LIST.md khi:

- Tạo function/method MỚI (bất kể ngôn ngữ)
- Thay đổi LOGIC quan trọng của function hiện có (ghi tag `[UPDATED DD/MM/YY]`)
- Fix bug trong function (thêm `[BUG]` vào cột "Hạn chế")
- Thêm TODO cho tính năng chưa làm (tag `[TODO]`)

### Xoá những file được tạo ra nhằm mục đích test

### KHÔNG cần update khi:

- Chỉ sửa typo/formatting nhỏ (<5 dòng)
- Thay đổi comment/documentation trong code
- Refactor tên biến không ảnh hưởng logic

## Cấu trúc AGENT_LOG.md:

- **Thời gian**: DD/MM/YYervices/shared/los_utils.py::function_name()`) - **Chú ý: dùng /services/ thay vì /src/**
- **Số dòng**: Ước tính tương đối (~20, +50, -10)
- **File**: List dưới dạng inline code `file.name`
- **Ghi chú**: Ngắn gọn, highlight impact chính

## FUNCTION_LIST.md Conventions:

- **ID Format**: [FILE_EXT]-[3CHAR] (PY-XXX, TSX-XXX, TS-XXX)
- **Hạn chế & Lý do**: Tag `[BUG]` cho lỗi logic, `[TODO]` cho chưa làm, `[UPDATED DD/MM/YY]` cho thay đổi
- **Vị trí**: Đường dẫn từ root (ví dụ: `backend/src/shared/los_utils.py::function_name()`)
