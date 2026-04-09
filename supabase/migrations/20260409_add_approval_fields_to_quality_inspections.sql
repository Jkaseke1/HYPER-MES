-- Add approval workflow fields to quality_inspections table
-- This enables the approval system to work with quality inspections

ALTER TABLE quality_inspections
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'conditional')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_quality_inspections_status ON quality_inspections(status);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_approved_by ON quality_inspections(approved_by);

-- Update existing records to sync result to status if status is null
UPDATE quality_inspections
SET status = result
WHERE status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN quality_inspections.status IS 'Current approval status: pending, passed, failed, or conditional';
COMMENT ON COLUMN quality_inspections.approved_by IS 'User ID of the person who approved/rejected the inspection';
COMMENT ON COLUMN quality_inspections.approved_at IS 'Timestamp when the inspection was approved or rejected';
COMMENT ON COLUMN quality_inspections.rejection_reason IS 'Reason for rejection if the inspection was rejected';
