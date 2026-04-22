-- Ensures the invariant: raw_materials.current_stock = SUM(active lot qty_remaining)
-- Fixes the gap where approved transfers without source_lot_id updated current_stock
-- directly but did not deplete any lot, so the next lot change would clobber the
-- correct current_stock with stale SUM(lots).
--
-- This migration:
--   1. Adds a FIFO depletion helper.
--   2. Upgrades the transfer-approval trigger to FIFO-deplete when source_lot_id is NULL.
--   3. Drops the legacy direct-stock trigger (current_stock is now always derived from lots).
--   4. One-time reconciliation: for every material where SUM(lots) > current_stock,
--      FIFO-deplete the excess so the invariant holds.

-- ============================================================================
-- 1. FIFO depletion helper
-- ============================================================================
CREATE OR REPLACE FUNCTION rm_lot_fifo_deplete(p_material_id UUID, p_qty NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_remaining NUMERIC := p_qty;
  v_lot RECORD;
  v_take NUMERIC;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RETURN 0; END IF;

  FOR v_lot IN
    SELECT id, qty_remaining
    FROM raw_material_lots
    WHERE raw_material_id = p_material_id
      AND status = 'active'
      AND qty_remaining > 0
    ORDER BY received_date ASC, created_at ASC   -- FIFO
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.qty_remaining, v_remaining);
    UPDATE raw_material_lots
    SET qty_remaining = qty_remaining - v_take
    WHERE id = v_lot.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN p_qty - v_remaining;   -- actual depleted (<= p_qty if lots ran out)
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Upgrade transfer/issue-approval trigger to handle NULL source_lot_id
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_rm_lot_decrement_on_transfer_approve()
RETURNS TRIGGER AS $$
DECLARE
  v_decrement NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.movement_type IN ('transfer','issue','production_input','dispatch')
  THEN
    v_decrement := ABS(NEW.quantity);
    IF NEW.source_lot_id IS NOT NULL THEN
      UPDATE raw_material_lots
      SET qty_remaining = GREATEST(qty_remaining - v_decrement, 0)
      WHERE id = NEW.source_lot_id;
    ELSE
      -- Legacy transfers or transfers created without lot selection: FIFO deplete.
      PERFORM rm_lot_fifo_deplete(NEW.raw_material_id, v_decrement);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Drop the legacy direct-stock trigger (lots are now the single source of truth)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_raw_materials_on_transfer_approval ON stock_movements;

-- ============================================================================
-- 4. One-time reconciliation: close any existing gap where SUM(lots) > current_stock.
--    This catches any transfer approved between the first migration and this one.
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  v_gap NUMERIC;
  v_fixed INTEGER := 0;
BEGIN
  FOR r IN
    SELECT
      rm.id,
      rm.code,
      rm.current_stock,
      COALESCE((
        SELECT SUM(qty_remaining)
        FROM raw_material_lots
        WHERE raw_material_id = rm.id AND status = 'active'
      ), 0) AS lot_sum
    FROM raw_materials rm
  LOOP
    v_gap := r.lot_sum - r.current_stock;
    IF v_gap > 0.001 THEN
      PERFORM rm_lot_fifo_deplete(r.id, v_gap);
      v_fixed := v_fixed + 1;
      RAISE NOTICE 'Reconciled %: lot_sum=% current_stock=% depleted=%',
        r.code, r.lot_sum, r.current_stock, v_gap;
    END IF;
  END LOOP;
  RAISE NOTICE 'Reconciliation complete: % materials fixed.', v_fixed;
END $$;
