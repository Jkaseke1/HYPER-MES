-- Openbravo-inspired: Process Loss Tracking + Job Cards (Per-Operation Tracking)

-- 1. Process Loss / Yield fields on production_orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS yield_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS process_loss_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS process_loss_qty numeric DEFAULT 0;

-- Trigger to auto-calculate yield and process loss on output update
CREATE OR REPLACE FUNCTION calc_production_yield()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.planned_qty > 0 AND NEW.actual_qty IS NOT NULL THEN
    NEW.yield_percentage := ROUND((NEW.actual_qty / NEW.planned_qty) * 100, 2);
    NEW.process_loss_qty := NEW.planned_qty - NEW.actual_qty - COALESCE(NEW.wastage_qty, 0) - COALESCE(NEW.rejected_qty, 0);
    NEW.process_loss_percentage := ROUND((NEW.process_loss_qty / NEW.planned_qty) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_yield ON production_orders;
CREATE TRIGGER trg_calc_yield
BEFORE UPDATE OF actual_qty, planned_qty, wastage_qty, rejected_qty ON production_orders
FOR EACH ROW
EXECUTE FUNCTION calc_production_yield();

-- 2. Job Cards (Per-Operation Tracking) — Openbravo MA_SEQUENCE / MA_WRPHASE inspired
CREATE TABLE IF NOT EXISTS production_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  seq_no integer NOT NULL DEFAULT 1,
  operation_name text NOT NULL, -- e.g. 'Mixing', 'Pelleting', 'Cooling', 'Bagging'
  description text DEFAULT '',
  workstation_id uuid REFERENCES machines(id), -- which production line/section
  
  -- Planned
  estimated_time_mins integer DEFAULT 0, -- setup + run time in minutes
  prep_time_mins integer DEFAULT 0, -- changeover/setup time (Openbravo PREPTIME)
  planned_qty numeric DEFAULT 0,
  
  -- Actual
  actual_start timestamptz,
  actual_end timestamptz,
  actual_time_mins integer DEFAULT 0,
  actual_qty numeric DEFAULT 0,
  rejected_qty numeric DEFAULT 0, -- scrap at this operation
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  
  -- Employees
  operator_id uuid REFERENCES profiles(id),
  supervisor_id uuid REFERENCES profiles(id),
  
  -- Notes
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Operation-specific material consumption (Openbravo MA_SEQUENCEPRODUCT)
CREATE TABLE IF NOT EXISTS production_operation_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES production_operations(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES raw_materials(id),
  planned_qty numeric DEFAULT 0,
  actual_qty numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  unit_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Downtime / Incidents per operation (Openbravo MA_WEINCIDENCE inspired)
CREATE TABLE IF NOT EXISTS production_downtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  operation_id uuid REFERENCES production_operations(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('Mechanical', 'Electrical', 'Material Shortage', 'Power Outage', 'Maintenance', 'Quality Issue', 'Other')),
  reason text DEFAULT '',
  downtime_mins integer NOT NULL DEFAULT 0,
  start_time timestamptz,
  end_time timestamptz,
  reported_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prod_ops_order ON production_operations(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_ops_status ON production_operations(status);
CREATE INDEX IF NOT EXISTS idx_prod_op_mats_operation ON production_operation_materials(operation_id);
CREATE INDEX IF NOT EXISTS idx_prod_downtime_order ON production_downtime(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_downtime_category ON production_downtime(category);

-- RLS
ALTER TABLE production_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_operation_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_downtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read production_operations"
  ON production_operations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_operations"
  ON production_operations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update production_operations"
  ON production_operations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read production_operation_materials"
  ON production_operation_materials FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_operation_materials"
  ON production_operation_materials FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update production_operation_materials"
  ON production_operation_materials FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read production_downtime"
  ON production_downtime FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_downtime"
  ON production_downtime FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update production_downtime"
  ON production_downtime FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed default operations for feed manufacturing (can be customized per company)
CREATE TABLE IF NOT EXISTS operation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  default_estimated_time_mins integer DEFAULT 60,
  default_prep_time_mins integer DEFAULT 15,
  seq_no integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed default feed manufacturing operations
INSERT INTO operation_templates (name, description, default_estimated_time_mins, default_prep_time_mins, seq_no)
VALUES
  ('Mixing', 'Blend raw materials according to formulation', 45, 10, 1),
  ('Pelleting', 'Compress mixed material through pellet mill', 60, 15, 2),
  ('Cooling', 'Cool pellets to ambient temperature', 30, 5, 3),
  ('Bagging', 'Weigh and bag finished product', 45, 10, 4)
ON CONFLICT DO NOTHING;
