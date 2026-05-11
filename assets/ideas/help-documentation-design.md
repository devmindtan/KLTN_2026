# Thiết kế: Trang Tài liệu Hướng dẫn (Help Documentation)

> **Ngày tạo:** 18/03/2026
> **Phạm vi:** Section "Tài liệu hướng dẫn" trong trang Help
> **Mục đích:** Giải thích các thuật ngữ khoa học, thông số kỹ thuật hiển thị trong app cho người dùng không có nền tảng kỹ thuật

---

## Vấn đề cần giải quyết

Ứng dụng dự báo giao thông hiển thị nhiều thuật ngữ khoa học chuyên ngành mà người dùng vận hành (quản lý giao thông, điều phối viên) không quen. Cụ thể:

- **LOS** (Level of Service) — 5 cấp độ dịch vụ với màu sắc khác nhau
- **GTI** (General Trend Index) — chỉ số xu hướng tổng hợp có trọng số
- **Horizon** — khái niệm dự báo đa mức thời gian (5m/10m/15m/30m/60m)
- **VC%** — tỷ lệ lưu lượng trên sức chứa đường
- **MAE, MAPE, R², RMSE** — các chỉ số đánh giá độ chính xác mô hình ML
- **Prediction Confidence / Error Confidence** — độ tin cậy 2 chiều

---

## Nguyên tắc thiết kế nội dung

### Quy tắc 3 lớp (3-Layer Rule)
Mỗi khái niệm phải tuân theo cấu trúc:

```
┌────────────────────────────────────────────┐
│ [1] Một câu tóm tắt — không chuyên môn    │  ← Luôn hiển thị
├────────────────────────────────────────────┤
│ [2] Giải thích ngữ cảnh               ]   │  ← Luôn hiển thị
│   - Hiển thị ở đâu trong app             │
│   - Đọc số liệu như thế nào              │
│   - Ý nghĩa thực tế khi ra quyết định   │
├────────────────────────────────────────────┤
│ [3] Chi tiết kỹ thuật ▼ (collapsible)    │  ← Ẩn mặc định
│   - Công thức                            │
│   - Ngưỡng đầy đủ                        │
│   - Thuật toán                           │
└────────────────────────────────────────────┘
```

### Ngôn ngữ
- Lớp 1 & 2: Tiếng Việt thuần, tránh abbreviation kỹ thuật
- Lớp 3: Có thể dùng ký hiệu toán học, công thức
- Ví dụ: thay vì "MAE" → gọi là "Sai số trung bình tuyệt đối (MAE)" trong tiêu đề

---

## Cấu trúc nội dung (Mục lục sidebar)

```
Tài liệu hướng dẫn
│
├── 1. Tổng quan hệ thống
│   ├── 1.1 Hệ thống hoạt động như thế nào
│   └── 1.2 Nguồn dữ liệu và camera
│
├── 2. Trang Dashboard
│   ├── 2.1 Cấp độ dịch vụ giao thông (LOS)  ★ Quan trọng nhất
│   ├── 2.2 Chỉ số xu hướng chung (GTI)
│   ├── 2.3 Thẻ tổng quan — Tổng phương tiện
│   ├── 2.4 Thẻ tổng quan — Camera hoạt động
│   ├── 2.5 Thẻ tổng quan — Xu hướng mạng lưới
│   └── 2.6 Thẻ tổng quan — Cảnh báo ùn tắc
│
├── 3. Tab Dự báo
│   ├── 3.1 Horizon dự báo là gì?            ★ Quan trọng nhất
│   ├── 3.2 Tỷ lệ sử dụng đường (VC%)
│   ├── 3.3 Mức độ rủi ro (Risk Level)
│   ├── 3.4 Độ tin cậy dự báo (Confidence)
│   ├── 3.5 So sánh với trung bình tuần
│   └── 3.6 Sai số dự báo (Error %)
│
├── 4. Trang Hiệu suất mô hình
│   ├── 4.1 Sai số trung bình tuyệt đối (MAE)
│   ├── 4.2 Phần trăm sai số tuyệt đối (MAPE)
│   ├── 4.3 Hệ số xác định (R²)
│   ├── 4.4 Sai số bình phương gốc (RMSE)
│   └── 4.5 Đọc biểu đồ hiệu suất theo horizon
│
└── 5. Trang Báo cáo & Dữ liệu
    ├── 5.1 Lọc và tìm kiếm dữ liệu
    └── 5.2 Xuất báo cáo
```

