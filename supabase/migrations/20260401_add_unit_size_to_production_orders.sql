-- Add unit_size column to production_orders for bag sizes (25kg, 10kg, 8kg)
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS unit_size varchar(10) DEFAULT '25kg';

-- Add comment for clarity
COMMENT ON COLUMN production_orders.unit_size IS 'Bag size for packaging: 25kg, 10kg, or 8kg';

-- Create index for filtering by unit_size
CREATE INDEX IF NOT EXISTS idx_production_orders_unit_size ON production_orders(unit_size);
