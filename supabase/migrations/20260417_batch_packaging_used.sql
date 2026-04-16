-- Batch Packaging Consumption Tracking

CREATE TABLE IF NOT EXISTS batch_packaging_used (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  packaging_sku_id UUID NOT NULL REFERENCES packaging_skus(id),
  bags_used INT NOT NULL CHECK (bags_used > 0),
  implied_tonnes NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE batch_packaging_used ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Auth read batch_packaging_used"
ON batch_packaging_used
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Auth insert batch_packaging_used"
ON batch_packaging_used
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth delete batch_packaging_used"
ON batch_packaging_used
FOR DELETE
USING (auth.role() = 'authenticated');

-- Index for faster lookups
CREATE INDEX idx_batch_packaging_used_production_order_id ON batch_packaging_used(production_order_id);
CREATE INDEX idx_batch_packaging_used_packaging_sku_id ON batch_packaging_used(packaging_sku_id);
