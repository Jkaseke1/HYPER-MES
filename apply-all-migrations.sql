-- =====================================================
-- COMPLETE DATABASE SETUP FOR HYPER MES
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Migration 1: Core Infrastructure
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('production_manager', 'supervisor', 'warehouse_manager', 'operator', 'finance', 'admin')),
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text DEFAULT '',
  contact_person text DEFAULT '',
  phone text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read branches"
  ON branches FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert branches"
  ON branches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update branches"
  ON branches FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'raw_material' CHECK (type IN ('raw_material', 'finished_goods')),
  branch_id uuid REFERENCES branches(id),
  location text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read warehouses"
  ON warehouses FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert warehouses"
  ON warehouses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update warehouses"
  ON warehouses FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  type text DEFAULT '',
  capacity_per_hour numeric DEFAULT 0,
  capacity_unit text DEFAULT 'kg',
  status text DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'breakdown', 'decommissioned')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read machines"
  ON machines FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert machines"
  ON machines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update machines"
  ON machines FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  contact_person text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  payment_terms text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
  ON suppliers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

-- Formulation Finance Approval & Daily Selection
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approval_notes TEXT DEFAULT '';
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS is_daily_active BOOLEAN DEFAULT false;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS variation_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_formulations_code_daily_active ON formulations(code, is_daily_active);
CREATE INDEX IF NOT EXISTS idx_formulations_is_approved ON formulations(is_approved);

CREATE OR REPLACE FUNCTION set_daily_active_formulation(
  p_formulation_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM formulations WHERE id = p_formulation_id;

  IF v_code IS NOT NULL THEN
    UPDATE formulations
    SET is_daily_active = false
    WHERE code = v_code;
  END IF;

  UPDATE formulations
  SET is_daily_active = true,
      is_approved = true,
      approved_by = p_approved_by,
      approved_at = NOW(),
      approval_notes = COALESCE(p_notes, approval_notes),
      status = 'active',
      updated_at = NOW()
  WHERE id = p_formulation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