---

## Nội dung chi tiết từng mục

### 2.1 Cấp độ dịch vụ giao thông (LOS)

**[Lớp 1 — Tóm tắt]**
> LOS (Level of Service) là thang đo 5 cấp độ phân loại mức độ đông đúc của một đoạn đường, từ thông thoáng đến kẹt cứng.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Dashboard (màu badge camera), Tab Dự báo (cột LOS dự báo/thực tế), Báo cáo
- Dựa trên tỷ lệ VC% — số xe đang lưu thông so với sức chứa tối đa của đường
- Mỗi cấp có màu riêng để nhận diện nhanh:

| Cấp độ | Tên | Màu | Ý nghĩa thực tế |
|--------|-----|-----|-----------------|
| A | Thông thoáng (Free Flow) | Xanh lá | Xe chạy tự do, không cản trở |
| B | Ổn định (Smooth) | Xanh lam | Tốc độ tốt, ít xung đột |
| C | Trung bình (Moderate) | Vàng | Bắt đầu đông, cần chú ý |
| D | Đông đúc (Heavy) | Cam | Tốc độ giảm đáng kể |
| E | Ùn tắc (Congested) | Đỏ | Kẹt xe, cần can thiệp |

**[Lớp 3 — Kỹ thuật, collapsible]**
```
Ngưỡng VC% tương ứng:
  Free Flow:  VC% ≤ 40%
  Smooth:     40% < VC% ≤ 60%
  Moderate:   60% < VC% ≤ 80%
  Heavy:      80% < VC% ≤ 100%
  Congested:  VC% > 100%

Nguồn: Highway Capacity Manual (HCM) — tiêu chuẩn quốc tế
```

---

### 2.2 Chỉ số xu hướng chung (GTI)

**[Lớp 1 — Tóm tắt]**
> GTI là một con số từ 0–100 tóm tắt xu hướng lưu lượng hiện tại của toàn bộ mạng lưới camera, cao hơn = đông hơn bình thường.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Dashboard Overview (thẻ xu hướng mạng lưới)
- GTI tổng hợp dự báo từ **5 mức horizon** khác nhau thành 1 điểm duy nhất
- Các mức horizon gần (5 phút, 10 phút) được tính trọng số cao hơn vì ảnh hưởng thực tế lớn hơn
- Đọc kết quả:
  - GTI tăng → chuẩn bị điều phối ứng phó
  - GTI giảm → tình trạng đang cải thiện

**[Lớp 3 — Kỹ thuật, collapsible]**
```
GTI = (Σ Pᵢ × wᵢ / Max_capacity) × 100

Trọng số mặc định:
  Horizon 5m  → w = 0.35
  Horizon 10m → w = 0.25
  Horizon 15m → w = 0.20
  Horizon 30m → w = 0.15
  Horizon 60m → w = 0.05

Max_capacity: Sức chứa tối đa quan sát được trong 7 ngày gần nhất
```

---

### 3.1 Horizon dự báo là gì?

**[Lớp 1 — Tóm tắt]**
> Horizon là khoảng thời gian trong tương lai mà hệ thống dự báo — ví dụ horizon 15 phút nghĩa là "dự đoán số xe 15 phút nữa sẽ là bao nhiêu".

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột Horizon, biểu đồ rolling forecast)
- Hệ thống dự báo đồng thời **5 horizon** cho mỗi camera tại mỗi thời điểm:
  - **5 phút** — Tức thì, dành cho điều tiết giao thông ngay lập tức
  - **10 phút** — Ngắn hạn rất gần
  - **15 phút** — Ngắn hạn (phổ biến trong điều phối)
  - **30 phút** — Trung hạn, chuẩn bị nguồn lực
  - **60 phút** — Dài hạn, lập kế hoạch ca trực
- Horizon càng ngắn → **độ chính xác thường cao hơn**
- Horizon càng dài → sai số tăng nhưng thời gian phản ứng nhiều hơn

**[Lớp 3 — Kỹ thuật, collapsible]**
```
Mỗi dự báo được tạo ra tại time_bucket hiện tại (5 phút/bucket).
forecast_for_time = now_bucket_end + horizon_minutes

Ví dụ tại 9:55:
  Horizon  5m → dự báo cho 10:00
  Horizon 30m → dự báo cho 10:25
  Horizon 60m → dự báo cho 10:55
```

