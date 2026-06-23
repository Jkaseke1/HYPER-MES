-- =====================================================
-- PRODUCTION ONLY RESET SCRIPT
-- =====================================================
-- This script ONLY clears production-related data:
-- - Production Orders (all statuses)
-- - Production Plans
-- - Production Logs
-- 
-- PRESERVES:
-- - GRNs and all raw material data
-- - Stock levels (unchanged)
-- - Stock Takes
-- - Dispatch Orders
-- - Everything else
-- =====================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- =====================================================
-- PRODUCTION MODULE ONLY - Clear production data
-- =====================================================

-- Production logs (must delete first due to foreign keys)
DELETE FROM production_logs WHERE 1=1;

-- Production order materials
DELETE FROM production_order_materials WHERE 1=1;

-- Production orders
DELETE FROM production_orders WHERE 1=1;

-- Production plan items
DELETE FROM production_plan_items WHERE 1=1;

-- Production plans
DELETE FROM production_plans WHERE 1=1;

-- =====================================================
-- Reset Sequences
-- =====================================================

-- Reset Production Order sequence
ALTER SEQUENCE IF EXISTS production_orders_id_seq RESTART WITH 1;

-- Reset Production Plan sequence
ALTER SEQUENCE IF EXISTS production_plans_id_seq RESTART WITH 1;

-- =====================================================
-- Re-enable triggers
-- =====================================================
SET session_replication_role = 'origin';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check production counts (should all be 0)
SELECT 
  'Production Orders' as table_name, COUNT(*) as count FROM production_orders
UNION ALL
SELECT 'Production Plans', COUNT(*) FROM production_plans
UNION ALL
SELECT 'Production Logs', COUNT(*) FROM production_logs
ORDER BY table_name;

-- Verify GRNs are still there (should NOT be 0)
SELECT 'GRNs (PRESERVED)' as table_name, COUNT(*) as count FROM goods_received_notes;

-- Verify stock is unchanged (should show current stocks)
SELECT 
  code,
  name,
  current_stock,
  unit
FROM raw_materials
WHERE current_stock > 0
ORDER BY code
LIMIT 10;

-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ CLEARED:
--    - ALL Production Orders (all statuses)
--    - ALL Production Plans
--    - ALL Production Logs
--
-- ✅ PRESERVED:
--    - GRNs and all receiving data
--    - Raw material stocks (UNCHANGED)
--    - Stock Takes
--    - Stock Movements
--    - Dispatch Orders
--    - Quality Inspections
--    - Weigh Bridge Tickets
--    - All other modules
-- =====================================================
