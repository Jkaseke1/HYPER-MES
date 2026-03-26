/*
  # Optimize RLS Policies - Use (select auth.uid()) Pattern

  This migration updates all RLS policies across all tables to use `(select auth.uid())`
  instead of bare `auth.uid()`. The `(select ...)` wrapper ensures the auth function is
  evaluated once per query rather than re-evaluated for every row, which significantly
  improves query performance at scale.

  1. Tables Updated
    - profiles (3 policies)
    - branches (3 policies)
    - warehouses (3 policies)
    - machines (3 policies)
    - suppliers (3 policies)
    - raw_materials (4 policies)
    - goods_received_notes (3 policies)
    - grn_items (4 policies)
    - quality_inspections (3 policies)
    - formulations (4 policies)
    - formulation_ingredients (4 policies)
    - production_plans (3 policies)
    - production_plan_items (4 policies)
    - production_orders (3 policies)
    - production_order_materials (3 policies)
    - production_logs (3 policies)
    - production_outputs (3 policies)
    - stock_movements (2 policies)
    - dispatch_orders (3 policies)
    - dispatch_items (4 policies)

  2. Security Changes
    - No functional changes to access control
    - All policies retain the same authorization logic
    - Performance improvement only: auth.uid() evaluated once per query instead of per-row

  3. Important Notes
    - Each policy is dropped and recreated with the optimized pattern
    - This is a safe operation as the policies are recreated in the same transaction
*/

-- ==========================================
-- PROFILES
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- ==========================================
-- BRANCHES
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read branches" ON branches;
CREATE POLICY "Authenticated users can read branches"
  ON branches FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert branches" ON branches;
CREATE POLICY "Authenticated users can insert branches"
  ON branches FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update branches" ON branches;
CREATE POLICY "Authenticated users can update branches"
  ON branches FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- WAREHOUSES
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read warehouses" ON warehouses;
CREATE POLICY "Authenticated users can read warehouses"
  ON warehouses FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert warehouses" ON warehouses;
CREATE POLICY "Authenticated users can insert warehouses"
  ON warehouses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update warehouses" ON warehouses;
CREATE POLICY "Authenticated users can update warehouses"
  ON warehouses FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- MACHINES
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read machines" ON machines;
CREATE POLICY "Authenticated users can read machines"
  ON machines FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert machines" ON machines;
CREATE POLICY "Authenticated users can insert machines"
  ON machines FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update machines" ON machines;
CREATE POLICY "Authenticated users can update machines"
  ON machines FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- SUPPLIERS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON suppliers;
CREATE POLICY "Authenticated users can read suppliers"
  ON suppliers FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON suppliers;
CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- RAW MATERIALS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read raw_materials" ON raw_materials;
CREATE POLICY "Authenticated users can read raw_materials"
  ON raw_materials FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert raw_materials" ON raw_materials;
CREATE POLICY "Authenticated users can insert raw_materials"
  ON raw_materials FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update raw_materials" ON raw_materials;
CREATE POLICY "Authenticated users can update raw_materials"
  ON raw_materials FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete raw_materials" ON raw_materials;
CREATE POLICY "Authenticated users can delete raw_materials"
  ON raw_materials FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- GOODS RECEIVED NOTES
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read grn" ON goods_received_notes;
CREATE POLICY "Authenticated users can read grn"
  ON goods_received_notes FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert grn" ON goods_received_notes;
CREATE POLICY "Authenticated users can insert grn"
  ON goods_received_notes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update grn" ON goods_received_notes;
CREATE POLICY "Authenticated users can update grn"
  ON goods_received_notes FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- GRN ITEMS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read grn_items" ON grn_items;
CREATE POLICY "Authenticated users can read grn_items"
  ON grn_items FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert grn_items" ON grn_items;
CREATE POLICY "Authenticated users can insert grn_items"
  ON grn_items FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update grn_items" ON grn_items;
CREATE POLICY "Authenticated users can update grn_items"
  ON grn_items FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete grn_items" ON grn_items;
CREATE POLICY "Authenticated users can delete grn_items"
  ON grn_items FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- QUALITY INSPECTIONS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read quality_inspections" ON quality_inspections;
CREATE POLICY "Authenticated users can read quality_inspections"
  ON quality_inspections FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert quality_inspections" ON quality_inspections;
CREATE POLICY "Authenticated users can insert quality_inspections"
  ON quality_inspections FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update quality_inspections" ON quality_inspections;
CREATE POLICY "Authenticated users can update quality_inspections"
  ON quality_inspections FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- FORMULATIONS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read formulations" ON formulations;
CREATE POLICY "Authenticated users can read formulations"
  ON formulations FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert formulations" ON formulations;
