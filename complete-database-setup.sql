-- =====================================================
-- COMPLETE DATABASE SETUP - ALL REMAINING MIGRATIONS
-- Run this in Supabase SQL Editor after Step 2
-- =====================================================

-- STEP 2: CREATE YOUR ADMIN PROFILE (RUN THIS FIRST!)
-- Copy this separately and run it first:
/*
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Joseph Kaseke'), 'admin'
FROM auth.users
WHERE email = 'kasekejoseph19@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
*/

-- =====================================================
-- THEN RUN EVERYTHING BELOW
-- =====================================================

-- Raw Materials Tables
CREATE TABLE IF NOT EXISTS raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  category text DEFAULT '' CHECK (category IN ('grain', 'protein', 'mineral', 'vitamin', 'additive', 'other', '')),
  unit text NOT NULL DEFAULT 'kg',
  cost_per_unit numeric DEFAULT 0,
  reorder_level numeric DEFAULT 0,
  current_stock numeric DEFAULT 0,
  warehouse_id uuid REFERENCES warehouses(id),
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read raw_materials" ON raw_materials FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert raw_materials" ON raw_materials FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update raw_materials" ON raw_materials FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete raw_materials" ON raw_materials FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  warehouse_id uuid REFERENCES warehouses(id),
  received_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'inspecting', 'approved', 'rejected')),
  notes text DEFAULT '',
  received_by uuid REFERENCES profiles(id),
  total_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read grn" ON goods_received_notes FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert grn" ON goods_received_notes FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update grn" ON goods_received_notes FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES raw_materials(id),
  ordered_qty numeric DEFAULT 0,
  received_qty numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  batch_number text DEFAULT '',
  expiry_date date,
  line_total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read grn_items" ON grn_items FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert grn_items" ON grn_items FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update grn_items" ON grn_items FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete grn_items" ON grn_items FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES goods_received_notes(id),
  raw_material_id uuid REFERENCES raw_materials(id),
  batch_number text DEFAULT '',
  inspection_date date DEFAULT CURRENT_DATE,
  inspector_id uuid REFERENCES profiles(id),
  result text DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'conditional')),
  moisture_content numeric,
  protein_content numeric,
  fat_content numeric,
  fiber_content numeric,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read quality_inspections" ON quality_inspections FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert quality_inspections" ON quality_inspections FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update quality_inspections" ON quality_inspections FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Formulations Tables
