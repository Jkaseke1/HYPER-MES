-- Two-step Material Transfer Workflow
-- Step 1: RM Warehouse → Buffer Warehouse (approved by Raw Materials/Procurement)
-- Step 2: Buffer Warehouse → Production Floor (approved by Production)

-- 1. Add new columns for two-step approval
ALTER TABLE material_transfers 
ADD COLUMN IF NOT EXISTS buffer_approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS buffer_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS production_approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS production_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS buffer_warehouse_id uuid REFERENCES warehouses(id);

-- 2. Update status check constraint to include new statuses
ALTER TABLE material_transfers DROP CONSTRAINT IF EXISTS material_transfers_status_check;
ALTER TABLE material_transfers ADD CONSTRAINT material_transfers_status_check 
  CHECK (status IN ('pending', 'in_buffer', 'approved', 'in_transit', 'received', 'rejected'));

-- 3. Add buffer type to warehouses check constraint
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_type_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_type_check
  CHECK (type IN ('raw_material', 'finished_goods', 'buffer'));

-- 4. Create Buffer Warehouse if it doesn't exist
INSERT INTO warehouses (name, code, type, is_active)
VALUES ('Buffer Warehouse', 'BUFFER', 'buffer', true)
ON CONFLICT (code) DO NOTHING;

-- 5. Create per-warehouse stock balance table to track buffer stock separately
CREATE TABLE IF NOT EXISTS warehouse_stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid REFERENCES raw_materials(id) NOT NULL,
  warehouse_id uuid REFERENCES warehouses(id) NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (raw_material_id, warehouse_id)
);

ALTER TABLE warehouse_stock_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read warehouse_stock_balances" ON warehouse_stock_balances;
DROP POLICY IF EXISTS "Authenticated users can insert warehouse_stock_balances" ON warehouse_stock_balances;
DROP POLICY IF EXISTS "Authenticated users can update warehouse_stock_balances" ON warehouse_stock_balances;

CREATE POLICY "Authenticated users can read warehouse_stock_balances"
  ON warehouse_stock_balances FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert warehouse_stock_balances"
  ON warehouse_stock_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update warehouse_stock_balances"
  ON warehouse_stock_balances FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_balances_material ON warehouse_stock_balances(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_balances_warehouse ON warehouse_stock_balances(warehouse_id);

-- 5. Seed warehouse balances from raw_materials default warehouse
INSERT INTO warehouse_stock_balances (raw_material_id, warehouse_id, quantity)
SELECT rm.id, rm.warehouse_id, rm.current_stock
FROM raw_materials rm
WHERE rm.warehouse_id IS NOT NULL
  AND rm.current_stock > 0
ON CONFLICT (raw_material_id, warehouse_id) DO NOTHING;

-- 6. Update existing pending transfers to use the new workflow
UPDATE material_transfers 
SET buffer_warehouse_id = (SELECT id FROM warehouses WHERE code = 'BUFFER')
WHERE buffer_warehouse_id IS NULL;

-- 7. Add RPC function to upsert warehouse stock balances
CREATE OR REPLACE FUNCTION update_warehouse_balance(
  p_raw_material_id uuid,
  p_warehouse_id uuid,
  p_quantity_delta numeric
)
RETURNS void AS $$
BEGIN
  INSERT INTO warehouse_stock_balances (raw_material_id, warehouse_id, quantity)
  VALUES (p_raw_material_id, p_warehouse_id, p_quantity_delta)
  ON CONFLICT (raw_material_id, warehouse_id)
  DO UPDATE SET 
    quantity = warehouse_stock_balances.quantity + p_quantity_delta,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- 8. Add comments for documentation
COMMENT ON COLUMN material_transfers.buffer_approved_by IS 'Raw Materials user who approved transfer to buffer warehouse (Step 1)';
COMMENT ON COLUMN material_transfers.buffer_approved_at IS 'Timestamp when transfer was approved to buffer warehouse';
COMMENT ON COLUMN material_transfers.production_approved_by IS 'Production user who approved transfer from buffer to production (Step 2)';
COMMENT ON COLUMN material_transfers.production_approved_at IS 'Timestamp when transfer was received by production';
COMMENT ON COLUMN material_transfers.buffer_warehouse_id IS 'The buffer/holding bay warehouse for intermediate storage';
