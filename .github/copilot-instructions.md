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

# Global Coding Rules

- **Naming**:
  - PascalCase cho React Components.
  - camelCase cho biến, hàm, và instances.
  - kebab-case cho tên file và thư mục.
- **Async/Logic**:
  - Ưu tiên tuyệt đối `async/await`.
  - Xử lý lỗi tập trung qua Middleware thay vì bọc `try/catch` rời rạc ở mọi nơi.
- **Validation (Node.js)**:
  - Sử dụng thư viện Validation (như Zod hoặc Joi) cho mọi dữ liệu đầu vào (Request Body, Query, Params).
  - Schema validation phải khớp chính xác với định nghĩa trong `DATABASE_SCHEMA.md`.
- **UI/UX**:
  - Chỉ sử dụng Shadcn UI và Tailwind CSS.
  - Icon ưu tiên Lucide React hoặc bộ icon thống nhất của dự án.
  - Hiển thị giao diện hãy sử dụng từ Tiếng Việt.
  - **Dialog margin**: Tất cả `DialogContent` và `AlertDialogContent` PHẢI có `w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto` để đảm bảo khoảng cách tối thiểu 1rem so với cạnh màn hình. Đã implement ở base `dialog.tsx` / `alert-dialog.tsx` – không cần thêm ở từng dialog cụ thể.
  - **Tooltip – hover-only**: Tất cả tooltip PHẢI chỉ hiện khi hover (không hiện khi focus). Base `tooltip.tsx` đã handle qua pointer tracking context. `TooltipProvider` dùng `delayDuration={200}` (sidebar standard). Không dùng native `title=""` attribute – luôn dùng Radix `<Tooltip>`.
  - **Text overflow – main pages**: Mọi text có thể dài hơn container ở trang giao diện chính (card title, badge, label, tên...) PHẢI dùng `truncate` (= `overflow-hidden text-ellipsis whitespace-nowrap`) + `max-w-*` phù hợp. Không để text tràn layout.
  - **Scroll cho list / overflow**: Mọi danh sách dữ liệu hoặc vùng content có thể vượt quá viewport PHẢI có `overflow-y-auto` (hoặc `overflow-auto`). Sheet/Dialog chứa danh sách dài dùng `max-h-[X] overflow-y-auto`. Không dùng `overflow-hidden` ở container chứa danh sách.
  - **Custom scrollbar**: Tuyệt đối KHÔNG dùng scrollbar mặc định của trình duyệt. Mọi container có `overflow-y-auto` / `overflow-auto` PHẢI kèm class `scrollbar` (định nghĩa trong `index.css`). Scrollbar custom: 4px, bo tròn, dùng `--muted-foreground` 25% opacity, hover 50%. Áp dụng cả base components (dialog, select, dropdown, sheet).
- **Documentation (Function Headers)**:
  - Mọi hàm (Function/Method) và API Route PHẢI có JSDoc/docstring ngắn gọn ngay phía trên.
  - Định dạng:
    /\*\*
    - [Mô tả chức năng bằng tiếng Việt]
    - [Phương thức HTTP + Path - nếu là API]
      \*/
  - Yêu cầu: Ngôn ngữ súc tích, đi thẳng vào mục đích của hàm.
- **Docker Best Practices**:
  - Sử dụng multi-stage build (builder + runner) cho Python services
  - COPY paths: Chỉ copy `app/`, `models/`, `shared/` (không copy toàn bộ service folder)
  - Container structure: Flat `/app/` (không nested `/app/app/`)
  - Imports: Direct imports (`from query import ...` thay vì `from app.query import ...`)
- **Timezone Handling**:
  - LUÔN dùng `datetime.utcnow().isoformat()` cho upload FIWARE
  - Database TIMESTAMPTZ columns nhận UTC input
  - Frontend convert UTC → local time khi display

# Context Reference Strategy

- **Smart Reading Priority**:
  1. `reports/AGENT_LOG.md` (entry cuối) - Hiểu context task trước
  2. `reports/FUNCTION_LIST.md` (tìm kiếm ID liên quan) - Xác định functions liên quan
  3. `schemas/*.md` (chỉ khi cần DB/FIWARE structure)
  4. `commands/PROJECT_CONTEXT.md` (chỉ khi cần architecture overview)
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
