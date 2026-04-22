-- Fix: issue_individual_ingredient only flipped issued=true; it did NOT decrement stock.
-- Result: raw_materials.current_stock and raw_material_lots.qty_remaining stayed the same
-- even after production consumed materials. Sage was notified of the issue via sync_log,
-- but MES inventory never reflected the consumption.
--
-- This migration rewrites the RPC to:
--   1. FIFO-deplete the material's lots by the issued quantity (cascades to current_stock via trigger).
--   2. Insert an auditable stock_movement (movement_type='production_input', status='approved').
--   3. Flip production_order_materials.issued = true (unchanged behavior).

CREATE OR REPLACE FUNCTION issue_individual_ingredient(
  p_material_id UUID,
  p_actual_qty  NUMERIC,
  p_issued_by   UUID
) RETURNS VOID AS $$
DECLARE
  v_production_order_id UUID;
  v_raw_material_id     UUID;
  v_unit                TEXT;
  v_unit_cost           NUMERIC;
  v_depleted            NUMERIC;
  v_batch_sample        TEXT;
BEGIN
  -- Validate and fetch
  SELECT pom.production_order_id, pom.raw_material_id, pom.unit, rm.cost_per_unit
    INTO v_production_order_id, v_raw_material_id, v_unit, v_unit_cost
  FROM production_order_materials pom
  JOIN raw_materials rm ON rm.id = pom.raw_material_id
  WHERE pom.id = p_material_id;

  IF v_production_order_id IS NULL THEN
    RAISE EXCEPTION 'Production order material % not found', p_material_id;
  END IF;

  -- Capture the batch_number of the first lot we'll deplete (for the stock_movement audit row)
  SELECT batch_number INTO v_batch_sample
  FROM raw_material_lots
  WHERE raw_material_id = v_raw_material_id AND status = 'active' AND qty_remaining > 0
  ORDER BY received_date ASC, created_at ASC
  LIMIT 1;

  -- FIFO deplete across active lots (cascades to current_stock via rm_lot_after_change trigger)
  SELECT rm_lot_fifo_deplete(v_raw_material_id, p_actual_qty) INTO v_depleted;

  IF v_depleted < p_actual_qty THEN
    RAISE WARNING 'Material % issued %, but only % available in lots — shortfall %',
      v_raw_material_id, p_actual_qty, v_depleted, (p_actual_qty - v_depleted);
  END IF;

  -- Audit: insert stock_movement row for the consumption
  INSERT INTO stock_movements (
    movement_type, reference_type, reference_id,
    raw_material_id, quantity, unit, batch_number,
    movement_date, performed_by, notes
  ) VALUES (
    'production_input', 'production_order_material', p_material_id,
    v_raw_material_id, -ABS(p_actual_qty), COALESCE(v_unit, 'kg'),
    COALESCE(v_batch_sample, ''),
    NOW(), p_issued_by,
    'Issued to production order ' || v_production_order_id::TEXT
  );

  -- Flip issued flag + snapshot costs
  UPDATE production_order_materials
  SET
    actual_qty  = p_actual_qty,
    issued      = TRUE,
    issued_at   = NOW(),
    issued_by   = p_issued_by,
    unit_cost   = ROUND(COALESCE(v_unit_cost, 0)::numeric, 4),
    total_cost  = ROUND((p_actual_qty * COALESCE(v_unit_cost, 0))::numeric, 4)
  WHERE id = p_material_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION issue_individual_ingredient(UUID, NUMERIC, UUID) IS
  'Issues a production-order ingredient: FIFO-depletes lots, records a stock_movement, flips issued flag. Keeps raw_materials.current_stock in sync via lot triggers.';
