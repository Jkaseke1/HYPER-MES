-- Approval Workflow System
-- Audit trail for all approval actions across the MES

CREATE TABLE IF NOT EXISTS approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('grn', 'quality_inspection', 'production_order', 'dispatch_order', 'work_order', 'reconciliation_period')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'cancelled', 'reopened')),
  previous_status text,
  new_status text NOT NULL,
  approved_by uuid REFERENCES profiles(id),
  comments text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_history_entity ON approval_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_approved_by ON approval_history(approved_by);
CREATE INDEX IF NOT EXISTS idx_approval_history_created_at ON approval_history(created_at DESC);

-- RLS Policies
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval history" ON approval_history FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert approval history" ON approval_history FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Function to log approval actions
CREATE OR REPLACE FUNCTION log_approval_action(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_previous_status text,
  p_new_status text,
  p_approved_by uuid,
  p_comments text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  history_id uuid;
BEGIN
  INSERT INTO approval_history (entity_type, entity_id, action, previous_status, new_status, approved_by, comments)
  VALUES (p_entity_type, p_entity_id, p_action, p_previous_status, p_new_status, p_approved_by, p_comments)
  RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add approved_by and approved_at to tables that don't have them
ALTER TABLE goods_received_notes ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);
ALTER TABLE goods_received_notes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE goods_received_notes ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS rejection_reason text;

-- dispatch_orders already has approved_by, just add approved_at
ALTER TABLE dispatch_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE dispatch_orders ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add to reconciliation_periods
ALTER TABLE reconciliation_periods ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);
ALTER TABLE reconciliation_periods ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE reconciliation_periods ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create a view for pending approvals
CREATE OR REPLACE VIEW pending_approvals AS
SELECT 
  'grn' as entity_type,
  id as entity_id,
  grn_number as entity_number,
  'Goods Received Note' as entity_name,
  status,
  created_at,
  received_by as created_by,
  NULL::uuid as branch_id
FROM goods_received_notes
WHERE status = 'pending'

UNION ALL

SELECT 
  'quality_inspection' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  'Quality Inspection' as entity_name,
  result as status,
  created_at,
  inspector_id as created_by,
  NULL::uuid as branch_id
FROM quality_inspections
WHERE result = 'pending'

UNION ALL

SELECT 
  'production_order' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  'Production Order' as entity_name,
  status,
  created_at,
  operator_id as created_by,
  NULL::uuid as branch_id
FROM production_orders
WHERE status = 'pending'

UNION ALL

SELECT 
  'dispatch_order' as entity_type,
  id as entity_id,
  dispatch_number as entity_number,
  'Dispatch Order' as entity_name,
  status,
  created_at,
  prepared_by as created_by,
  branch_id
FROM dispatch_orders
WHERE status = 'pending'

UNION ALL

SELECT 
  'work_order' as entity_type,
  id as entity_id,
  wo_number as entity_number,
  'Maintenance Work Order' as entity_name,
  status,
  created_at,
  reported_by as created_by,
  branch_id
FROM maintenance_work_orders
WHERE status = 'open'

UNION ALL

SELECT 
  'reconciliation_period' as entity_type,
  id as entity_id,
  (month || '/' || year) as entity_number,
  'Reconciliation Period' as entity_name,
  status,
  created_at,
  NULL::uuid as created_by,
  branch_id
FROM reconciliation_periods
WHERE status = 'in_progress';

-- Grant access to the view
GRANT SELECT ON pending_approvals TO authenticated;

COMMENT ON TABLE approval_history IS 'Audit trail for all approval actions across the MES system';
COMMENT ON VIEW pending_approvals IS 'Unified view of all items pending approval across different modules';
