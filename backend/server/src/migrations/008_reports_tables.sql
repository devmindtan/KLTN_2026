-- Reports System Tables
-- Created: 19/03/2026 for Smart Reports feature
-- Updated: 19/03/2026 - Removed templates/schedules (not used), enhanced constraints

-- Báo cáo metadata table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily','weekly','monthly','quarterly','custom','incident')),
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed','deleted')),
    files_json JSONB,  -- {pdf: {path, sizeMB, url}, xlsx: {path, sizeMB, url}}
    summary_json JSONB,  -- AnalyzedSummary object
    settings_json JSONB,  -- ReportSettings (filters, hour_from, hour_to, etc.)
    created_by UUID,  -- NULL for guest users, references technicians for logged users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT fk_reports_created_by FOREIGN KEY (created_by) REFERENCES technician_accounts(id) ON DELETE SET NULL,
    CONSTRAINT chk_period_range CHECK (period_to >= period_from)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status) WHERE status != 'deleted';
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by) WHERE created_by IS NOT NULL;

-- Activity logs integration note:
-- Report actions (CREATE_REPORT, DELETE_REPORT, DOWNLOAD_PDF, DOWNLOAD_XLSX, DOWNLOAD_ZIP) 
-- are logged in the `activity_logs` table (defined in 001_auth_tables.sql)
-- Query: SELECT * FROM activity_logs WHERE resource = 'reports' ORDER BY created_at DESC;