-- Reports System Tables
-- Created: 19/03/2026 for Smart Reports feature

-- Báo cáo metadata table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily','weekly','monthly','quarterly','custom','incident')),
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
    files_json JSONB,  -- {pdf: {path, sizeMB, url}, xlsx: {path, sizeMB, url}}
    summary_json JSONB,  -- AnalyzedSummary object
    settings_json JSONB,  -- ReportSettings (filters, templates, etc.)
    created_by UUID,  -- NULL for guest users, references technicians for logged users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ,
    error_message TEXT,
    FOREIGN KEY (created_by) REFERENCES technician_accounts(id) ON DELETE SET NULL
);

-- Báo cáo templates
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    config_json JSONB,  -- Template configuration
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lịch xuất tự động  
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    template_id UUID REFERENCES report_templates(id),
    cron_expr VARCHAR(50) NOT NULL,  -- "0 9 * * 1" (Every Monday 9AM)
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_from, period_to);