-- Keep kg as the canonical stock/Sage quantity and record the operational bag count alongside it.
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS planned_bags numeric,
  ADD COLUMN IF NOT EXISTS actual_bags numeric,
  ADD COLUMN IF NOT EXISTS rejected_bags numeric,
  ADD COLUMN IF NOT EXISTS wastage_bags numeric;

ALTER TABLE production_outputs
  ADD COLUMN IF NOT EXISTS quantity_bags numeric,
  ADD COLUMN IF NOT EXISTS rejected_bags numeric,
  ADD COLUMN IF NOT EXISTS wastage_bags numeric,
  ADD COLUMN IF NOT EXISTS bag_size_kg numeric;

ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS quantity_bags numeric,
  ADD COLUMN IF NOT EXISTS bag_size_kg numeric;

COMMENT ON COLUMN production_orders.planned_bags IS 'Operational planned finished-product bag count; planned_qty remains kilograms.';
COMMENT ON COLUMN production_orders.actual_bags IS 'Operational actual finished-product bag count; actual_qty remains kilograms.';
COMMENT ON COLUMN dispatch_items.quantity_bags IS 'Operational dispatched bag count; quantity remains kilograms for stock and Sage.';
