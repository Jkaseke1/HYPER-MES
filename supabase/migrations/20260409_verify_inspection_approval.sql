-- Verify that the Quality Inspection approval workflow is working

-- Check the quality_inspections table for approved inspections
SELECT 
  id,
  grn_id,
  status,
  result,
  approved_by,
  approved_at,
  rejection_reason,
  created_at,
  updated_at
FROM quality_inspections
ORDER BY updated_at DESC
LIMIT 10;

-- Check the approval_history for Quality Inspection approvals
SELECT 
  ah.id,
  ah.entity_type,
  ah.entity_id,
  ah.action,
  ah.previous_status,
  ah.new_status,
  p.email as approved_by_email,
  ah.created_at
FROM approval_history ah
LEFT JOIN profiles p ON ah.approved_by = p.id
WHERE ah.entity_type = 'quality_inspection'
ORDER BY ah.created_at DESC
LIMIT 10;

-- Summary: Count inspections by status
SELECT 
  status,
  COUNT(*) as count
FROM quality_inspections
GROUP BY status
ORDER BY status;

-- Check if GRN has corresponding approved inspection
SELECT 
  grn.id as grn_id,
  grn.grn_number,
  qi.id as inspection_id,
  qi.status as inspection_status,
  qi.result,
  qi.approved_at,
  qi.approved_by
FROM goods_received_notes grn
LEFT JOIN quality_inspections qi ON grn.id = qi.grn_id
ORDER BY grn.created_at DESC
LIMIT 10;
