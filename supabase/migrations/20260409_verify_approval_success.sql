-- Verify that the approval was successful in the database

-- Check the stock_movements table for the approved transfer
SELECT 
  id,
  movement_type,
  status,
  approved_by,
  approved_at,
  rejection_reason,
  created_at,
  updated_at
FROM stock_movements
WHERE movement_type = 'transfer'
ORDER BY updated_at DESC
LIMIT 5;

-- Check the approval_history for the corresponding approval record
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
WHERE ah.entity_type = 'material_transfer'
ORDER BY ah.created_at DESC
LIMIT 5;

-- Summary: Count approvals by status
SELECT 
  status,
  COUNT(*) as count
FROM stock_movements
WHERE movement_type = 'transfer'
GROUP BY status;
