-- Raw Material Lot Tracking
-- Adds batch/lot-level inventory: every GRN line creates a raw_material_lots row.
-- raw_materials.current_stock becomes the SUM of qty_remaining across active lots.
-- Transfers / issues decrement a specific lot's qty_remaining.
--
-- Backfill strategy:
--   1. Snapshot existing raw_materials.current_stock
--   2. Create one OPENING_BALANCE lot per material = snapshot
--   3. Create one lot per approved grn_item = received_qty
--   4. Recompute current_stock = SUM(active lot qty_remaining)
--      Result: new current_stock = old current_stock + SUM(all approved GRN received_qty)
--      (Because GRN receipts were never being added before — this is the long-standing bug fix.)

-- ============================================================================
-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_material_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  grn_id          UUID REFERENCES goods_received_notes(id) ON DELETE SET NULL,
  grn_item_id     UUID REFERENCES grn_items(id) ON DELETE SET NULL,
  batch_number    TEXT NOT NULL,
  qty_received    NUMERIC(14,3) NOT NULL CHECK (qty_received >= 0),
  qty_remaining   NUMERIC(14,3) NOT NULL CHECK (qty_remaining >= 0),
  unit            TEXT NOT NULL DEFAULT 'kg',
  unit_cost       NUMERIC(14,4) DEFAULT 0,
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  warehouse_id    UUID REFERENCES warehouses(id),
  source          TEXT NOT NULL DEFAULT 'grn' CHECK (source IN ('grn','opening_balance','adjustment','production')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','depleted','expired','quarantined')),
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grn_item_id)   -- one lot per grn_item (prevents double-backfill)
);

CREATE INDEX IF NOT EXISTS idx_rm_lots_material     ON raw_material_lots(raw_material_id, status);
CREATE INDEX IF NOT EXISTS idx_rm_lots_material_active_received
  ON raw_material_lots(raw_material_id, received_date)
  WHERE status = 'active' AND qty_remaining > 0;
CREATE INDEX IF NOT EXISTS idx_rm_lots_grn          ON raw_material_lots(grn_id);
CREATE INDEX IF NOT EXISTS idx_rm_lots_batch        ON raw_material_lots(batch_number);

-- RLS
ALTER TABLE raw_material_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read rm_lots"   ON raw_material_lots;
CREATE POLICY "Authenticated read rm_lots"
  ON raw_material_lots FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated write rm_lots"  ON raw_material_lots;
CREATE POLICY "Authenticated write rm_lots"
  ON raw_material_lots FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 2. Auto-flip status to 'depleted' when qty_remaining hits 0
-- ============================================================================
CREATE OR REPLACE FUNCTION rm_lot_auto_deplete() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qty_remaining <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rm_lot_auto_deplete ON raw_material_lots;
CREATE TRIGGER trg_rm_lot_auto_deplete
  BEFORE UPDATE OF qty_remaining ON raw_material_lots
  FOR EACH ROW EXECUTE FUNCTION rm_lot_auto_deplete();