---

### 3.2 Tỷ lệ sử dụng đường (VC%)

**[Lớp 1 — Tóm tắt]**
> VC% cho biết đường đang sử dụng bao nhiêu phần trăm sức chứa tối đa của nó — 80% nghĩa là còn 20% dự phòng.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột VC%)
- Liên kết trực tiếp với LOS: VC% càng cao → LOS càng nặng
- Khi VC% vượt 100%: đường đã quá tải, xe phải xếp hàng chờ

**[Lớp 3 — Kỹ thuật, collapsible]**
```
VC% = (predicted_vehicles / road_capacity) × 100

road_capacity: max xe đếm được trong 7 ngày qua (rolling window)
```

---

### 3.3 Mức độ rủi ro (Risk Level)

**[Lớp 1 — Tóm tắt]**
> Risk Level đánh giá khả năng tình trạng giao thông xấu đi trong thời gian dự báo — là cờ cảnh báo sớm.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột Rủi ro), thẻ Dashboard (Cảnh báo ùn tắc)
- 3 mức:
  - 🟢 **Thấp (Low)** — Lưu lượng ổn định, không cần can thiệp
  - 🟡 **Trung bình (Medium)** — Cần theo dõi, có thể diễn biến xấu
  - 🔴 **Cao (High)** — Khuyến nghị điều phối ngay
- Dựa trên tổ hợp: VC%, LOS dự báo, và xu hướng so với tuần trước

---

### 3.4 Độ tin cậy dự báo (Confidence)

**[Lớp 1 — Tóm tắt]**
> Confidence cho biết mức độ "chắc chắn" của dự báo — dự báo với confidence thấp nên được kiểm tra thêm trước khi ra quyết định.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột Độ tin cậy), Trang Hiệu suất mô hình
- Confidence thấp thường xảy ra khi:
  - Camera bị mất tín hiệu tạm thời (ít ảnh đầu vào)
  - Điều kiện thời tiết xấu ảnh hưởng nhận dạng
  - Giá trị lưu lượng bất thường (sự kiện đặc biệt)

**[Lớp 3 — Kỹ thuật, collapsible]**
```
Prediction Confidence = input_sample_count / lag_sample_count
(tỷ lệ số ảnh thực tế có được / số ảnh kỳ vọng trong window)

Ngưỡng: < 0.5 = Low, 0.5–0.8 = Medium, > 0.8 = High
```

---

### 3.5 So sánh với trung bình tuần (Δ vs Week Avg)

**[Lớp 1 — Tóm tắt]**
> Chỉ số này cho biết lưu lượng hiện tại đang cao hay thấp hơn bao nhiêu phần trăm so với cùng khung giờ trong tuần trước.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột Δ Tuần trước)
- Giúp phân biệt tình trạng bình thường với bất thường:
  - **+20%** → Hôm nay đông hơn hẳn, cần kiểm tra nguyên nhân
  - **-15%** → Vắng hơn bình thường (nghỉ lễ, mưa lớn, ...)
  - **≈0%** → Đúng pattern thông thường

---

### 3.6 Sai số dự báo (Error %)

**[Lớp 1 — Tóm tắt]**
> Sau khi có số thực tế, hệ thống tính % sai lệch giữa dự báo và thực tế — số này càng nhỏ càng tốt.

**[Lớp 2 — Ngữ cảnh]**
- Xuất hiện ở: Tab Dự báo (cột Sai số %), bảng lịch sử dự báo
- Chỉ hiển thị khi "Thực tế" đã có (sau khi thời điểm dự báo đã qua)
- Kinh nghiệm đọc: Error% < 10% = tốt, 10–20% = chấp nhận được, > 20% = cần xem xét

**[Lớp 3 — Kỹ thuật, collapsible]**
```
Error% = |predicted - actual| / actual × 100
Chính là: MAPE tại 1 điểm dự báo đơn lẻ
```

---

### 4.1–4.4 Các chỉ số hiệu suất mô hình (MAE, MAPE, R², RMSE)