CREATE POLICY "Authenticated users can insert formulations"
  ON formulations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update formulations" ON formulations;
CREATE POLICY "Authenticated users can update formulations"
  ON formulations FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete formulations" ON formulations;
CREATE POLICY "Authenticated users can delete formulations"
  ON formulations FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- FORMULATION INGREDIENTS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read formulation_ingredients" ON formulation_ingredients;
CREATE POLICY "Authenticated users can read formulation_ingredients"
  ON formulation_ingredients FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert formulation_ingredients" ON formulation_ingredients;
CREATE POLICY "Authenticated users can insert formulation_ingredients"
  ON formulation_ingredients FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update formulation_ingredients" ON formulation_ingredients;
CREATE POLICY "Authenticated users can update formulation_ingredients"
  ON formulation_ingredients FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete formulation_ingredients" ON formulation_ingredients;
CREATE POLICY "Authenticated users can delete formulation_ingredients"
  ON formulation_ingredients FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION PLANS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_plans" ON production_plans;
CREATE POLICY "Authenticated users can read production_plans"
  ON production_plans FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_plans" ON production_plans;
CREATE POLICY "Authenticated users can insert production_plans"
  ON production_plans FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_plans" ON production_plans;
CREATE POLICY "Authenticated users can update production_plans"
  ON production_plans FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION PLAN ITEMS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_plan_items" ON production_plan_items;
CREATE POLICY "Authenticated users can read production_plan_items"
  ON production_plan_items FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_plan_items" ON production_plan_items;
CREATE POLICY "Authenticated users can insert production_plan_items"
  ON production_plan_items FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_plan_items" ON production_plan_items;
CREATE POLICY "Authenticated users can update production_plan_items"
  ON production_plan_items FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete production_plan_items" ON production_plan_items;
CREATE POLICY "Authenticated users can delete production_plan_items"
  ON production_plan_items FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION ORDERS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_orders" ON production_orders;
CREATE POLICY "Authenticated users can read production_orders"
  ON production_orders FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_orders" ON production_orders;
CREATE POLICY "Authenticated users can insert production_orders"
  ON production_orders FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_orders" ON production_orders;
CREATE POLICY "Authenticated users can update production_orders"
  ON production_orders FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION ORDER MATERIALS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_order_materials" ON production_order_materials;
CREATE POLICY "Authenticated users can read production_order_materials"
  ON production_order_materials FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_order_materials" ON production_order_materials;
CREATE POLICY "Authenticated users can insert production_order_materials"
  ON production_order_materials FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_order_materials" ON production_order_materials;
CREATE POLICY "Authenticated users can update production_order_materials"
  ON production_order_materials FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION LOGS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_logs" ON production_logs;
CREATE POLICY "Authenticated users can read production_logs"
  ON production_logs FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_logs" ON production_logs;
CREATE POLICY "Authenticated users can insert production_logs"
  ON production_logs FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_logs" ON production_logs;
CREATE POLICY "Authenticated users can update production_logs"
  ON production_logs FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- PRODUCTION OUTPUTS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read production_outputs" ON production_outputs;
CREATE POLICY "Authenticated users can read production_outputs"
  ON production_outputs FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert production_outputs" ON production_outputs;
CREATE POLICY "Authenticated users can insert production_outputs"
  ON production_outputs FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update production_outputs" ON production_outputs;
CREATE POLICY "Authenticated users can update production_outputs"
  ON production_outputs FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- STOCK MOVEMENTS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read stock_movements" ON stock_movements;
CREATE POLICY "Authenticated users can read stock_movements"
  ON stock_movements FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert stock_movements" ON stock_movements;
CREATE POLICY "Authenticated users can insert stock_movements"
  ON stock_movements FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- DISPATCH ORDERS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read dispatch_orders" ON dispatch_orders;
CREATE POLICY "Authenticated users can read dispatch_orders"
  ON dispatch_orders FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert dispatch_orders" ON dispatch_orders;
CREATE POLICY "Authenticated users can insert dispatch_orders"
  ON dispatch_orders FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update dispatch_orders" ON dispatch_orders;
CREATE POLICY "Authenticated users can update dispatch_orders"
  ON dispatch_orders FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ==========================================
-- DISPATCH ITEMS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can read dispatch_items" ON dispatch_items;
CREATE POLICY "Authenticated users can read dispatch_items"
  ON dispatch_items FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert dispatch_items" ON dispatch_items;
CREATE POLICY "Authenticated users can insert dispatch_items"
  ON dispatch_items FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update dispatch_items" ON dispatch_items;
CREATE POLICY "Authenticated users can update dispatch_items"
  ON dispatch_items FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete dispatch_items" ON dispatch_items;
CREATE POLICY "Authenticated users can delete dispatch_items"
  ON dispatch_items FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);