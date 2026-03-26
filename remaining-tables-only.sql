-- =====================================================
-- CREATE ONLY MISSING TABLES
-- This skips raw_materials which already exists
-- =====================================================

-- Check what tables exist and create only missing ones

-- Reconciliation Tables (likely missing)
CREATE TABLE IF NOT EXISTS reconciliation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  branch_id uuid REFERENCES branches(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
  received_raw_materials_t numeric NOT NULL DEFAULT 0,
  transferred_rm_to_prod_t numeric NOT NULL DEFAULT 0,
  exp_production_via_bulks_t numeric NOT NULL DEFAULT 0,
  exp_production_via_macropacks_t numeric NOT NULL DEFAULT 0,
  exp_production_via_packaging_t numeric NOT NULL DEFAULT 0,
  actual_declared_production_t numeric NOT NULL DEFAULT 0,
  transferred_prod_to_dispatch_t numeric NOT NULL DEFAULT 0,
  expected_dispatched_t numeric NOT NULL DEFAULT 0,
  actual_dispatched_t numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(month, year, branch_id)
);

ALTER TABLE reconciliation_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view reconciliation periods" ON reconciliation_periods;
CREATE POLICY "Authenticated users can view reconciliation periods" ON reconciliation_periods FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can create reconciliation periods" ON reconciliation_periods;
CREATE POLICY "Authenticated users can create reconciliation periods" ON reconciliation_periods FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can update reconciliation periods" ON reconciliation_periods;
CREATE POLICY "Authenticated users can update reconciliation periods" ON reconciliation_periods FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can delete draft reconciliation periods" ON reconciliation_periods;
CREATE POLICY "Authenticated users can delete draft reconciliation periods" ON reconciliation_periods FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL AND status = 'draft');

-- Verify all tables exist
DO $$
BEGIN
  RAISE NOTICE 'Database setup verification:';
  RAISE NOTICE 'profiles: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles'));
  RAISE NOTICE 'branches: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'branches'));
  RAISE NOTICE 'warehouses: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouses'));
  RAISE NOTICE 'machines: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machines'));
  RAISE NOTICE 'suppliers: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers'));
  RAISE NOTICE 'raw_materials: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'raw_materials'));
  RAISE NOTICE 'formulations: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'formulations'));
  RAISE NOTICE 'production_orders: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_orders'));
  RAISE NOTICE 'dispatch_orders: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dispatch_orders'));
END $$;
