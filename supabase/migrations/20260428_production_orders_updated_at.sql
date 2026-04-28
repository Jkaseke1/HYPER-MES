-- Add updated_at to production_orders for bridge cost writeback
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
