# Thiết kế Hệ thống Báo cáo Thông minh (Smart Reports)

> **Ngày cập nhật**: 19/03/2026  
> **Trạng thái**: Kế hoạch thiết kế – Sẵn sàng implement
> **Mục tiêu**: Báo cáo phân tích hoàn chỉnh cho cấp quản lý + Dữ liệu sẵn sàng cho AI

---

## 🎯 Tổng quan Hệ thống

### Mục đích chính:
1. **Báo cáo cho Cấp trên**: Tài liệu PDF có phân tích, biểu đồ, khuyến nghị
2. **Dữ liệu cho AI**: File XLSX có cấu trúc chuẩn, sẵn sàng machine processing
3. **Khác biệt với "Dữ liệu giao thông"**: Đã được phân tích hoàn chỉnh, không còn dữ liệu thô

### Kiến trúc tổng quan:
```
Frontend (React) → Backend API (Node.js) → Report Generator (Python) → MinIO Storage
     ↓                   ↓                         ↓                      ↓
- UI tạo/quản lý    - Validate request      - Tạo PDF + XLSX       - Store files  
- Download báo cáo  - Schedule/queue        - Template system       - Serve downloads
- Lịch sử audit     - Track progress        - Data aggregation      - Backup/retention
```

---

## 📊 Cấu trúc Dữ liệu Báo cáo

### 1. Report Metadata
```typescript
interface ReportMetadata {
  id: string;
  title: string;
  type: "daily" | "weekly" | "monthly" | "quarterly" | "custom" | "incident";
  period: {
    from: string;       // ISO date
    to: string;
    label: string;      // "Ngày 17/05/2025", "Tuần 19-25/05"
  };
  createdAt: string;
  status: "pending" | "generating" | "ready" | "failed";
  files: {
    pdf: { path: string; sizeMB: number; url: string; };
    xlsx: { path: string; sizeMB: number; url: string; };
  };
  summary: AnalyzedSummary;  // Kết quả phân tích đã xử lý
  settings: ReportSettings;
}
```

### 2. Analyzed Summary (Dữ liệu đã phân tích)
```typescript
interface AnalyzedSummary {
  overview: {
    totalVehicles: number;
    avgDensityScore: number;      // 0-5 scale
    peakHours: { hour: string; volume: number; severity: "low"|"medium"|"high" }[];
    incidentCount: number;
    weatherImpact: "none" | "low" | "medium" | "high";
  };
  performance: {
    modelAccuracy: number;        // %
    predictionConfidence: number; // %
    dataQuality: "poor" | "fair" | "good" | "excellent";
    coveragePercentage: number;   // % thời gian có dữ liệu
  };
  insights: {
    trends: string[];            // ["Lưu lượng tăng 12% so với tuần trước"]
    anomalies: string[];         // ["Ùn tắc bất thường 14:30 Camera-03"]
    recommendations: string[];   // ["Cân nhắc tăng cường tuần tra 17-19h"]
  };
  camerasAnalysis: {
    cameraId: string;
    name: string;
    totalVehicles: number;
    avgVehiclePerHour: number;
    peakDensity: number;
    incidentCount: number;
    reliability: number;         // % uptime
    riskLevel: "low" | "medium" | "high";  // Dựa trên mật độ + incident
  }[];
}
```

---

## 🎨 Frontend Enhancements

### Current → Enhanced
```
Tab "Báo cáo" (hiện tại):        →    Tab "Báo cáo" (nâng cấp):
- List/Grid view                      - Advanced filters + templates
- Status filter                      - Batch operations 
- Basic search                       - Xuất đồng thời PDF + XLSX

Tab "Lịch sử" (hiện tại):      →    Tab "Lịch sử" (nâng cấp): 
- Simple audit table                 - Detailed activity tracking
                                     - User performance metrics

                                     Tab "Tự động hóa" (MỚI):
                                     - Scheduled reports
                                     - Email notifications  
                                     - Template management
```

### Key UI Features:
1. **Report Template Selector**: Chọn template (Hàng ngày, Hàng tuần, Sự cố...)
2. **Advanced Period Picker**: Calendar với preset (Hôm qua, 7 ngày, Tháng này...)
3. **Dual Download Button**: 1 click → tải cả PDF + XLSX
4. **Live Progress Bar**: Real-time tracking khi generate báo cáo
5. **Preview Mode**: Xem summary trước khi tạo file

---

## 🔧 Backend Architecture