**[Lớp 1 — Tóm tắt (chung cho cả nhóm)]**
> Đây là 4 thước đo khoa học để đánh giá mô hình dự báo học máy hoạt động tốt đến đâu. Chúng xuất hiện trong trang Hiệu suất mô hình.

#### MAE — Sai số trung bình tuyệt đối

**[Lớp 2]**
- Ý nghĩa thực tế: "Trung bình mỗi lần dự báo, model sai bao nhiêu xe"
- Ví dụ: MAE = 3.5 → dự báo thường lệch ±3.5 xe so với thực tế
- Số càng nhỏ càng tốt; không có đơn vị % nên phụ thuộc quy mô lưu lượng

**[Lớp 3 — collapsible]**
```
MAE = (1/n) × Σ|yᵢ - ŷᵢ|
yᵢ: Giá trị thực, ŷᵢ: Giá trị dự báo
```

#### MAPE — Phần trăm sai số tuyệt đối

**[Lớp 2]**
- Ý nghĩa thực tế: "Trung bình sai bao nhiêu %"
- Dễ so sánh giữa các camera vì là đơn vị %
- MAPE < 10% = tốt, 10–20% = chấp nhận, > 20% = model cần cải thiện

**[Lớp 3 — collapsible]**
```
MAPE = (1/n) × Σ(|yᵢ - ŷᵢ| / yᵢ) × 100
Hạn chế: Không ổn định khi yᵢ gần 0 (đường vắng đêm khuya)
```

#### R² — Hệ số xác định (R-squared)

**[Lớp 2]**
- Ý nghĩa thực tế: "Mô hình giải thích được bao nhiêu % biến động của lưu lượng"
- Thang điểm 0–1: R² = 0.85 nghĩa là model giải thích được 85% sự biến động
- R² > 0.8 = tốt, 0.6–0.8 = khá, < 0.6 = kém
- **Chú ý**: R² cao không đảm bảo dự báo chính xác tuyệt đối — cần xem cùng MAPE

**[Lớp 3 — collapsible]**
```
R² = 1 - (SS_res / SS_tot)
SS_res = Σ(yᵢ - ŷᵢ)²
SS_tot = Σ(yᵢ - ȳ)²
```

#### RMSE — Sai số bình phương gốc

**[Lớp 2]**
- Tương tự MAE nhưng **phạt nặng hơn cho những dự báo sai lớn**
- Nếu RMSE >> MAE: mô hình hay sai rất nhiều trong một số trường hợp đặc biệt
- Dùng để so sánh độ ổn định giữa các model phiên bản khác nhau

**[Lớp 3 — collapsible]**
```
RMSE = √[(1/n) × Σ(yᵢ - ŷᵢ)²]
```

---

## UI Layout & Component Spec

### Tổng thể layout

```
╔═══════════════════════════════════════════════════════╗
║  [PageHeader] Tài liệu hướng dẫn                      ║
║  ────────────────────────────────────────────────────  ║
║  [SearchBar] 🔍 Tìm kiếm thuật ngữ...                ║
╚═══════════════════════════════════════════════════════╝

╔═══════════════╦═══════════════════════════════════════╗
║  SIDEBAR NAV  ║  ARTICLE CONTENT                     ║
║  ─────────    ║  ─────────────────────────────────── ║
║  1. Tổng quan ║  # Tiêu đề mục                       ║
║  2. Dashboard ║                                       ║
║    > LOS ●   ║  [Summary badge]                     ║
║    > GTI     ║  Giải thích ngữ cảnh...              ║
║  3. Dự báo   ║                                       ║
║    > Horizon ║  ┌─ Chi tiết kỹ thuật ▼ ──────────┐  ║
║    > VC%     ║  │ Công thức...                    │  ║
║    > Rủi ro  ║  └─────────────────────────────────┘  ║
║  4. Mô hình  ║                                       ║
║    > MAE     ║  [prev] ← 2.2 GTI  │  3.2 VC% → [next]║
║    > MAPE    ║                                       ║
║    > R²      ║                                       ║
╚═══════════════╩═══════════════════════════════════════╝
```

### Components cần tạo mới

| Component | Mô tả |
|-----------|-------|
| `DocumentationSidebar` | Nav tree có active state, collapse section |
| `ArticleSection` | Container một bài viết, gồm header + body |
| `TechDetailCollapsible` | Wrapper collapsible cho lớp 3 — công thức |
| `LOSBadgeGroup` | Render 5 badge LOS kèm tooltip ngưỡng |
| `TermSearchBar` | Search fulltext qua article content |
| `ArticlePagination` | Prev/Next navigation cuối bài |

