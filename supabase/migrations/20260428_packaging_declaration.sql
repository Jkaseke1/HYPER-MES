-- Packaging items on Macropack BOMs
CREATE TABLE IF NOT EXISTS macropack_bom_packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid REFERENCES macropack_boms(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  expected_qty_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Actual packaging used per Macropack order
CREATE TABLE IF NOT EXISTS macropack_packaging_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES macropack_manufacture_orders(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  description text NOT NULL,
  expected_qty numeric,
  actual_qty numeric NOT NULL,
  variance_qty numeric GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Packaging items on Production BOMs (main plant) — FK verified: production_orders.formulation_id
CREATE TABLE IF NOT EXISTS production_bom_packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulation_id uuid REFERENCES formulations(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  expected_qty_per_tonne numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Actual packaging used per Production Order batch
CREATE TABLE IF NOT EXISTS production_packaging_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  description text NOT NULL,
  expected_qty numeric,
  actual_qty numeric NOT NULL,
  variance_qty numeric GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE macropack_bom_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE macropack_packaging_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_bom_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_packaging_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_macropack_bom_pkg" ON macropack_bom_packaging FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_macropack_pkg_issues" ON macropack_packaging_issues FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_prod_bom_pkg" ON production_bom_packaging FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_prod_pkg_issues" ON production_packaging_issues FOR ALL USING (auth.role() = 'authenticated');
