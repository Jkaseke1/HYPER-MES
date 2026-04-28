-- Extend pending_approvals view to include macropack manufacture orders
-- Macropack orders have two pending stages: PENDING_RM and PENDING_SUPERVISOR

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
WHERE status = 'in_progress'

UNION ALL

SELECT
  'macropack_order' as entity_type,
  mmo.id as entity_id,
  mb.macropack_code as entity_number,
  mb.macropack_name as entity_name,
  mmo.status,
  mmo.created_at,
  mmo.submitted_by as created_by,
  NULL::uuid as branch_id
FROM macropack_manufacture_orders mmo
JOIN macropack_boms mb ON mb.id = mmo.macropack_bom_id
WHERE mmo.status IN ('PENDING_RM', 'PENDING_SUPERVISOR');

GRANT SELECT ON pending_approvals TO authenticated;
