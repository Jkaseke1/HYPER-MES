-- =====================================================
-- HYPER MES TEST DATA RESET SCRIPT
-- =====================================================
-- This script clears all transactional data while preserving:
-- - Schema structure
-- - Master data (suppliers, branches, warehouses, machines)
-- - User profiles
-- - Formulations (optional - can be commented out)
-- =====================================================

-- Disable triggers temporarily to avoid cascading issues
SET session_replication_role = 'replica';

-- =====================================================
-- 1. PRODUCTION MODULE - Clear transactional data
-- =====================================================

-- Production logs (must delete first due to foreign keys)
DELETE FROM production_logs;

-- Production order materials
DELETE FROM production_order_materials;

-- Production orders
DELETE FROM production_orders;

-- Production plan items
DELETE FROM production_plan_items;

-- Production plans
DELETE FROM production_plans;

-- Stock movements
DELETE FROM stock_movements;

-- Dispatch items
DELETE FROM dispatch_items;

-- Dispatch orders
DELETE FROM dispatch_orders;

-- =====================================================
-- 2. RAW MATERIALS MODULE - Clear transactional data
-- =====================================================

-- Quality inspections
DELETE FROM quality_inspections;

-- GRN items
DELETE FROM grn_items;

-- Goods received notes
DELETE FROM goods_received_notes;

-- =====================================================
-- 3. STOCK MANAGEMENT - Reset ALL stocks to ZERO
-- =====================================================

-- Clear raw material lots (this drives current_stock)
DELETE FROM raw_material_lots WHERE 1=1;

-- Reset current_stock to ZERO for all raw materials
UPDATE raw_materials SET current_stock = 0 WHERE 1=1;

-- =====================================================
-- 4. STOCK TAKE - Clear all stock take records
-- =====================================================

-- Stock take audit log (must delete first)
DELETE FROM stock_take_audit_log WHERE 1=1;

-- Stock take lines
DELETE FROM stock_take_lines WHERE 1=1;

-- Stock takes
DELETE FROM stock_takes WHERE 1=1;

-- =====================================================
-- 5. CHICK MANAGEMENT MODULE - Clear transactional data
-- =====================================================

-- Chick payment alerts
DELETE FROM chick_payment_alerts WHERE 1=1;

-- Chick supplier invoices
DELETE FROM chick_supplier_invoices WHERE 1=1;

-- Chick delivery notes
DELETE FROM chick_delivery_notes WHERE 1=1;

-- Chick supplier consignments
DELETE FROM chick_supplier_consignments WHERE 1=1;

-- Chick hatch nights
DELETE FROM chick_hatch_nights WHERE 1=1;

-- Chick PO lines
DELETE FROM chick_po_lines WHERE 1=1;

-- Chick purchase orders
DELETE FROM chick_purchase_orders WHERE 1=1;

-- =====================================================
-- 6. MACROPACK MODULE - Clear transactional data
-- =====================================================

-- Macropack dispensing records (if exists)
DELETE FROM macropack_dispensing WHERE 1=1;

-- Macropack orders (if exists)
DELETE FROM macropack_orders WHERE 1=1;

-- =====================================================
-- 7. RECONCILIATION MODULE - Clear transactional data
-- =====================================================

-- Reconciliation variance items (if exists)
DELETE FROM reconciliation_variance_items WHERE 1=1;

-- Reconciliation periods (if exists)
DELETE FROM reconciliation_periods WHERE 1=1;

-- =====================================================
-- 8. PAYROLL MODULE - Clear transactional data (if exists)
-- =====================================================

-- Payroll audit log
DELETE FROM payroll_audit_log WHERE 1=1;

-- Ecocash payment batches
DELETE FROM ecocash_payment_batches WHERE 1=1;

-- Worker advances
DELETE FROM worker_advances WHERE 1=1;

-- Payroll lines
DELETE FROM payroll_lines WHERE 1=1;

-- Worker attendance
DELETE FROM worker_attendance WHERE 1=1;

-- Payroll periods
DELETE FROM payroll_periods WHERE 1=1;