CREATE TABLE IF NOT EXISTS formulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  version integer DEFAULT 1,
  category text DEFAULT '' CHECK (category IN ('broiler', 'layer', 'dairy', 'pig', 'horse', 'pet', 'other', '')),
  description text DEFAULT '',
  batch_size numeric NOT NULL DEFAULT 1000,
  batch_unit text DEFAULT 'kg',
  target_protein numeric DEFAULT 0,
  target_fat numeric DEFAULT 0,
  target_fiber numeric DEFAULT 0,
  target_moisture numeric DEFAULT 0,
  estimated_cost_per_unit numeric DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE formulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read formulations" ON formulations FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert formulations" ON formulations FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update formulations" ON formulations FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete formulations" ON formulations FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS formulation_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulation_id uuid REFERENCES formulations(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES raw_materials(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'kg',
  percentage numeric DEFAULT 0,
  is_critical boolean DEFAULT false,
  notes text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE formulation_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read formulation_ingredients" ON formulation_ingredients FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert formulation_ingredients" ON formulation_ingredients FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update formulation_ingredients" ON formulation_ingredients FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete formulation_ingredients" ON formulation_ingredients FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- Production Tables
CREATE TABLE IF NOT EXISTS production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_number text UNIQUE NOT NULL,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_plans" ON production_plans FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_plans" ON production_plans FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_plans" ON production_plans FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS production_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES production_plans(id) ON DELETE CASCADE,
  formulation_id uuid REFERENCES formulations(id),
  planned_qty numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'kg',
  priority integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_plan_items" ON production_plan_items FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_plan_items" ON production_plan_items FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_plan_items" ON production_plan_items FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete production_plan_items" ON production_plan_items FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  plan_id uuid REFERENCES production_plans(id),
  formulation_id uuid REFERENCES formulations(id),
  machine_id uuid REFERENCES machines(id),
  planned_qty numeric NOT NULL DEFAULT 0,
  actual_qty numeric DEFAULT 0,
  rejected_qty numeric DEFAULT 0,
  wastage_qty numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'materials_issued', 'in_progress', 'completed', 'cancelled')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  operator_id uuid REFERENCES profiles(id),
  supervisor_id uuid REFERENCES profiles(id),
  raw_material_cost numeric DEFAULT 0,
  labour_cost numeric DEFAULT 0,
  machine_cost numeric DEFAULT 0,
  overhead_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  cost_per_unit numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_orders" ON production_orders FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_orders" ON production_orders FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_orders" ON production_orders FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS production_order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES raw_materials(id),
  planned_qty numeric NOT NULL DEFAULT 0,
  actual_qty numeric DEFAULT 0,
  wastage_qty numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  unit_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  issued boolean DEFAULT false,
  issued_at timestamptz,
  issued_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_order_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_order_materials" ON production_order_materials FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_order_materials" ON production_order_materials FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_order_materials" ON production_order_materials FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS production_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES machines(id),
  operator_id uuid REFERENCES profiles(id),
  log_type text NOT NULL DEFAULT 'info' CHECK (log_type IN ('start', 'stop', 'pause', 'resume', 'downtime', 'issue', 'info')),
  description text DEFAULT '',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_minutes numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_logs" ON production_logs FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_logs" ON production_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_logs" ON production_logs FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS production_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  batch_number text NOT NULL DEFAULT '',
  quantity_produced numeric NOT NULL DEFAULT 0,
  rejected_quantity numeric DEFAULT 0,
  wastage_quantity numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  warehouse_id uuid REFERENCES warehouses(id),
  quality_status text DEFAULT 'pending' CHECK (quality_status IN ('pending', 'passed', 'failed')),
  recorded_by uuid REFERENCES profiles(id),
  recorded_at timestamptz DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read production_outputs" ON production_outputs FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert production_outputs" ON production_outputs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update production_outputs" ON production_outputs FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Warehouse & Dispatch Tables
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'transfer', 'adjustment', 'production_input', 'production_output', 'dispatch')),
  reference_type text DEFAULT '',
  reference_id uuid,
  raw_material_id uuid REFERENCES raw_materials(id),
  formulation_id uuid REFERENCES formulations(id),
  warehouse_id uuid REFERENCES warehouses(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'kg',
  batch_number text DEFAULT '',
  movement_date timestamptz DEFAULT now(),
  performed_by uuid REFERENCES profiles(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read stock_movements" ON stock_movements FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert stock_movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text UNIQUE NOT NULL,
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid REFERENCES warehouses(id),
  dispatch_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'loading', 'dispatched', 'in_transit', 'delivered', 'cancelled')),
  vehicle_number text DEFAULT '',
  driver_name text DEFAULT '',
  total_weight numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  prepared_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  delivery_notes text DEFAULT '',
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dispatch_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dispatch_orders" ON dispatch_orders FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert dispatch_orders" ON dispatch_orders FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update dispatch_orders" ON dispatch_orders FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE TABLE IF NOT EXISTS dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id uuid REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  formulation_id uuid REFERENCES formulations(id),
  batch_number text DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'kg',
  unit_price numeric DEFAULT 0,
  line_total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dispatch_items" ON dispatch_items FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can insert dispatch_items" ON dispatch_items FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can update dispatch_items" ON dispatch_items FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can delete dispatch_items" ON dispatch_items FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- Create all indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON stock_movements(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_batch ON production_orders(batch_number);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_branch ON dispatch_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_status ON dispatch_orders(status);
CREATE INDEX IF NOT EXISTS idx_raw_materials_code ON raw_materials(code);
CREATE INDEX IF NOT EXISTS idx_formulations_code ON formulations(code);
CREATE INDEX IF NOT EXISTS idx_raw_materials_warehouse_id ON raw_materials(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_formulation_id ON stock_movements(formulation_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by ON stock_movements(performed_by);
CREATE INDEX IF NOT EXISTS idx_warehouses_branch_id ON warehouses(branch_id);
