-- Verify that raw materials stock was updated after transfer approval

-- Check current stock for all materials
SELECT 
  id,
  code,
  name,
  current_stock,
  unit,
  updated_at
FROM raw_materials
ORDER BY updated_at DESC
LIMIT 10;

-- Check the approved transfers and their corresponding raw materials updates
SELECT 
  sm.id as transfer_id,
  sm.raw_material_id,
  rm.name as material_name,
  sm.quantity as transfer_quantity,
  rm.current_stock as current_material_stock,
  sm.status,
  sm.approved_at
FROM stock_movements sm
LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
WHERE sm.movement_type = 'transfer'
  AND sm.status = 'approved'
ORDER BY sm.approved_at DESC
LIMIT 10;

-- Specifically check Salt Coarse
SELECT 
  id,
  code,
  name,
  current_stock,
  unit
FROM raw_materials
WHERE code = 'SAC0001' OR name LIKE '%Salt%';