### Components tái sử dụng từ existing

- `<Badge>` + LOS color từ `UI_STYLE_GUIDE.md` cho bảng cấp độ LOS
- `<Collapsible>` từ Shadcn UI cho lớp 3 kỹ thuật  
- `<PageHeader>` từ `@/components/custom/page-header`
- `<HighlightText>` từ `@/components/highlight-text` cho search result

---

## Responsive & Accessibility

- **Mobile**: Sidebar collapse thành dropdown hoặc hamburger
- **Dark mode**: Công thức trong collapsible dùng `code` block với `bg-muted`
- **Đọc trực tiếp**: Không require scroll dài — mỗi article tối đa 400 words
- **Anchor link**: Mỗi section có `id` để deep link từ tooltip trong app (tương lai)

---

## Liên kết tương lai (Out of scope hiện tại)

- **Tooltip "?" inline trong app** — Khi hover vào badge LOS trong Dashboard → mở article 2.1 trực tiếp
- **Glossary page** — Danh sách tất cả thuật ngữ A–Z sau khi có đủ nội dung
- **Video hướng dẫn** — Embed clip ngắn giải thích trực quan

---

## Kiến trúc CMS — Scalable Dynamic Content

> **Quyết định thiết kế**: Nội dung **không hardcode** trong TypeScript files mà lưu vào PostgreSQL.
> Kỹ thuật viên chỉnh sửa trực tiếp từ giao diện, không cần deploy lại app.

### Luồng dữ liệu

```
┌────────────────────────┐     CRUD API      ┌─────────────────────────┐
│  Frontend Help Page    │ ◄───────────────► │  Backend /api/help      │
│                        │                   │  requireAuth (GET)      │
│  [Viewer mode]         │                   │  requireTechnician      │
│    └─ Read-only        │                   │    (POST/PUT/DELETE)    │
│                        │                   │  + logActivity()        │
│  [Technician mode]     │                   └──────────┬──────────────┘
│    └─ Edit toolbar     │                              │
│    └─ Inline editor    │                   ┌──────────▼──────────────┐
│    └─ Add/Delete btns  │                   │  PostgreSQL             │
└────────────────────────┘                   │  help_articles table    │
                                             └─────────────────────────┘
```

---

### Database — Bảng `help_articles`

```sql
-- Thêm vào DATABASE_SCHEMA.md
CREATE TABLE IF NOT EXISTS help_articles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key     VARCHAR(100) NOT NULL,       -- 'los', 'gti', 'horizon', 'mae', ...
    parent_key      VARCHAR(100),                -- NULL = section gốc, có giá trị = mục con
    title           VARCHAR(255) NOT NULL,       -- Tiêu đề hiển thị
    summary         TEXT NOT NULL,               -- Lớp 1: 1 câu tóm tắt
    content         TEXT NOT NULL,               -- Lớp 2: Giải thích ngữ cảnh (Markdown)
    tech_detail     TEXT,                        -- Lớp 3: Chi tiết kỹ thuật (Markdown, ẩn trong collapsible)
    sort_order      INTEGER DEFAULT 0,           -- Thứ tự trong sidebar
    is_published    BOOLEAN DEFAULT TRUE,        -- Ẩn/hiện bài không cần xóa
    created_by      INTEGER REFERENCES technician_accounts(id),
    updated_by      INTEGER REFERENCES technician_accounts(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(section_key)
);

CREATE INDEX idx_help_articles_parent ON help_articles(parent_key, sort_order);
CREATE INDEX idx_help_articles_published ON help_articles(is_published, sort_order);
```

**Tại sao lưu `content` dạng Markdown TEXT?**
- Flexible: hỗ trợ bảng, code block, bold/italic mà không cần JSONB phức tạp
- Render bằng `react-markdown` ở frontend, dễ đọc khi debug thẳng trong DB
- Dễ import/export bulk nếu cần seed dữ liệu ban đầu

---

