-- Check the actual stock_movements table to see if status is being updated

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

-- Check specifically for the transfers that were approved
SELECT 
  id,
  movement_type,
  status,
  approved_by,
  approved_at
FROM stock_movements
WHERE id IN (
  'b7f1c87f-90f0-4a25-91e6-22d63ab6145a',
  'cb161913-2242-4acb-b875-d276aa74ecc8'
);
