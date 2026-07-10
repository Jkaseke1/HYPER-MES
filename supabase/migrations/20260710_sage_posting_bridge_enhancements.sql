-- Sage auto-posting bridge enhancements
-- 1. Allow sage_stock_balances to track raw materials, finished goods (formulations), and macropack WIP.
-- 2. Add triggers for macropack and reconciliation events.
-- 3. Update helper functions to resolve sage_code from raw_materials, formulations, and macropack_boms.

-- ============================================================
-- 1. Expand sage_stock_balances for finished goods and WIP
-- ============================================================

ALTER TABLE sage_stock_balances
  ADD COLUMN IF NOT EXISTS formulation_id uuid REFERENCES formulations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS macropack_bom_id uuid REFERENCES macropack_boms(id) ON DELETE CASCADE;

-- Make raw_material_id nullable so it can be used for formulations / macropack items
ALTER TABLE sage_stock_balances
  ALTER COLUMN raw_material_id DROP NOT NULL;

-- Drop the old unique constraint and replace with one keyed on the Sage item code
-- (sage_code is unique in Sage StkItem, so it is the natural business key).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sage_stock_balances'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(raw_material_id, warehouse_id)%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sage_stock_balances DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE sage_stock_balances
  ADD CONSTRAINT sage_stock_balances_code_warehouse_unique UNIQUE (sage_code, warehouse_id);

-- Ensure only one source reference is populated
ALTER TABLE sage_stock_balances
  ADD CONSTRAINT sage_stock_balances_source_check
  CHECK (
    (raw_material_id IS NOT NULL AND formulation_id IS NULL AND macropack_bom_id IS NULL) OR
    (raw_material_id IS NULL AND formulation_id IS NOT NULL AND macropack_bom_id IS NULL) OR
    (raw_material_id IS NULL AND formulation_id IS NULL AND macropack_bom_id IS NOT NULL)
  );

-- ============================================================
-- 2. Update helper functions to resolve sage_code from any source
-- ============================================================

CREATE OR REPLACE FUNCTION set_sage_stock_balance(
  p_sage_code text,
  p_warehouse_id int,
  p_quantity numeric
)
RETURNS void AS $$
DECLARE
  v_rm_id uuid;
  v_form_id uuid;
  v_mp_id uuid;
BEGIN
  -- Resolve against raw materials, formulations, or macropack BOMs
  -- Only one source should be set; raw_materials takes priority, then formulations, then macropack_boms.
  SELECT id INTO v_rm_id FROM raw_materials WHERE sage_code = p_sage_code AND is_active = true LIMIT 1;

  IF v_rm_id IS NULL THEN
    SELECT id INTO v_form_id FROM formulations WHERE sage_code = p_sage_code AND status = 'active' LIMIT 1;
  END IF;

  IF v_rm_id IS NULL AND v_form_id IS NULL THEN
    SELECT id INTO v_mp_id FROM macropack_boms WHERE macropack_code = p_sage_code AND is_active = true LIMIT 1;
  END IF;

  IF v_rm_id IS NULL AND v_form_id IS NULL AND v_mp_id IS NULL THEN
    RAISE EXCEPTION 'Sage code not found in raw_materials/formulations/macropack_boms: %', p_sage_code;
  END IF;

  INSERT INTO sage_stock_balances (
    raw_material_id,
    formulation_id,
    macropack_bom_id,
    sage_code,
    warehouse_id,
    quantity,
    last_synced_at,
    updated_at
  )
  VALUES (v_rm_id, v_form_id, v_mp_id, p_sage_code, p_warehouse_id, p_quantity, now(), now())
  ON CONFLICT (sage_code, warehouse_id)
  DO UPDATE SET
    raw_material_id = EXCLUDED.raw_material_id,
    formulation_id = EXCLUDED.formulation_id,
    macropack_bom_id = EXCLUDED.macropack_bom_id,
    quantity = EXCLUDED.quantity,
    last_synced_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_sage_stock_balance(
  p_sage_code text,
  p_warehouse_id int,
  p_quantity_delta numeric
)
RETURNS void AS $$
DECLARE
  v_rm_id uuid;
  v_form_id uuid;
  v_mp_id uuid;
