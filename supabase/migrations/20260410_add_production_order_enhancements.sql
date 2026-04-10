-- Add missing fields to production_orders table
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS shift VARCHAR(20) DEFAULT 'Day Shift',
ADD COLUMN IF NOT EXISTS operators TEXT,
ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS average_throughput NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- Add pack size breakdown table for production order outputs
CREATE TABLE IF NOT EXISTS production_order_pack_sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE,
  pack_size VARCHAR(20) NOT NULL,
  bags_produced INTEGER NOT NULL DEFAULT 0,
  total_weight NUMERIC(10,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for pack sizes
CREATE INDEX IF NOT EXISTS idx_production_order_pack_sizes_production_order_id 
ON production_order_pack_sizes(production_order_id);

-- Enable RLS on production_order_pack_sizes
ALTER TABLE production_order_pack_sizes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_order_pack_sizes
DROP POLICY IF EXISTS "Authenticated users can read production_order_pack_sizes" ON production_order_pack_sizes;
DROP POLICY IF EXISTS "Authenticated users can insert production_order_pack_sizes" ON production_order_pack_sizes;
DROP POLICY IF EXISTS "Authenticated users can update production_order_pack_sizes" ON production_order_pack_sizes;
DROP POLICY IF EXISTS "Authenticated users can delete production_order_pack_sizes" ON production_order_pack_sizes;

CREATE POLICY "Authenticated users can read production_order_pack_sizes"
  ON production_order_pack_sizes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert production_order_pack_sizes"
  ON production_order_pack_sizes
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update production_order_pack_sizes"
  ON production_order_pack_sizes
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete production_order_pack_sizes"
  ON production_order_pack_sizes
  FOR DELETE
  USING (auth.role() = 'authenticated');
