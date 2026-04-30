-- Maintenance Spares Inventory Module
-- Plant Maintenance & Spares Inventory for HYPER-MES

-- 1. maintenance_spares table
CREATE TABLE IF NOT EXISTS maintenance_spares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_no integer,
  description text NOT NULL,
  machine text,
  category text CHECK (category IN ('Bearings', 'V-Belts', 'Oil Seals', 'Die Parts', 'Cylinders', 'Drives', 'Chains', 'Electrical', 'Lubricants', 'Filters', 'Rolls & Rods', 'Elevator Belts', 'Misc')),
  sub_group text CHECK (sub_group IN ('Pelletiser', 'Dog Extruder', 'Full Fat Extruder', 'Hammer Mill', 'Elevator', 'Compressor', 'Boiler', 'Red Plant', 'Conveyor', 'Mixer', 'Crumpler', 'Rotary Feeder', 'Pneumatic Cylinders', 'Drives', 'Forklift', 'General', 'Extruder', 'Powder Cleaners', 'Cooler', 'Augers', 'Pneumatics & Valves')),
  qty_on_hand numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'pcs' CHECK (unit IN ('pcs', 'm', 'L', 'kg', 'sets')),
  notes text,
  dimensions_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. maintenance_transactions table
CREATE TABLE IF NOT EXISTS maintenance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_id uuid REFERENCES maintenance_spares(id) ON DELETE CASCADE,
  transaction_type text CHECK (transaction_type IN ('issue', 'receipt', 'adjustment', 'write_off')),
  quantity numeric NOT NULL,
  reference text,
  performed_by text,
  created_at timestamptz DEFAULT now(),
  notes text
);

-- 3. maintenance_work_orders table (scaffold for phase 2)
CREATE TABLE IF NOT EXISTS maintenance_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text UNIQUE,
  machine text,
  description text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  planned_date date,
  completed_date date,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- 4. maintenance_spare_attachments table (for drawings/photos)
CREATE TABLE IF NOT EXISTS maintenance_spare_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_id uuid REFERENCES maintenance_spares(id) ON DELETE CASCADE,
  file_name text,
  file_url text,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_spares_category ON maintenance_spares(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_spares_sub_group ON maintenance_spares(sub_group);
CREATE INDEX IF NOT EXISTS idx_maintenance_spares_machine ON maintenance_spares(machine);
CREATE INDEX IF NOT EXISTS idx_maintenance_transactions_spare_id ON maintenance_transactions(spare_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_transactions_created_at ON maintenance_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_work_orders_status ON maintenance_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_spare_attachments_spare_id ON maintenance_spare_attachments(spare_id);

-- Enable Row Level Security
ALTER TABLE maintenance_spares ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_spare_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - can be tightened later)
CREATE POLICY "Enable read access for authenticated users on maintenance_spares"
  ON maintenance_spares FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users on maintenance_spares"
  ON maintenance_spares FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on maintenance_spares"
  ON maintenance_spares FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users on maintenance_spares"
  ON maintenance_spares FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on maintenance_transactions"
  ON maintenance_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users on maintenance_transactions"
  ON maintenance_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users on maintenance_work_orders"
  ON maintenance_work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users on maintenance_work_orders"
  ON maintenance_work_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on maintenance_work_orders"
  ON maintenance_work_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users on maintenance_spare_attachments"
  ON maintenance_spare_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users on maintenance_spare_attachments"
  ON maintenance_spare_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users on maintenance_spare_attachments"
  ON maintenance_spare_attachments FOR DELETE
  TO authenticated
  USING (true);

-- Comments
COMMENT ON TABLE maintenance_spares IS 'Spare parts inventory for plant maintenance';
COMMENT ON TABLE maintenance_transactions IS 'Transaction history for spare parts (issue/receive/adjustment/write-off)';
COMMENT ON TABLE maintenance_work_orders IS 'Maintenance work orders (scaffold for phase 2)';
COMMENT ON TABLE maintenance_spare_attachments IS 'Attachments for spare parts (drawings, photos)';
COMMENT ON COLUMN maintenance_spares.item_no IS 'Sequential reference number';
COMMENT ON COLUMN maintenance_spares.description IS 'Part name/spec with bearing codes, belt sizes, etc.';
COMMENT ON COLUMN maintenance_spares.machine IS 'What machine/application the spare belongs to';
COMMENT ON COLUMN maintenance_spares.category IS 'Part category (Bearings, V-Belts, Oil Seals, etc.)';
COMMENT ON COLUMN maintenance_spares.sub_group IS 'Machine sub-group (Pelletiser, Hammer Mill, etc.)';
COMMENT ON COLUMN maintenance_spares.qty_on_hand IS 'Current stock on hand';
COMMENT ON COLUMN maintenance_spares.min_stock IS 'Reorder threshold';
COMMENT ON COLUMN maintenance_spares.unit IS 'Unit of measure (pcs, m, L, kg, sets)';
COMMENT ON COLUMN maintenance_spares.notes IS 'Additional notes (grease fill %, life expectancy, etc.)';
COMMENT ON COLUMN maintenance_spares.dimensions_notes IS 'Dimension data (160mm shaft, 32mm bore, etc.)';