### Backend API — `/api/help`

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `GET` | `/api/help/articles` | `requireAuth` | Lấy tất cả articles (published, sorted) |
| `GET` | `/api/help/articles/:sectionKey` | `requireAuth` | Lấy 1 article theo key |
| `POST` | `/api/help/articles` | `requireTechnician` | Tạo article mới |
| `PUT` | `/api/help/articles/:id` | `requireTechnician` | Cập nhật article |
| `PATCH` | `/api/help/articles/:id/publish` | `requireTechnician` | Toggle is_published |
| `DELETE` | `/api/help/articles/:id` | `requireTechnician` | Xóa article |
| `PUT` | `/api/help/articles/reorder` | `requireTechnician` | Cập nhật sort_order (drag & drop) |

- Tất cả write operations đều thêm `logActivity('HELP_ARTICLE_*', section_key)`
- Response format nhất quán với các API hiện tại: `{ success, data, message }`

---

### Frontend — Role-aware Edit Mode

#### Logic hiển thị toolbar

```
isTechnician = auth.role === 'technician'

[Viewer]        → Article hiển thị bình thường, không có toolbar
[Technician]    → Hiện Edit Bar phía trên mỗi article:
                  [✏️ Chỉnh sửa]  [👁 Ẩn/Hiện]  [🗑️ Xóa]  [+ Thêm mục]
```

#### Inline Editor UX

```
┌────────────────────────────────────────────────────────┐
│  ┌─ Edit Bar (technician only) ──────────────────────┐ │
│  │  [✏️ Đang chỉnh sửa: "Cấp độ dịch vụ (LOS)"]    │ │
│  │  [💾 Lưu]  [✖️ Hủy]  [👁 Xem trước]              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Tóm tắt:  [_____________________________________ ]      │
│  Nội dung: [  Markdown editor (textarea + preview) ]     │
│            [  với toolbar: Bold, Italic, Code, Table ]   │
│  Kỹ thuật: [  (collapsible, cũng editable)          ]   │
└────────────────────────────────────────────────────────┘
```

- Dùng `textarea` thô + live `react-markdown` preview side-by-side
- **Không** dùng WYSIWYG nặng (Slate, Tiptap) — quá phức tạp cho scope này
- Auto-save draft vào `localStorage` mỗi 30 giây (tránh mất nội dung)
- Hiện diff badge: `[Chưa lưu •]` khi có thay đổi chưa lưu

#### Add Article Flow

```
[+ Thêm mục] → Modal:
  ├─ Chọn vị trí: Mục cha / Trong section nào
  ├─ Nhập section_key (unique, slug format)
  ├─ Nhập tiêu đề
  └─ [Tạo] → Mở ngay vào inline editor
```

---

### Seed dữ liệu ban đầu

Nội dung từ design doc này được seed vào DB lần đầu qua migration script:

```
backend/server/src/migrations/
└── seed-help-articles.ts   ← Chạy 1 lần sau khi tạo table
    (Import toàn bộ articles từ design doc này)
```

Sau khi seed, mọi cập nhật thực hiện qua UI — migration chỉ chạy 1 lần.

---

## Files cần tạo khi implement

```
── Backend
backend/server/src/
├── routes/help.api.ts                          ← CRUD routes
├── controllers/help.controller.ts             ← Query logic
└── migrations/
    ├── 013_create_help_articles.ts            ← DDL migration
    └── seed-help-articles.ts                  ← Seed nội dung ban đầu

── Frontend
web/src/
├── pages/help.tsx                             ← Refactor: tích hợp layout + role mode
├── services/help.service.ts                   ← API calls cho help CRUD
└── components/help/
    ├── documentation-sidebar.tsx              ← Nav tree (với Add button nếu technician)
    ├── article-view.tsx                       ← Render Markdown + collapsible lớp 3
    ├── article-editor.tsx                     ← Inline editor (textarea + preview)
    ├── article-edit-bar.tsx                   ← Toolbar: Lưu/Hủy/Preview/Ẩn/Xóa
    ├── add-article-modal.tsx                  ← Modal tạo article mới
    ├── tech-detail-collapsible.tsx            ← Collapsible lớp 3 (shared)
    ├── los-badge-group.tsx                    ← 5 LOS badges (static component)
    ├── term-search-bar.tsx                    ← Search fulltext qua article content
    └── article-pagination.tsx                ← Prev/Next navigation
```

---

*Tài liệu này là nguồn thiết kế cho phần "Tài liệu hướng dẫn" — cập nhật khi thêm trang/tính năng mới vào app.*
