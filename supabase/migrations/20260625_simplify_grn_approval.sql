-- Simplify GRN approval to single Finance step
-- Remove two-step approval columns (rm_approved_by, rm_approved_at, accountant_approved_by, accountant_approved_at)
-- Add single approval columns (approved_by, approved_at)

-- Step 1: Add new simplified approval columns
ALTER TABLE goods_received_notes 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Step 2: Migrate existing approved GRNs - use accountant approval if exists, else rm approval
UPDATE goods_received_notes 
SET 
  approved_by = COALESCE(accountant_approved_by, rm_approved_by),
  approved_at = COALESCE(accountant_approved_at, rm_approved_at)
WHERE status = 'approved' AND approved_by IS NULL;

-- Step 3: Update any GRNs stuck in rm_approved status to pending (they need re-approval)
UPDATE goods_received_notes 
SET status = 'pending'
WHERE status = 'rm_approved';

-- Note: We keep the old columns for historical reference but they won't be used going forward
-- To fully remove them later, run:
-- ALTER TABLE goods_received_notes DROP COLUMN rm_approved_by, DROP COLUMN rm_approved_at, DROP COLUMN accountant_approved_by, DROP COLUMN accountant_approved_at;

-- Add comment for documentation
COMMENT ON COLUMN goods_received_notes.approved_by IS 'Finance user who approved the GRN (single-step approval)';
COMMENT ON COLUMN goods_received_notes.approved_at IS 'Timestamp when Finance approved the GRN';
