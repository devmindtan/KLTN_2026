-- Fix reports table to support guest users
-- Update existing table to make created_by nullable

-- Drop existing foreign key constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'reports_created_by_fkey'
    ) THEN
        ALTER TABLE reports DROP CONSTRAINT reports_created_by_fkey;
    END IF;
END $$;

-- Update created_by column to be nullable and allow existing data
ALTER TABLE reports ALTER COLUMN created_by DROP NOT NULL;

-- Add new foreign key constraint that allows NULL
ALTER TABLE reports 
ADD CONSTRAINT reports_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES technician_accounts(id) ON DELETE SET NULL;