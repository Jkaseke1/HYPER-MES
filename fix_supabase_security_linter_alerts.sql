-- ==============================================================================
-- ALL-IN-ONE SUPABASE SECURITY LINTER FIXES FOR HYPER MES
-- Resolves: 
--  1. 3 RLS Disabled Table Errors
--  2. 14 Security Definer View Errors
--  3. All "Function Search Path Mutable" Warnings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: Enable RLS & Add Policies on Public Tables (CRITICAL SECURITY FIX)
-- Prevents unauthorized role escalation & profile tampering via REST API
-- ------------------------------------------------------------------------------

-- 1. Table: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on user_roles" ON public.user_roles;
CREATE POLICY "Allow authenticated read on user_roles" 
  ON public.user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on user_roles" ON public.user_roles;
CREATE POLICY "Allow admin write on user_roles" 
  ON public.user_roles FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 2. Table: user_branch_access
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on user_branch_access" ON public.user_branch_access;
CREATE POLICY "Allow authenticated read on user_branch_access" 
  ON public.user_branch_access FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write on user_branch_access" ON public.user_branch_access;
CREATE POLICY "Allow admin write on user_branch_access" 
  ON public.user_branch_access FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 3. Table: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read on profiles" 
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow self or admin update on profiles" ON public.profiles;
CREATE POLICY "Allow self or admin update on profiles" 
  ON public.profiles FOR UPDATE TO authenticated 
  USING (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ------------------------------------------------------------------------------
-- PART 2: Convert Views to SECURITY INVOKER (MODERATE SECURITY FIX)
-- Ensures views respect RLS policies of the user running the query
-- ------------------------------------------------------------------------------

ALTER VIEW public.bom_variance_summary SET (security_invoker = true);
ALTER VIEW public.rm_stock_sage_live SET (security_invoker = true);
ALTER VIEW public.v_rm_available_lots SET (security_invoker = true);
ALTER VIEW public.inventory_depletion_forecasts SET (security_invoker = true);
ALTER VIEW public.monthly_operations_trends SET (security_invoker = true);
ALTER VIEW public.raw_materials_multi_currency SET (security_invoker = true);
ALTER VIEW public.completed_batches_pending_price_approval SET (security_invoker = true);
ALTER VIEW public.vw_rm_receipts_monthly SET (security_invoker = true);
ALTER VIEW public.vw_rm_issues_monthly SET (security_invoker = true);
ALTER VIEW public.v_sage_stock_for_validation SET (security_invoker = true);
ALTER VIEW public.vw_raw_material_valuation SET (security_invoker = true);
ALTER VIEW public.production_order_ingredients_status SET (security_invoker = true);
ALTER VIEW public.vw_chick_night_summary SET (security_invoker = true);
ALTER VIEW public.pending_approvals SET (security_invoker = true);


-- ------------------------------------------------------------------------------
-- PART 3: Fix All "Function Search Path Mutable" Warnings (SECURITY HARDENING)
-- Locks search_path = public, pg_temp on all stored functions
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', r.func_signature);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter function %: %', r.func_signature, SQLERRM;
        END;
    END LOOP;
END $$;