BEGIN
  SELECT id INTO v_rm_id FROM raw_materials WHERE sage_code = p_sage_code AND is_active = true LIMIT 1;

  IF v_rm_id IS NULL THEN
    SELECT id INTO v_form_id FROM formulations WHERE sage_code = p_sage_code AND status = 'active' LIMIT 1;
  END IF;

  IF v_rm_id IS NULL AND v_form_id IS NULL THEN
    SELECT id INTO v_mp_id FROM macropack_boms WHERE macropack_code = p_sage_code AND is_active = true LIMIT 1;
  END IF;

  IF v_rm_id IS NULL AND v_form_id IS NULL AND v_mp_id IS NULL THEN
    RAISE EXCEPTION 'Sage code not found in raw_materials/formulations/macropack_boms: %', p_sage_code;
  END IF;

  INSERT INTO sage_stock_balances (
    raw_material_id,
    formulation_id,
    macropack_bom_id,
    sage_code,
    warehouse_id,
    quantity,
    last_synced_at,
    updated_at
  )
  VALUES (v_rm_id, v_form_id, v_mp_id, p_sage_code, p_warehouse_id, p_quantity_delta, now(), now())
  ON CONFLICT (sage_code, warehouse_id)
  DO UPDATE SET
    raw_material_id = EXCLUDED.raw_material_id,
    formulation_id = EXCLUDED.formulation_id,
    macropack_bom_id = EXCLUDED.macropack_bom_id,
    quantity = sage_stock_balances.quantity + EXCLUDED.quantity,
    last_synced_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_sage_available_stock(p_raw_material_id uuid)
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(
    (SELECT quantity FROM sage_stock_balances
     WHERE raw_material_id = p_raw_material_id AND warehouse_id = 18),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Update validation view to include formulations and all warehouses
-- ============================================================

CREATE OR REPLACE VIEW v_sage_stock_for_validation AS
SELECT
  rm.id as raw_material_id,
  rm.name as raw_material_name,
  rm.code as raw_material_code,
  rm.sage_code,
  COALESCE(ssb.quantity, 0) as sage_quantity,
  ssb.warehouse_id,
  CASE ssb.warehouse_id
    WHEN 18 THEN 'Raw Materials'
    WHEN 19 THEN 'Production'
    WHEN 20 THEN 'Finished Goods'
    WHEN 21 THEN 'Mutare Warehouse'
    ELSE 'Unknown'
  END as warehouse_name,
  ssb.last_synced_at
FROM raw_materials rm
LEFT JOIN sage_stock_balances ssb ON rm.id = ssb.raw_material_id
WHERE rm.is_active = true

UNION ALL

SELECT
  NULL as raw_material_id,
  f.name as raw_material_name,
  f.code as raw_material_code,
  f.sage_code,
  COALESCE(ssb.quantity, 0) as sage_quantity,
  ssb.warehouse_id,
  CASE ssb.warehouse_id
    WHEN 18 THEN 'Raw Materials'
    WHEN 19 THEN 'Production'
    WHEN 20 THEN 'Finished Goods'
    WHEN 21 THEN 'Mutare Warehouse'
    ELSE 'Unknown'
  END as warehouse_name,
  ssb.last_synced_at
FROM formulations f
LEFT JOIN sage_stock_balances ssb ON f.id = ssb.formulation_id
WHERE f.status = 'active';

-- ============================================================
-- 4. Add missing bridge triggers for macropack and reconciliation
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_macropack_manufactured()
RETURNS trigger AS $$
BEGIN
  INSERT INTO sync_log (
    event_type,
    reference_id,
    reference_type,
    status,
    message,
    details
  ) VALUES (
    'macropack_manufactured',
    NEW.id,
    'macropack_manufacture_orders',
    'pending',
    'Macropack manufacture completed',
    json_build_object(
      'macropack_bom_id', NEW.macropack_bom_id,
      'planned_units', NEW.planned_units,
      'actual_units', NEW.actual_units,
      'manufacture_date', NEW.manufacture_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_macropack_completed ON macropack_manufacture_orders;
CREATE TRIGGER on_macropack_completed
  AFTER UPDATE ON macropack_manufacture_orders
  FOR EACH ROW
  WHEN (OLD.status != 'COMPLETED' AND NEW.status = 'COMPLETED')
  EXECUTE FUNCTION trigger_macropack_manufactured();

CREATE OR REPLACE FUNCTION trigger_reconciliation_variance_approved()
RETURNS trigger AS $$
BEGIN
  INSERT INTO sync_log (
    event_type,
    reference_id,
    reference_type,
    status,
    message,
    details
  ) VALUES (
    'reconciliation_variance_approved',
    NEW.id,
    'monthly_rm_reconciliation',
    'pending',
    'Reconciliation variance approved',
    json_build_object(
      'period_start', NEW.period_start,
      'period_end', NEW.period_end,
      'material_id', NEW.material_id,
      'material_name', NEW.material_name,
      'variance_kg', NEW.variance_kg,
      'variance_reason_code', NEW.variance_reason_code
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reconciliation_variance_approved ON monthly_rm_reconciliation;
CREATE TRIGGER on_reconciliation_variance_approved
  AFTER UPDATE ON monthly_rm_reconciliation
  FOR EACH ROW
  WHEN (OLD.reconciliation_status != 'APPROVED' AND NEW.reconciliation_status = 'APPROVED')
  EXECUTE FUNCTION trigger_reconciliation_variance_approved();

-- ============================================================
-- 5. Ensure sync_log check constraints accept these events
-- ============================================================
-- The 20260421 migration already expands event_type. This is a safety re-run.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sync_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE sync_log
  ADD CONSTRAINT sync_log_event_type_check
  CHECK (event_type IN (
    'grn_confirmed',
    'materials_issued',
    'production_completed',
    'dispatch_delivered',
    'price_sync',
    'customer_sync',
    'error',
    'material_variance_alert',
    'macropack_manufactured',
    'reconciliation_variance_approved',
    'rm_cost_updated',
    'reconciliation_completed'
  )) NOT VALID;
