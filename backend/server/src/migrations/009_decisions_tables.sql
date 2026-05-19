-- Decision-Making System Tables
-- Created: 18/05/2026 for DecisionMaker feature
-- Stores recommendations and analysis results for traffic management

-- Main decisions table
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Decision metadata
    category VARCHAR(50) NOT NULL CHECK (category IN ('congestion','predictive','optimization','quality','monitoring')),
    title VARCHAR(255) NOT NULL,
    recommendation TEXT NOT NULL,
    rationale TEXT NOT NULL,
    
    -- Scoring (0-100 scale)
    score_impact NUMERIC(5,2) NOT NULL,          -- How much will this improve traffic?
    score_confidence NUMERIC(5,2) NOT NULL,      -- How sure are we?
    score_urgency NUMERIC(5,2) NOT NULL,         -- How time-critical?
    score_compound NUMERIC(5,2) NOT NULL,        -- Weighted average (40% impact, 35% confidence, 25% urgency)
    
    -- Affected entities
    camera_ids JSONB NOT NULL DEFAULT '[]',      -- string[] of affected camera IDs
    route_id UUID,                               -- if route-specific
    
    -- Evidence & actions
    evidence JSONB NOT NULL DEFAULT '{}',        -- {historicalData, forecastData, modelMetrics, currentStatus}
    action_items JSONB NOT NULL DEFAULT '[]',    -- [{action: string, actor: 'technician'|'driver'|'system', timeToAction: 'immediate'|'soon'|'planned'}]
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','implemented','dismissed')),
    reviewed_by UUID,                            -- technician user_id
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,
    
    -- Metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,                 -- When is this decision no longer valid?
    created_by VARCHAR(50) NOT NULL DEFAULT 'system',  -- 'system' or technician email
    
    -- Constraints
    CONSTRAINT chk_scores_range CHECK (
        score_impact >= 0 AND score_impact <= 100 AND
        score_confidence >= 0 AND score_confidence <= 100 AND
        score_urgency >= 0 AND score_urgency <= 100 AND
        score_compound >= 0 AND score_compound <= 100
    ),
    CONSTRAINT fk_decisions_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES technician_accounts(id) ON DELETE SET NULL
);

-- Indexes for performance
-- Ensure camera_ids is JSONB (upgrade if table was previously created with JSON type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions'
      AND column_name = 'camera_ids'
      AND data_type = 'json'
  ) THEN
    ALTER TABLE decisions ALTER COLUMN camera_ids TYPE JSONB USING camera_ids::JSONB;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status) WHERE status NOT IN ('dismissed');
CREATE INDEX IF NOT EXISTS idx_decisions_category ON decisions(category);
CREATE INDEX IF NOT EXISTS idx_decisions_generated_at ON decisions(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_compound_score ON decisions(score_compound DESC) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_decisions_camera_ids ON decisions USING GIN(camera_ids);
CREATE INDEX IF NOT EXISTS idx_decisions_reviewed_by ON decisions(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_created_by ON decisions(created_by);

-- Activity logs integration note:
-- Decision actions (CREATE_DECISION, REVIEW_DECISION, IMPLEMENT_DECISION) 
-- should be logged in the `activity_logs` table (defined in 001_auth_tables.sql)
-- Query: SELECT * FROM activity_logs WHERE resource = 'decisions' ORDER BY created_at DESC;