-- Temporary workers
DELETE FROM temporary_workers WHERE 1=1;

-- =====================================================
-- 9. OPTIONAL: Clear Formulations (uncomment if needed)
-- =====================================================

-- Uncomment the following lines to also reset formulations:
-- DELETE FROM formulation_ingredients;
-- DELETE FROM formulations;

-- =====================================================
-- 10. OPTIONAL: Clear Raw Materials (uncomment if needed)
-- =====================================================

-- Uncomment to reset raw materials (WARNING: will affect formulations):
-- DELETE FROM raw_materials;

-- =====================================================
-- 11. OPTIONAL: Clear Master Data (uncomment if needed)
-- =====================================================

-- Uncomment to reset suppliers:
-- DELETE FROM suppliers WHERE 1=1;

-- Uncomment to reset machines:
-- DELETE FROM machines WHERE 1=1;

-- Uncomment to reset warehouses:
-- DELETE FROM warehouses WHERE 1=1;

-- Uncomment to reset branches (WARNING: affects many tables):
-- DELETE FROM branches WHERE 1=1;

-- =====================================================
-- 12. Reset Sequences (Auto-increment counters)
-- =====================================================

-- Reset GRN sequence
ALTER SEQUENCE IF EXISTS goods_received_notes_id_seq RESTART WITH 1;

-- Reset Production Order sequence
ALTER SEQUENCE IF EXISTS production_orders_id_seq RESTART WITH 1;

-- Reset Dispatch Order sequence
ALTER SEQUENCE IF EXISTS dispatch_orders_id_seq RESTART WITH 1;

-- Reset Production Plan sequence
ALTER SEQUENCE IF EXISTS production_plans_id_seq RESTART WITH 1;

-- Reset Chick PO sequence
ALTER SEQUENCE IF EXISTS chick_purchase_orders_id_seq RESTART WITH 1;

-- Reset Chick Consignment sequence
ALTER SEQUENCE IF EXISTS chick_supplier_consignments_id_seq RESTART WITH 1;

-- =====================================================
-- Re-enable triggers
-- =====================================================
SET session_replication_role = 'origin';

-- =====================================================
-- Verification Queries (Run these to confirm reset)
-- =====================================================

-- Check counts (should all be 0)
SELECT 
  'Production Orders' as table_name, COUNT(*) as count FROM production_orders
UNION ALL
SELECT 'GRNs', COUNT(*) FROM goods_received_notes
UNION ALL
SELECT 'Dispatch Orders', COUNT(*) FROM dispatch_orders
UNION ALL
SELECT 'Chick POs', COUNT(*) FROM chick_purchase_orders
UNION ALL
SELECT 'Chick Consignments', COUNT(*) FROM chick_supplier_consignments
UNION ALL
SELECT 'Stock Movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'Quality Inspections', COUNT(*) FROM quality_inspections
UNION ALL
SELECT 'Stock Takes', COUNT(*) FROM stock_takes
UNION ALL
SELECT 'Raw Material Lots', COUNT(*) FROM raw_material_lots
ORDER BY table_name;

-- Check all raw material stocks are ZERO
SELECT 
  code,
  name,
  current_stock,
  unit
FROM raw_materials
WHERE current_stock != 0
ORDER BY code;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. This script preserves:
--    - User profiles and authentication
--    - Master data (suppliers, branches, warehouses, machines)
--    - Formulations (unless uncommented)
--    - Raw materials (unless uncommented)
--
-- 2. This script clears:
--    - All production orders and related data
--    - All GRNs and quality inspections
--    - All dispatch orders
--    - All chick management transactions
--    - All stock movements
--    - All reconciliation records
--    - All stock takes
--    - ALL raw material lots (resets stock to ZERO)
--    - ALL raw material current_stock (set to ZERO)
--
-- 3. To run this script:
--    - Go to Supabase Dashboard → SQL Editor
--    - Copy and paste this entire script
--    - Click "Run"
--    - Verify counts at the end
--
-- 4. BACKUP FIRST:
--    - Always backup your database before running reset scripts
--    - This action cannot be undone
-- =====================================================
