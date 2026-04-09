-- Check all Salt Coarse transfers (approved and pending)

SELECT 
  sm.id,
  sm.raw_material_id,
  rm.name,
  sm.quantity,
  sm.status,
  sm.approved_at,
  sm.movement_type,
  sm.created_at
FROM stock_movements sm
LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
WHERE rm.code = 'SAC0001'
ORDER BY sm.created_at DESC;

-- Check total approved transfer quantity for Salt Coarse
SELECT 
  rm.name,
  rm.code,
  SUM(sm.quantity) as total_approved_quantity
FROM stock_movements sm
LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
WHERE rm.code = 'SAC0001'
  AND sm.status = 'approved'
  AND sm.movement_type = 'transfer'
GROUP BY rm.id, rm.name, rm.code;

-- Check all stock movements to understand the pattern
SELECT 
  movement_type,
  status,
  COUNT(*) as count,
  SUM(quantity) as total_quantity
FROM stock_movements
GROUP BY movement_type, status
ORDER BY movement_type, status;
