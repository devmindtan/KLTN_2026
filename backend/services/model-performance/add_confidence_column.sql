-- Migration: Add confidence_distribution column to model_metrics_history
-- Date: 26/02/2026
-- Purpose: Thêm cột để lưu confidence distribution metrics

ALTER TABLE model_metrics_history 
ADD COLUMN IF NOT EXISTS confidence_distribution JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN model_metrics_history.confidence_distribution IS 
'Confidence distribution metrics: prediction confidence (input vs lag) and error confidence (input vs sync)';