### 1. API Endpoints (Node.js)
```typescript
// === CRUD Reports ===
GET /api/reports                          // List với pagination, filter
GET /api/reports/:id                      // Chi tiết + download links  
POST /api/reports/generate                // Tạo báo cáo mới
PUT /api/reports/:id/regenerate           // Tạo lại nếu failed
DELETE /api/reports/:id                   // Xóa báo cáo (soft delete)

// === Download ===
GET /api/reports/:id/download/pdf         // Stream PDF file
GET /api/reports/:id/download/xlsx        // Stream XLSX file
GET /api/reports/:id/download/both        // ZIP chứa cả 2 files

// === Templates & Automation ===
GET /api/report-templates                 // Danh sách templates
POST /api/report-schedules                // Tạo lịch xuất báo cáo tự động
GET /api/report-schedules                 // Quản lý lịch
```

### 2. Report Generator Service (Python)
**File:** `backend/services/report-generator/app/`

```python
# main.py - Entry point
def generate_report(report_config: ReportConfig) -> ReportResult:
    """Orchestrate toàn bộ quy trình tạo báo cáo"""
    # 1. Data collection & validation
    # 2. Analytics processing  
    # 3. PDF generation (jinja2 + weasyprint)
    # 4. XLSX export (pandas + sklearn metrics)
    # 5. Upload to MinIO
    # 6. Update database status

# analytics_engine.py - Core logic
def analyze_traffic_data(period_data: pd.DataFrame) -> AnalyzedSummary:
    """Chuyển raw data thành analyzed insights"""
    # Traffic pattern analysis
    # Peak hour detection  
    # Anomaly detection
    # Performance metrics calculation
    # Recommendation engine

# pdf_generator.py - Document creation  
def create_executive_summary_pdf(summary: AnalyzedSummary) -> bytes:
    """Tạo PDF báo cáo cho cấp quản lý""" 
    # Jinja2 templates với charts (matplotlib)
    # Executive summary page
    # Detailed analytics pages
    # Visual charts & tables

# xlsx_exporter.py - Data for AI
def create_structured_data_xlsx(summary: AnalyzedSummary) -> bytes:
    """Tạo XLSX chuẩn cho AI processing"""
    # Multiple sheets: Overview, TimeSeries, Cameras, Metrics
    # Standardized column names
    # Clean data types
    # Metadata sheet với schema description
```

