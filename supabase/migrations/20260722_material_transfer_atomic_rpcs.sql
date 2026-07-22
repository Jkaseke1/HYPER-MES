-- Atomic and retry-safe material transfer processing
-- Prevents partial client-side updates when network drops mid-operation.

CREATE OR REPLACE FUNCTION create_material_transfer_to_buffer(
  p_raw_material_id uuid,
  p_from_warehouse_id uuid,
  p_quantity numeric,
  p_unit text,
  p_transfer_date date,
  p_purpose text,
  p_notes text,
  p_production_order_id uuid,
  p_requested_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_transfer_id uuid;
  v_buffer_warehouse_id uuid;
  v_from_balance numeric;
BEGIN
  IF p_raw_material_id IS NULL THEN
    RAISE EXCEPTION 'Raw material is required';
  END IF;

  IF p_from_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Source warehouse is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than zero';
  END IF;

  SELECT id INTO v_buffer_warehouse_id
  FROM warehouses
  WHERE code = 'BUFFER'
  LIMIT 1;

  IF v_buffer_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Buffer Warehouse not found';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_from_balance
  FROM warehouse_stock_balances
  WHERE raw_material_id = p_raw_material_id
    AND warehouse_id = p_from_warehouse_id
  FOR UPDATE;

  IF COALESCE(v_from_balance, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %', COALESCE(v_from_balance, 0), p_quantity;
  END IF;

  INSERT INTO material_transfers (
    raw_material_id,
    from_warehouse_id,
    to_location,
    buffer_warehouse_id,
    quantity,
    unit,
    transfer_date,
    purpose,
    production_order_id,
    notes,
    status,
    requested_by,
    buffer_approved_by,
    buffer_approved_at
  ) VALUES (
    p_raw_material_id,
    p_from_warehouse_id,
    'Production Floor',
    v_buffer_warehouse_id,
    p_quantity,
    COALESCE(NULLIF(TRIM(p_unit), ''), 'kg'),
    p_transfer_date,
    COALESCE(NULLIF(TRIM(p_purpose), ''), 'Material transfer'),
    p_production_order_id,
    p_notes,
    'in_buffer',
    p_requested_by,
    p_requested_by,
    now()
  )
  RETURNING id INTO v_transfer_id;

  PERFORM update_warehouse_balance(
    p_raw_material_id,
    p_from_warehouse_id,
    -p_quantity
  );

  PERFORM update_warehouse_balance(
    p_raw_material_id,
    v_buffer_warehouse_id,
    p_quantity
  );

  INSERT INTO stock_movements (
    raw_material_id,
    movement_type,
    quantity,
    warehouse_id,
    reference_type,
    reference_id,
    notes,
    performed_by
  ) VALUES (
    p_raw_material_id,
    'transfer',
    -p_quantity,
    p_from_warehouse_id,
    'material_transfer',
    v_transfer_id,
    'Auto-transfer: RM Warehouse → Buffer Warehouse on creation',
    p_requested_by
  );

  INSERT INTO stock_movements (
    raw_material_id,
    movement_type,
    quantity,
    warehouse_id,
    reference_type,
    reference_id,
    notes,
    performed_by
  ) VALUES (
    p_raw_material_id,
    'transfer',
    p_quantity,
    v_buffer_warehouse_id,
    'material_transfer',
    v_transfer_id,
    'Auto-transfer: Buffer Warehouse receipt on creation',
    p_requested_by
  );

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


CREATE OR REPLACE FUNCTION approve_material_transfer_to_production(
  p_transfer_id uuid,
  p_approved_by uuid
)
RETURNS text AS $$
DECLARE
  v_transfer record;
  v_buffer_balance numeric;
  v_production_warehouse_id uuid;
  v_existing_production_movement boolean;
BEGIN
  SELECT * INTO v_transfer
  FROM material_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found: %', p_transfer_id;
  END IF;

  IF v_transfer.status = 'received' THEN
    RETURN 'already_received';
  END IF;

  IF v_transfer.status <> 'in_buffer' THEN
    RAISE EXCEPTION 'Transfer must be in in_buffer status. Current status: %', v_transfer.status;
  END IF;

  SELECT id INTO v_production_warehouse_id
  FROM warehouses
  WHERE code = 'PRODUCTION'
  LIMIT 1;

  IF v_production_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Production Warehouse not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM stock_movements
    WHERE reference_type = 'material_transfer'
      AND reference_id = p_transfer_id
      AND movement_type = 'production_input'
      AND quantity = v_transfer.quantity
      AND raw_material_id = v_transfer.raw_material_id
  )
  INTO v_existing_production_movement;

  IF v_existing_production_movement THEN
    UPDATE material_transfers
    SET status = 'received',
        production_approved_by = p_approved_by,
        production_approved_at = now(),
        approved_by = p_approved_by,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;

    RETURN 'recovered_existing_posting';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_buffer_balance
  FROM warehouse_stock_balances
  WHERE raw_material_id = v_transfer.raw_material_id
    AND warehouse_id = v_transfer.buffer_warehouse_id
  FOR UPDATE;

  IF COALESCE(v_buffer_balance, 0) < v_transfer.quantity THEN
    RAISE EXCEPTION 'Insufficient stock in Buffer Warehouse. Available: %, Required: %', COALESCE(v_buffer_balance, 0), v_transfer.quantity;
  END IF;

  PERFORM update_warehouse_balance(
    v_transfer.raw_material_id,
    v_transfer.buffer_warehouse_id,
    -v_transfer.quantity
  );

  PERFORM update_warehouse_balance(
    v_transfer.raw_material_id,
    v_production_warehouse_id,
    v_transfer.quantity
  );

  INSERT INTO stock_movements (
    raw_material_id,
    movement_type,
    quantity,
    warehouse_id,
    reference_type,
    reference_id,
    notes,
    performed_by
  ) VALUES (
    v_transfer.raw_material_id,
    'production_input',
    v_transfer.quantity,
    v_production_warehouse_id,
    'material_transfer',
    p_transfer_id,
    'Step 2: Transfer from Buffer to Production Floor',
    p_approved_by
  );

  UPDATE material_transfers
  SET status = 'received',
      production_approved_by = p_approved_by,
      production_approved_at = now(),
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_transfer_id;

  BEGIN
    PERFORM log_approval_action(
      'material_transfer',
      p_transfer_id,
      'production_approved',
      'in_buffer',
      'received',
      p_approved_by,
      'Accepted to Production Floor'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN 'processed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
