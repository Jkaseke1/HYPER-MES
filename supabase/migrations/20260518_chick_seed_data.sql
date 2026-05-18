-- Seed data for Chick Management

-- 1. Seed Suppliers
INSERT INTO chick_suppliers (name, contact_name, contact_phone, is_active)
VALUES 
  ('Kudu Creek', NULL, NULL, true),
  ('Masvingo Chicks', NULL, NULL, true),
  ('Irvines', NULL, NULL, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Branch Master with delivery types
-- This assumes branches table exists. If not, we'll create a simple lookup.
CREATE TABLE IF NOT EXISTS chick_branches (
  branch_code TEXT PRIMARY KEY,
  branch_name TEXT NOT NULL,
  delivery_type TEXT CHECK (delivery_type IN ('LOCAL','BRANCH')) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed branches
INSERT INTO chick_branches (branch_code, branch_name, delivery_type, is_active)
VALUES 
  -- LOCAL (Harare area — Hyperfeeds driver distributes from Amtec)
  ('FACTORY', 'Factory', 'LOCAL', true),
  ('MBUDZI', 'Mbudzi', 'LOCAL', true),
  ('SOUTHWINDS', 'Southwinds', 'LOCAL', true),
  ('CHIGOVANYIKA', 'Chigovanyika', 'LOCAL', true),
  ('SHOWGROUNDS', 'Showgrounds', 'LOCAL', true),
  ('AMTEC', 'Amtec', 'LOCAL', true),
  ('HIGHGLEN', 'Highglen', 'LOCAL', true),
  
  -- BRANCH (out-of-town — supplier delivers direct)
  ('MASVINGO', 'Masvingo', 'BRANCH', true),
  ('CHIREDZI', 'Chiredzi', 'BRANCH', true),
  ('GLENDALE', 'Glendale', 'BRANCH', true),
  ('MAZORODZE', 'Mazorodze', 'BRANCH', true),
  ('MAKONI', 'Makoni', 'BRANCH', true),
  ('BINDURA', 'Bindura', 'BRANCH', true),
  ('GWERU', 'Gweru', 'BRANCH', true)
ON CONFLICT (branch_code) DO NOTHING;

-- Enable RLS on chick_branches
ALTER TABLE chick_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read chick_branches" ON chick_branches FOR SELECT TO authenticated USING (true);
