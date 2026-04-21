-- Labour rates per machine (production line) and global cost settings.
-- Used to auto-populate Labour Cost and Overhead Cost on production orders.

-- 1. Labour rates per machine (one rate per machine, updated by editing row or adding new effective_date)
CREATE TABLE IF NOT EXISTS labour_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  rate_per_hour_usd NUMERIC(10,4) NOT NULL DEFAULT 2.50,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (machine_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_labour_rates_machine ON labour_rates(machine_id);

-- 2. Global cost settings (key-value, numeric)
CREATE TABLE IF NOT EXISTS cost_settings (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cost_settings (key, value, description)
VALUES ('overhead_rate_percent', 5, 'Overhead cost as % of raw material cost')
ON CONFLICT (key) DO NOTHING;

-- 3. Seed a default labour rate of $2.50/hr for every existing machine
INSERT INTO labour_rates (machine_id, rate_per_hour_usd, effective_date)
SELECT id, 2.50, CURRENT_DATE FROM machines
ON CONFLICT (machine_id, effective_date) DO NOTHING;

-- RLS
ALTER TABLE labour_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read labour_rates" ON labour_rates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert labour_rates" ON labour_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update labour_rates" ON labour_rates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete labour_rates" ON labour_rates FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read cost_settings" ON cost_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert cost_settings" ON cost_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update cost_settings" ON cost_settings FOR UPDATE USING (auth.role() = 'authenticated');
