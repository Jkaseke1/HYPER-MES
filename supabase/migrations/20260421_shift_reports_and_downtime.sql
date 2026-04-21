-- Shift Reports + Downtime support for production orders
-- Adds labour_force column and creates production_order_downtime table

-- 1. Add labour_force to production_orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS labour_force INTEGER;

-- 2. Downtime entries linked to a production order
CREATE TABLE IF NOT EXISTS production_order_downtime (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  downtime_hours NUMERIC(5,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Mechanical','Electrical','Power Outage',
    'Waiting - Materials','Waiting - Maintenance','Other'
  )),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downtime_order ON production_order_downtime(production_order_id);

ALTER TABLE production_order_downtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read downtime"
  ON production_order_downtime FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert downtime"
  ON production_order_downtime FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete downtime"
  ON production_order_downtime FOR DELETE USING (auth.role() = 'authenticated');