-- ============================================================================
-- 3. Recompute raw_materials.current_stock from lots
-- ============================================================================
CREATE OR REPLACE FUNCTION rm_lot_recompute_stock(p_material_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE raw_materials rm
  SET
    current_stock = COALESCE((
      SELECT SUM(qty_remaining)
      FROM raw_material_lots
      WHERE raw_material_id = p_material_id
        AND status = 'active'
    ), 0),
    updated_at = NOW()
  WHERE rm.id = p_material_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after any lot insert/update/delete
CREATE OR REPLACE FUNCTION rm_lot_after_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM rm_lot_recompute_stock(OLD.raw_material_id);
    RETURN OLD;
  ELSE
    PERFORM rm_lot_recompute_stock(NEW.raw_material_id);
    IF TG_OP = 'UPDATE' AND NEW.raw_material_id != OLD.raw_material_id THEN
      PERFORM rm_lot_recompute_stock(OLD.raw_material_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rm_lot_after_change ON raw_material_lots;
CREATE TRIGGER trg_rm_lot_after_change
  AFTER INSERT OR UPDATE OR DELETE ON raw_material_lots
  FOR EACH ROW EXECUTE FUNCTION rm_lot_after_change();

-- ============================================================================
-- 4. Auto-create lots on GRN approval
-- ============================================================================
CREATE OR REPLACE FUNCTION rm_lot_create_from_grn(p_grn_id UUID) RETURNS INTEGER AS $$
DECLARE
  v_grn RECORD;
  v_item RECORD;
  v_count INTEGER := 0;
  v_batch TEXT;
BEGIN
  SELECT received_date, warehouse_id INTO v_grn
  FROM goods_received_notes WHERE id = p_grn_id;

  FOR v_item IN
    SELECT id, raw_material_id, received_qty, unit_cost, batch_number, expiry_date
    FROM grn_items
    WHERE grn_id = p_grn_id AND received_qty > 0
  LOOP
    -- Skip if a lot already exists for this grn_item (idempotent)
    IF EXISTS (SELECT 1 FROM raw_material_lots WHERE grn_item_id = v_item.id) THEN
      CONTINUE;
    END IF;

    v_batch := COALESCE(NULLIF(v_item.batch_number, ''), 'GRN-' || SUBSTRING(p_grn_id::TEXT, 1, 8));

    INSERT INTO raw_material_lots (
      raw_material_id, grn_id, grn_item_id, batch_number,
      qty_received, qty_remaining, unit_cost,
      received_date, expiry_date, warehouse_id, source, status
    ) VALUES (
      v_item.raw_material_id, p_grn_id, v_item.id, v_batch,
      v_item.received_qty, v_item.received_qty, v_item.unit_cost,
      COALESCE(v_grn.received_date, CURRENT_DATE), v_item.expiry_date, v_grn.warehouse_id,
      'grn', 'active'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_rm_lot_create_on_grn_approve() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved' THEN
    PERFORM rm_lot_create_from_grn(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rm_lot_on_grn_approve ON goods_received_notes;
CREATE TRIGGER trg_rm_lot_on_grn_approve
  AFTER UPDATE ON goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION trigger_rm_lot_create_on_grn_approve();

-- ============================================================================
-- 5. Add source_lot_id to stock_movements (for transfer/issue lot tracking)
-- ============================================================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS source_lot_id UUID REFERENCES raw_material_lots(id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_lot ON stock_movements(source_lot_id);

-- When a transfer with a source_lot_id is APPROVED, decrement that lot's qty_remaining.
-- (The old trigger that updates current_stock via stock_movements.quantity still runs;
--  the lot-recompute trigger ensures current_stock stays consistent.)
CREATE OR REPLACE FUNCTION trigger_rm_lot_decrement_on_transfer_approve() RETURNS TRIGGER AS $$
DECLARE
  v_decrement NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.movement_type IN ('transfer','issue','production_input','dispatch')
     AND NEW.source_lot_id IS NOT NULL
  THEN
    -- quantity is stored as negative for outbound movements; decrement = abs(quantity)
    v_decrement := ABS(NEW.quantity);
    UPDATE raw_material_lots
    SET qty_remaining = GREATEST(qty_remaining - v_decrement, 0)
    WHERE id = NEW.source_lot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rm_lot_decrement_on_transfer_approve ON stock_movements;
CREATE TRIGGER trg_rm_lot_decrement_on_transfer_approve
  AFTER UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION trigger_rm_lot_decrement_on_transfer_approve();

-- Now that lots drive current_stock, drop the old direct-stock updater so we don't double-count.
DROP TRIGGER IF EXISTS trigger_update_raw_materials_on_transfer_approval ON stock_movements;

-- ============================================================================
-- 6. Backfill existing approved GRNs + opening balances
-- ============================================================================
DO $$
DECLARE
  v_mat RECORD;
  v_grn RECORD;
  v_created_count INTEGER := 0;
BEGIN
  -- Step 1: Snapshot each material's current_stock into an OPENING_BALANCE lot
  -- (only for materials with stock > 0 AND without an existing opening lot)
  FOR v_mat IN
    SELECT rm.id, rm.code, rm.name, rm.current_stock, rm.unit, rm.cost_per_unit
    FROM raw_materials rm
    WHERE rm.current_stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM raw_material_lots l
        WHERE l.raw_material_id = rm.id AND l.source = 'opening_balance'
      )
  LOOP
    INSERT INTO raw_material_lots (
      raw_material_id, batch_number,
      qty_received, qty_remaining, unit, unit_cost,
      received_date, source, status, notes
    ) VALUES (
      v_mat.id, 'OPENING-' || v_mat.code,
      v_mat.current_stock, v_mat.current_stock, COALESCE(v_mat.unit,'kg'), COALESCE(v_mat.cost_per_unit,0),
      CURRENT_DATE - INTERVAL '1 year',  -- placeholder date older than any GRN so FIFO puts GRNs after
      'opening_balance', 'active',
      'Backfill: pre-lot-tracking opening balance. Current stock preserved as-is.'
    );
  END LOOP;

  -- Step 2: Create GRN lots for all already-approved GRNs
  FOR v_grn IN
    SELECT id FROM goods_received_notes WHERE status = 'approved'
  LOOP
    v_created_count := v_created_count + rm_lot_create_from_grn(v_grn.id);
  END LOOP;

  -- Step 3: Recompute all materials' current_stock from their lots
  FOR v_mat IN SELECT id FROM raw_materials LOOP
    PERFORM rm_lot_recompute_stock(v_mat.id);
  END LOOP;

  RAISE NOTICE 'Lot backfill complete: % GRN lots created.', v_created_count;
END $$;

-- ============================================================================
-- 7. Convenience view: available lots per material
-- ============================================================================
CREATE OR REPLACE VIEW v_rm_available_lots AS
SELECT
  l.id                AS lot_id,
  l.raw_material_id,
  rm.code             AS material_code,
  rm.name             AS material_name,
  l.batch_number,
  l.qty_remaining,
  l.unit,
  l.unit_cost,
  l.received_date,
  l.expiry_date,
  l.source,
  l.grn_id,
  gr.grn_number
FROM raw_material_lots l
JOIN raw_materials rm ON rm.id = l.raw_material_id
LEFT JOIN goods_received_notes gr ON gr.id = l.grn_id
WHERE l.status = 'active' AND l.qty_remaining > 0
ORDER BY l.received_date ASC, l.created_at ASC;   -- FIFO

COMMENT ON TABLE raw_material_lots IS
  'Batch/lot-level inventory for raw materials. Each GRN line creates a lot; transfers/issues decrement qty_remaining. raw_materials.current_stock = SUM(active lot qty_remaining).';