### 3. Database Schema Additions
```sql
-- Báo cáo metadata table
CREATE TABLE reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('daily','weekly','monthly','quarterly','custom','incident')),
    period_from   DATE NOT NULL,
    period_to     DATE NOT NULL,
    status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
    files_json    JSONB,  -- {pdf: {path, sizeMB, url}, xlsx: {path, sizeMB, url}}
    summary_json  JSONB,  -- AnalyzedSummary object
    settings_json JSONB,  -- ReportSettings (filters, templates, etc.)
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    generated_at  TIMESTAMPTZ,
    error_message TEXT
);

-- Báo cáo templates
CREATE TABLE report_templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    name          VARCHAR(100) NOT NULL,
    type          VARCHAR(20) NOT NULL,
    config_json   JSONB,  -- Template configuration
    is_default    BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Lịch xuất tự động
CREATE TABLE report_schedules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    template_id  UUID REFERENCES report_templates(id),
    cron_expr    VARCHAR(50) NOT NULL,  -- "0 9 * * 1" (Every Monday 9AM)
    enabled      BOOLEAN DEFAULT TRUE,
    last_run     TIMESTAMPTZ,
    next_run     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📋 Kịch bản Thực hiện (Implementation Scenario)

### 🎬 Scenario 1: Tạo báo cáo hàng tuần (User workflow)

**[User Story]**: Quản lý muốn báo cáo tổng hợp tuần 11-17/03/2026 cho Ban giám đốc

**[Frontend Flow]**:
1. User click "Tạo báo cáo" → Open dialog
2. Chọn template "Báo cáo tuần" → Auto-fill settings
3. Chọn period "11-17 Tháng 3, 2026" → Validate có dữ liệu
4. Preview summary: "156,000 xe, mật độ peak: Thứ 6 17h, 3 sự cố"
5. Click "Tạo báo cáo" → Show progress "Đang phân tích dữ liệu..."

**[Backend Processing]**:
1. **API**: Validate request, tạo DB record status="generating"
2. **Queue**: Trigger report-generator service
3. **Analytics**: Query raw data → chạy algorithms → summary metrics
4. **PDF**: Jinja2 render → HTML → WeasyPrint → PDF bytes
5. **XLSX**: pandas DataFrame → styled sheets → XLSX bytes  
6. **Storage**: Upload files to MinIO, get URLs
7. **Complete**: Update DB status="ready", files metadata

**[User Result]**:
1. Notification "Báo cáo đã sẵn sàng"
2. Email với download links (optional)  
3. Files: `Weekly_Report_2026-03-11_to_2026-03-17.pdf` + `.xlsx`

### 🎬 Scenario 2: Tự động báo cáo hàng ngày (Automated flow)

**[Cron Schedule]**: `0 7 * * *` (7 AM mỗi ngày)

**[Process Flow]**:
1. **CronJob**: Check DB → "Tạo báo cáo ngày D-1"
2. **Auto-trigger**: Template "Báo cáo hàng ngày", period = yesterday
3. **Generate**: Tương tự Scenario 1 (no user interaction)
4. **Store**: Files saved với naming convention
5. **Notify**: Email/Slack notification đến team quản lý

---

## 🧩 Technical Stack

### Frontend Libraries:
```json
{
  "react-pdf": "Generate/preview PDF in browser",
  "xlsx": "Read/write XLSX files client-side",
  "date-fns": "Advanced date manipulation", 
  "recharts": "Charts for preview summaries",
  "@tanstack/react-query": "API state management"
}
```

### Backend Dependencies:
```python
# requirements.txt (report-generator service)
pandas>=2.0.0
jinja2>=3.1.0
weasyprint>=60.0
matplotlib>=3.7.0
sqlalchemy>=2.0.0  
boto3>=1.26.0
openpyxl>=3.1.0
python-dateutil>=2.8.0
```

### Infrastructure:
- **MinIO Bucket**: `reports/` (organized by year/month)
- **File Retention**: 12 months (configurable)
- **Backup**: Daily sync to external storage
- **CDN**: Cloudflare cho fast download

---

## 📈 Success Metrics & KPIs

### User Experience:
- **Generation Time**: < 3 phút với dải 1 tuần dữ liệu
- **Download Speed**: < 10 giây với báo cáo 5MB
- **User Satisfaction**: > 4.5/5 (internal survey)

### System Performance:  
- **Availability**: > 99.5% uptime  
- **Concurrent Reports**: Support 5 báo cáo đồng thời
- **Storage Efficiency**: < 50MB/report average

### Business Value:
- **Time Savings**: Giảm 80% thời gian tạo báo cáo thủ công
- **Data Accuracy**: > 95% accuracy với validated metrics
- **Decision Support**: Insights được sử dụng trong 90% meeting quản lý

---

## 🚀 Implementation Phases

### **Phase 1** - Core Report Engine (2 tuần)
- [ ] Python service: Data analytics + PDF/XLSX generation
- [ ] Node.js API: Basic CRUD endpoints  
- [ ] Database: Tables + migrations
- [ ] MinIO: Bucket setup + upload logic

### **Phase 2** - Frontend Integration (1 tuần)  
- [ ] Enhanced UI: Templates, period picker, progress tracking
- [ ] API integration: Create, download, track báo cáo
- [ ] Error handling: User feedback cho failed reports

### **Phase 3** - Automation & Polish (1 tuần)
- [ ] Scheduled reports: CronJob + email notifications
- [ ] Admin tools: Template management, system monitoring  
- [ ] Performance optimization: Caching, parallel processing

### **Phase 4** - Advanced Features (Future)
- [ ] Custom templates với drag-drop builder
- [ ] Real-time collaboration: Comments trên báo cáo
- [ ] AI-powered insights: Auto-detected patterns & recommendations
- [ ] Mobile responsive: View reports on tablets/phones

---

## 💡 Các Tính năng Đặc biệt

### 1. **Smart Template System**
- Pre-defined templates cho từng audience (Technical, Executive, Regulatory)
- Custom template builder với visual components
- Version control cho template changes

### 2. **Intelligent Insights Engine**
- Pattern recognition: Tự động phát hiện xu hướng
- Anomaly detection: Alert khi có bất thường  
- Predictive analysis: Dự báo potential issues

### 3. **Collaborative Features** 
- Comment system trên báo cáo
- Approval workflow cho báo cáo quan trọng
- Share links với permission control

### 4. **Integration Ready**
- API exports cho third-party systems
- Webhook notifications khi reports ready
- Single Sign-On với enterprise systems

---

*Successfully designed by AI Assistant - Ready for implementation! 🚀*


