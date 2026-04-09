-- Check material transfer status in database
-- Run this to see the actual status values stored

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
ORDER BY created_at DESC
LIMIT 10;

-- Also check approval history for these transfers
SELECT 
  ah.id,
  ah.entity_type,
  ah.entity_id,
  ah.action,
  ah.previous_status,
  ah.new_status,
  ah.approved_by,
  ah.created_at
FROM approval_history ah
WHERE ah.entity_type = 'material_transfer'
ORDER BY ah.created_at DESC
LIMIT 10;
