-- Chick Distribution Schedule (replaces manual Excel)

-- Routes / Locations (e.g. Hukuru, Irvines, Masvingo, Kudu)
CREATE TABLE IF NOT EXISTS chick_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- e.g. 'Hukuru', 'Irvines', 'Masvingo', 'Kudu'
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Customers / Branches receiving chicks
CREATE TABLE IF NOT EXISTS chick_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- e.g. 'Ametec', 'Bulawayo', 'Bindura', 'Mutare'
  code text UNIQUE, -- short code
  route_id uuid REFERENCES chick_routes(id),
  contact_person text DEFAULT '',
  phone text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Weekly distribution schedules
CREATE TABLE IF NOT EXISTS chick_distribution_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ending date NOT NULL, -- Sunday of the week
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed')),
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Individual daily deliveries within a schedule
CREATE TABLE IF NOT EXISTS chick_distribution_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES chick_distribution_schedules(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES chick_customers(id),
  delivery_date date NOT NULL,
  route_id uuid REFERENCES chick_routes(id),
  planned_qty integer NOT NULL DEFAULT 0,
  actual_qty integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'partial', 'cancelled')),
  vehicle_ref text DEFAULT '',
  driver_name text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chick_dist_lines_schedule ON chick_distribution_lines(schedule_id);
CREATE INDEX IF NOT EXISTS idx_chick_dist_lines_date ON chick_distribution_lines(delivery_date);
CREATE INDEX IF NOT EXISTS idx_chick_dist_lines_customer ON chick_distribution_lines(customer_id);

-- RLS
ALTER TABLE chick_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chick_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chick_distribution_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE chick_distribution_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chick_routes"
  ON chick_routes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage chick_routes"
  ON chick_routes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read chick_customers"
  ON chick_customers FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage chick_customers"
  ON chick_customers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read chick_distribution_schedules"
  ON chick_distribution_schedules FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage chick_distribution_schedules"
  ON chick_distribution_schedules FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read chick_distribution_lines"
  ON chick_distribution_lines FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage chick_distribution_lines"
  ON chick_distribution_lines FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed default routes matching the Excel
INSERT INTO chick_routes (name, description, sort_order) VALUES
  ('Hukuru', 'Hukuru delivery route', 1),
  ('Irvines', 'Irvines delivery route', 2),
  ('Masvingo', 'Masvingo delivery route', 3),
  ('Kudu', 'Kudu delivery route', 4)
ON CONFLICT DO NOTHING;

-- Seed default customers matching the Excel
INSERT INTO chick_customers (name, code) VALUES
  ('Ametec', 'AMTEC'),
  ('Bulawayo', 'BYO'),
  ('Bindura', 'BIND'),
  ('Factory Sale', 'FACT'),
  ('Epworth', 'EPW'),
  ('Kaguvi', 'KGV'),
  ('Glendale', 'GLEN'),
  ('D/Main', 'DMAIN'),
  ('D/Avondale', 'DAVON'),
  ('Chikovan', 'CHK'),
  ('Makoni', 'MKONI'),
  ('Marondera', 'MARON'),
  ('Masvingo', 'MSV'),
  ('S/Mazowe', 'SMZ'),
  ('Mbudzi', 'MBD'),
  ('Dangamvura', 'DNG'),
  ('Chikanga', 'CHKNG'),
  ('Mutare', 'MTR'),
  ('South Winds', 'SWND'),
  ('Hatcliffe', 'HAT'),
  ('Masasa', 'MAS'),
  ('Ngezi', 'NGEZ'),
  ('Chiredzi', 'CHRDZ'),
  ('Showground', 'SHGRND'),
  ('Gweru', 'GWE'),
  ('Murewa', 'MUR'),
  ('Mutoko', 'MUTK'),
  ('Lucky Musinga', 'LUCKY'),
  ('Zvichavan', 'ZVI')
ON CONFLICT DO NOTHING;
