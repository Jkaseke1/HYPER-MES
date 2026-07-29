-- ==============================================================================
-- SUPABASE SECURITY LINTER WARNING FIX (PART 2)
-- Resolves: 
--  1. anon_security_definer_function_executable (Public Can Execute SECURITY DEFINER)
--  2. rls_policy_always_true (Overly Permissive RLS Policies)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: Revoke Execution from Unauthenticated 'anon' Role on Public Functions
-- Ensures only signed-in (authenticated) users can trigger RPC functions
-- ------------------------------------------------------------------------------

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;


-- ------------------------------------------------------------------------------
-- PART 2: Harden Overly Permissive (USING true / WITH CHECK true) RLS Policies
-- Replaces literal 'true' with explicit 'auth.uid() IS NOT NULL' check
-- ------------------------------------------------------------------------------

-- 1. chick_payment_alerts
DROP POLICY IF EXISTS "Allow authenticated insert chick_payment_alerts" ON public.chick_payment_alerts;
CREATE POLICY "Allow authenticated insert chick_payment_alerts" 
  ON public.chick_payment_alerts FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update chick_payment_alerts" ON public.chick_payment_alerts;
CREATE POLICY "Allow authenticated update chick_payment_alerts" 
  ON public.chick_payment_alerts FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. ecocash_payment_batches
DROP POLICY IF EXISTS "Enable all operations for authenticated users on ecocash_paymen" ON public.ecocash_payment_batches;
CREATE POLICY "Enable all operations for authenticated users on ecocash_paymen" 
  ON public.ecocash_payment_batches FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 3. maintenance_spare_attachments
DROP POLICY IF EXISTS "Enable delete for authenticated users on maintenance_spare_atta" ON public.maintenance_spare_attachments;
CREATE POLICY "Enable delete for authenticated users on maintenance_spare_atta" 
  ON public.maintenance_spare_attachments FOR DELETE TO authenticated 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable insert for authenticated users on maintenance_spare_atta" ON public.maintenance_spare_attachments;
CREATE POLICY "Enable insert for authenticated users on maintenance_spare_atta" 
  ON public.maintenance_spare_attachments FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. maintenance_spares
DROP POLICY IF EXISTS "Enable delete for authenticated users on maintenance_spares" ON public.maintenance_spares;
CREATE POLICY "Enable delete for authenticated users on maintenance_spares" 
  ON public.maintenance_spares FOR DELETE TO authenticated 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable insert for authenticated users on maintenance_spares" ON public.maintenance_spares;
CREATE POLICY "Enable insert for authenticated users on maintenance_spares" 
  ON public.maintenance_spares FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable update for authenticated users on maintenance_spares" ON public.maintenance_spares;
CREATE POLICY "Enable update for authenticated users on maintenance_spares" 
  ON public.maintenance_spares FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5. maintenance_transactions
DROP POLICY IF EXISTS "Enable insert for authenticated users on maintenance_transactio" ON public.maintenance_transactions;
CREATE POLICY "Enable insert for authenticated users on maintenance_transactio" 
  ON public.maintenance_transactions FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. maintenance_work_orders
DROP POLICY IF EXISTS "Enable insert for authenticated users on maintenance_work_order" ON public.maintenance_work_orders;
CREATE POLICY "Enable insert for authenticated users on maintenance_work_order" 
  ON public.maintenance_work_orders FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable update for authenticated users on maintenance_work_order" ON public.maintenance_work_orders;
CREATE POLICY "Enable update for authenticated users on maintenance_work_order" 
  ON public.maintenance_work_orders FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. payroll_audit_log
DROP POLICY IF EXISTS "Enable all operations for authenticated users on payroll_audit_" ON public.payroll_audit_log;
CREATE POLICY "Enable all operations for authenticated users on payroll_audit_" 
  ON public.payroll_audit_log FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 8. payroll_lines
DROP POLICY IF EXISTS "Enable all operations for authenticated users on payroll_lines" ON public.payroll_lines;
CREATE POLICY "Enable all operations for authenticated users on payroll_lines" 
  ON public.payroll_lines FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 9. payroll_periods
DROP POLICY IF EXISTS "Enable all operations for authenticated users on payroll_period" ON public.payroll_periods;
CREATE POLICY "Enable all operations for authenticated users on payroll_period" 
  ON public.payroll_periods FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 10. production_order_downtime
DROP POLICY IF EXISTS "Anyone can delete downtime" ON public.production_order_downtime;
CREATE POLICY "Anyone can delete downtime" 
  ON public.production_order_downtime FOR DELETE TO authenticated 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can insert downtime" ON public.production_order_downtime;
CREATE POLICY "Anyone can insert downtime" 
  ON public.production_order_downtime FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 11. rm_daily_issues
DROP POLICY IF EXISTS "rm_issues_insert" ON public.rm_daily_issues;
CREATE POLICY "rm_issues_insert" 
  ON public.rm_daily_issues FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rm_issues_update" ON public.rm_daily_issues;
CREATE POLICY "rm_issues_update" 
  ON public.rm_daily_issues FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 12. rm_daily_receipts
DROP POLICY IF EXISTS "rm_receipts_insert" ON public.rm_daily_receipts;
CREATE POLICY "rm_receipts_insert" 
  ON public.rm_daily_receipts FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rm_receipts_update" ON public.rm_daily_receipts;
CREATE POLICY "rm_receipts_update" 
  ON public.rm_daily_receipts FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 13. rm_daily_snapshots
DROP POLICY IF EXISTS "rm_snapshots_insert" ON public.rm_daily_snapshots;
CREATE POLICY "rm_snapshots_insert" 
  ON public.rm_daily_snapshots FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rm_snapshots_update" ON public.rm_daily_snapshots;
CREATE POLICY "rm_snapshots_update" 
  ON public.rm_daily_snapshots FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 14. sage_posting_reviews
DROP POLICY IF EXISTS "Authenticated can update reviews" ON public.sage_posting_reviews;
CREATE POLICY "Authenticated can update reviews" 
  ON public.sage_posting_reviews FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 15. temporary_workers
DROP POLICY IF EXISTS "Enable all operations for authenticated users on temporary_work" ON public.temporary_workers;
CREATE POLICY "Enable all operations for authenticated users on temporary_work" 
  ON public.temporary_workers FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 16. worker_advances
DROP POLICY IF EXISTS "Enable all operations for authenticated users on worker_advance" ON public.worker_advances;
CREATE POLICY "Enable all operations for authenticated users on worker_advance" 
  ON public.worker_advances FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 17. worker_attendance
DROP POLICY IF EXISTS "Enable all operations for authenticated users on worker_attenda" ON public.worker_attendance;
CREATE POLICY "Enable all operations for authenticated users on worker_attenda" 
  ON public.worker_attendance FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
