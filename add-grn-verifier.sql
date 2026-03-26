-- =====================================================
-- ADD VERIFIER TO GOODS RECEIVED NOTES (GRN)
-- This adds an additional verification step for raw material receiving
-- =====================================================

-- Add verifier tracking to GRN
ALTER TABLE goods_received_notes 
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text DEFAULT '';

-- Update the status check constraint to include 'verified' status
-- First, drop the existing constraint
ALTER TABLE goods_received_notes 
  DROP CONSTRAINT IF EXISTS goods_received_notes_status_check;

-- Add the new constraint with 'verified' status
ALTER TABLE goods_received_notes 
  ADD CONSTRAINT goods_received_notes_status_check 
  CHECK (status IN ('pending', 'inspecting', 'verified', 'approved', 'rejected'));

-- Verify the columns were added
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'goods_received_notes' 
  AND column_name IN ('verified_by', 'verified_at', 'verification_notes', 'approved_at', 'rejection_reason')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'GRN Verifier fields added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated GRN Approval Flow:';
  RAISE NOTICE '1. Created by: Warehouse Clerk (Pending)';
  RAISE NOTICE '2. Quality Inspection: Quality Inspector (Inspecting)';
  RAISE NOTICE '3. Verified by: Warehouse Supervisor (Verified) - NEW STEP';
  RAISE NOTICE '4. Approved by: Warehouse Manager (Approved/Rejected)';
  RAISE NOTICE '';
  RAISE NOTICE 'Business Rules:';
  RAISE NOTICE '- GRN must pass quality inspection before verification';
  RAISE NOTICE '- Verification confirms quantities and documentation';
  RAISE NOTICE '- Only verified GRNs can be approved';
  RAISE NOTICE '- Stock updates only when status = Approved';
END $$;
