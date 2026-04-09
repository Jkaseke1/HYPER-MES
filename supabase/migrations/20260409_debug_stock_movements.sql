-- Debug: Check all approved transfers for Salt Coarse

SELECT 
  sm.id,
  sm.raw_material_id,
  rm.name,
  sm.quantity,
  sm.status,
  sm.approved_at,
  sm.movement_type
FROM stock_movements sm
LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
WHERE rm.code = 'SAC0001'
  AND sm.movement_type = 'transfer'
ORDER BY sm.created_at DESC;

-- Check if there are any approved transfers at all
SELECT 
  COUNT(*) as total_approved_transfers,
  SUM(CASE WHEN movement_type = 'transfer' THEN quantity ELSE 0 END) as total_transfer_quantity
FROM stock_movements
WHERE status = 'approved'
  AND movement_type = 'transfer';

-- Check the raw_materials current_stock history
SELECT 
  id,
  code,
  name,
  current_stock,
  updated_at
FROM raw_materials
WHERE code = 'SAC0001'
ORDER BY updated_at DESC
LIMIT 5;
