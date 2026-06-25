-- Migrate existing pending material transfers to Buffer Warehouse
-- Run this after 20260625_two_step_material_transfer.sql

DO $$
DECLARE
  transfer_record RECORD;
  buffer_id uuid;
BEGIN
  -- Get Buffer Warehouse ID
  SELECT id INTO buffer_id FROM warehouses WHERE code = 'BUFFER' LIMIT 1;

  IF buffer_id IS NULL THEN
    RAISE EXCEPTION 'Buffer Warehouse not found. Please run 20260625_two_step_material_transfer.sql first.';
  END IF;

  -- Process each pending transfer that still needs stock moved to buffer
  FOR transfer_record IN
    SELECT id, raw_material_id, from_warehouse_id, quantity, requested_by
    FROM material_transfers
    WHERE status = 'pending'
  LOOP
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

    -- Update transfer status
    UPDATE material_transfers
    SET
      status = 'in_buffer',
      buffer_warehouse_id = buffer_id,
      buffer_approved_by = transfer_record.requested_by,
      buffer_approved_at = now(),
      updated_at = now()
    WHERE id = transfer_record.id;

    -- Record stock movements
    INSERT INTO stock_movements (raw_material_id, movement_type, quantity, warehouse_id, reference_type, reference_id, notes, movement_date)
    VALUES
      (transfer_record.raw_material_id, 'transfer', -transfer_record.quantity, transfer_record.from_warehouse_id, 'material_transfer', transfer_record.id, 'Migration: RM Warehouse → Buffer Warehouse', CURRENT_DATE),
      (transfer_record.raw_material_id, 'transfer', transfer_record.quantity, buffer_id, 'material_transfer', transfer_record.id, 'Migration: Buffer Warehouse receipt', CURRENT_DATE);

  END LOOP;

  -- Also make sure any remaining pending transfers already have buffer_warehouse_id set to in_buffer
  UPDATE material_transfers
  SET status = 'in_buffer',
      buffer_approved_at = COALESCE(buffer_approved_at, now()),
      buffer_warehouse_id = COALESCE(buffer_warehouse_id, buffer_id)
  WHERE status = 'pending';

END $$;

-- Verify migration
SELECT status, COUNT(*) as count
FROM material_transfers
GROUP BY status
ORDER BY status;
