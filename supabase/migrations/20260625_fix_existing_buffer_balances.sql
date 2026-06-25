-- Fix existing In Buffer transfers that were not moved to Buffer Warehouse
-- Run this after 20260625_migrate_pending_transfers_to_buffer.sql

DO $$
DECLARE
  transfer_record RECORD;
  buffer_id uuid;
  has_buffer_movement boolean;
BEGIN
  -- Get Buffer Warehouse ID
  SELECT id INTO buffer_id FROM warehouses WHERE code = 'BUFFER' LIMIT 1;

  IF buffer_id IS NULL THEN
    RAISE EXCEPTION 'Buffer Warehouse not found.';
  END IF;

  -- Process each In Buffer transfer that does NOT have a buffer stock movement
  FOR transfer_record IN
    SELECT mt.id, mt.raw_material_id, mt.from_warehouse_id, mt.quantity, mt.requested_by
    FROM material_transfers mt
    WHERE mt.status = 'in_buffer'
  LOOP
    -- Check if this transfer already has a buffer receipt movement
    SELECT EXISTS (
      SELECT 1 FROM stock_movements
      WHERE reference_type = 'material_transfer'
        AND reference_id = transfer_record.id
        AND warehouse_id = buffer_id
        AND quantity > 0
    ) INTO has_buffer_movement;

    -- Skip if already moved
    IF has_buffer_movement THEN
      CONTINUE;
    END IF;

    -- Move stock from source warehouse to Buffer Warehouse
    PERFORM update_warehouse_balance(
      transfer_record.raw_material_id,
      transfer_record.from_warehouse_id,
      -transfer_record.quantity
    );

    PERFORM update_warehouse_balance(
      transfer_record.raw_material_id,
      buffer_id,
      transfer_record.quantity
    );

    -- Record stock movements
    INSERT INTO stock_movements (raw_material_id, movement_type, quantity, warehouse_id, reference_type, reference_id, notes, movement_date)
    VALUES
      (transfer_record.raw_material_id, 'transfer', -transfer_record.quantity, transfer_record.from_warehouse_id, 'material_transfer', transfer_record.id, 'Fix: RM Warehouse → Buffer Warehouse', CURRENT_DATE),
      (transfer_record.raw_material_id, 'transfer', transfer_record.quantity, buffer_id, 'material_transfer', transfer_record.id, 'Fix: Buffer Warehouse receipt', CURRENT_DATE);

  END LOOP;

END $$;

-- Verify buffer balances
SELECT 
  w.code AS warehouse,
  rm.name AS material,
  wsb.quantity
FROM warehouse_stock_balances wsb
JOIN warehouses w ON w.id = wsb.warehouse_id
JOIN raw_materials rm ON rm.id = wsb.raw_material_id
WHERE w.code IN ('RM', 'BUFFER')
  AND wsb.quantity != 0
ORDER BY w.code, rm.name;
