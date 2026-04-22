-- Bridge sync hardening:
--   1. Guard issue_individual_ingredient against actual_qty <= 0 (root cause of "Invalid quantity: 0" bridge errors)
--   2. Skip sync_log row for materials_issued if actual_qty <= 0 (belt & suspenders)
--   3. Retire historical failed sync_log rows with a disposition note (they can't be replayed)

-- ============================================================================
-- 1. Guard the RPC
-- ============================================================================
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
  -- Guard: non-positive quantities must not produce stock movements or sync events
  IF p_actual_qty IS NULL OR p_actual_qty <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity: % (must be > 0)', p_actual_qty
      USING HINT = 'Enter a positive actual qty before issuing to production.';
  END IF;

  -- Validate and fetch
  SELECT pom.production_order_id, pom.raw_material_id, pom.unit, rm.cost_per_unit
    INTO v_production_order_id, v_raw_material_id, v_unit, v_unit_cost
  FROM production_order_materials pom
  JOIN raw_materials rm ON rm.id = pom.raw_material_id
  WHERE pom.id = p_material_id;

  IF v_production_order_id IS NULL THEN
    RAISE EXCEPTION 'Production order material % not found', p_material_id;
  END IF;

  SELECT batch_number INTO v_batch_sample
  FROM raw_material_lots
  WHERE raw_material_id = v_raw_material_id AND status = 'active' AND qty_remaining > 0
  ORDER BY received_date ASC, created_at ASC
  LIMIT 1;

  SELECT rm_lot_fifo_deplete(v_raw_material_id, p_actual_qty) INTO v_depleted;

  IF v_depleted < p_actual_qty THEN
    RAISE WARNING 'Material % issued %, but only % available in lots — shortfall %',
      v_raw_material_id, p_actual_qty, v_depleted, (p_actual_qty - v_depleted);
  END IF;

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

-- ============================================================================
-- 2. Skip sync_log emission when actual_qty <= 0 (defence in depth)
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_materials_issued()
RETURNS trigger AS $$
BEGIN
  IF NEW.actual_qty IS NULL OR NEW.actual_qty <= 0 THEN
    RAISE NOTICE 'Skipping materials_issued sync for % — actual_qty=%',
      NEW.id, NEW.actual_qty;
    RETURN NEW;
  END IF;

  INSERT INTO sync_log (
    event_type, reference_id, reference_type, status, message, details
  ) VALUES (
    'materials_issued', NEW.id, 'production_order_materials',
    'pending',
    'Materials issued for production',
    json_build_object(
      'production_order_id', NEW.production_order_id,
      'raw_material_id',     NEW.raw_material_id,
      'actual_qty',          NEW.actual_qty,
      'issued_at',           NEW.issued_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Retire historical failed rows (status stays 'failed' — constraint doesn't allow 'skipped',
--    but we tag them so monitoring queries can filter them out)
-- ============================================================================
UPDATE sync_log
SET message = coalesce(message,'') || ' [RETIRED 2026-04-23: historical failure, not replayed]'
WHERE status = 'failed'
  AND created_at < '2026-04-23'::date
  AND message NOT LIKE '%[RETIRED%';

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION issue_individual_ingredient(UUID, NUMERIC, UUID) IS
  'Issues a production-order ingredient: guards zero qty, FIFO-depletes lots, records a stock_movement, flips issued flag.';
COMMENT ON FUNCTION trigger_materials_issued() IS
  'Emits materials_issued sync_log row when production_order_materials.issued flips true. Skips zero-qty rows.';
