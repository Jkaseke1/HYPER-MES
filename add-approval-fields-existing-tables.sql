-- =====================================================
-- ADD APPROVAL WORKFLOW FIELDS TO EXISTING TABLES ONLY
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. FORMULATIONS - Add review and approval tracking
ALTER TABLE formulations 
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text DEFAULT '';

-- 2. GOODS RECEIVED NOTES - Add approval and rejection tracking
ALTER TABLE goods_received_notes 
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT '';

-- 3. PRODUCTION ORDERS - Add verification and cancellation tracking
ALTER TABLE production_orders 
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text DEFAULT '';

-- 4. DISPATCH ORDERS - Add delivery confirmation tracking
ALTER TABLE dispatch_orders 
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS delivery_confirmation_notes text DEFAULT '';

-- 5. CREATE APPROVAL AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS approval_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'submitted', 'reviewed', 'approved', 'rejected', 'cancelled', 'verified')),
  performed_by uuid REFERENCES profiles(id),
  previous_status text,
  new_status text,
  comments text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE approval_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read audit log" ON approval_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON approval_audit_log;

-- Create policies for audit log
CREATE POLICY "Authenticated users can read audit log" 
  ON approval_audit_log FOR SELECT 
  TO authenticated 
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert audit log" 
  ON approval_audit_log FOR INSERT 
  TO authenticated 
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON approval_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON approval_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON approval_audit_log(created_at);

-- 6. CREATE HELPER FUNCTION TO LOG APPROVALS
CREATE OR REPLACE FUNCTION log_approval_action(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_previous_status text,
  p_new_status text,
  p_comments text DEFAULT ''
)
RETURNS void AS $$
BEGIN
  INSERT INTO approval_audit_log (
    table_name,
    record_id,
    action,
    performed_by,
    previous_status,
    new_status,
    comments
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    (select auth.uid()),
    p_previous_status,
    p_new_status,
    p_comments
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify all columns were added
SELECT 
  'formulations' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'formulations' 
  AND column_name IN ('reviewed_by', 'reviewed_at', 'approved_at', 'approval_notes')
UNION ALL
SELECT 
  'goods_received_notes' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'goods_received_notes' 
  AND column_name IN ('approved_at', 'rejection_reason')
UNION ALL
SELECT 
  'production_orders' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'production_orders' 
  AND column_name IN ('verified_by', 'verified_at', 'cancelled_by', 'cancellation_reason')
UNION ALL
SELECT 
  'dispatch_orders' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'dispatch_orders' 
  AND column_name IN ('approved_at', 'delivered_by', 'delivery_confirmation_notes')
ORDER BY table_name, column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Approval workflow fields added successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update UI to show approval buttons and status';
  RAISE NOTICE '2. Implement role-based permission checks';
  RAISE NOTICE '3. Add validation rules for status transitions';
  RAISE NOTICE '4. Test approval workflows with sample data';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: reconciliation_periods table not found - will be added when that feature is implemented';
END $$;
