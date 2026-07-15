-- =====================================================
-- RAW MATERIALS + PRODUCTION RESET SCRIPT
-- =====================================================
-- This script clears:
-- - GRNs (Goods Received Notes)
-- - RM Warehouse stocks (sets to ZERO)
-- - Stock Takes
-- - Weigh Bridge Tickets
-- - PRODUCTION ORDERS (all statuses)
-- - Production Plans
-- - Dispatch Orders
-- - Material Transfers
-- - Chick Management (POs, Consignments, Deliveries, Invoices)
-- =====================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- =====================================================
-- 1. PRODUCTION MODULE - Clear all production data
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
-- 2. DISPATCH MODULE - Clear all dispatch data
-- =====================================================

-- Dispatch items
DELETE FROM dispatch_items WHERE 1=1;

-- Dispatch orders
DELETE FROM dispatch_orders WHERE 1=1;

-- =====================================================
-- 3. MATERIAL TRANSFERS - Clear all transfers
-- =====================================================

-- Material transfers
DELETE FROM material_transfers WHERE 1=1;

-- =====================================================
-- 4. CHICK MANAGEMENT - Clear all transactional data
-- =====================================================

-- Chick reconciliation (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_reconciliation') THEN
    DELETE FROM chick_reconciliation WHERE 1=1;
  END IF;
END $$;

-- Chick invoices
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_invoices') THEN
    DELETE FROM chick_invoices WHERE 1=1;
  END IF;
END $$;

-- Chick delivery notes
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_delivery_notes') THEN
    DELETE FROM chick_delivery_notes WHERE 1=1;
  END IF;
END $$;

-- Chick supplier consignments
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_supplier_consignments') THEN
    DELETE FROM chick_supplier_consignments WHERE 1=1;
  END IF;
END $$;

-- Chick purchase orders
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_purchase_orders') THEN
    DELETE FROM chick_purchase_orders WHERE 1=1;
  END IF;
END $$;

-- =====================================================
-- 5. GOODS RECEIVED NOTES (GRN)
-- =====================================================

-- Quality inspections (must delete first due to foreign keys)
DELETE FROM quality_inspections WHERE 1=1;

-- GRN items
DELETE FROM grn_items WHERE 1=1;

-- Goods received notes
DELETE FROM goods_received_notes WHERE 1=1;

-- =====================================================
-- 6. RM WAREHOUSE - Reset ALL stocks to ZERO
-- =====================================================

-- Clear raw material lots (this drives current_stock)
DELETE FROM raw_material_lots WHERE 1=1;

-- Reset current_stock to ZERO for all raw materials
UPDATE raw_materials SET current_stock = 0 WHERE 1=1;

-- Clear stock movements
DELETE FROM stock_movements WHERE 1=1;

-- =====================================================
-- 7. STOCK TAKE - Clear all stock take records
-- =====================================================

-- Stock take audit log (must delete first)
DELETE FROM stock_take_audit_log WHERE 1=1;

-- Stock take lines
DELETE FROM stock_take_lines WHERE 1=1;

-- Stock takes
DELETE FROM stock_takes WHERE 1=1;

-- =====================================================
-- 8. WEIGH BRIDGE TICKETS - Clear all records
-- =====================================================

-- Weigh bridge tickets (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weigh_bridge_tickets') THEN
    DELETE FROM weigh_bridge_tickets WHERE 1=1;
  END IF;
END $$;

-- =====================================================
-- 9. MACROPACK MODULE - Clear transactional data (if tables exist)
-- =====================================================

-- Macropack dispensing records (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'macropack_dispensing') THEN
    DELETE FROM macropack_dispensing WHERE 1=1;
  END IF;
END $$;

-- Macropack orders (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'macropack_orders') THEN
    DELETE FROM macropack_orders WHERE 1=1;
  END IF;
END $$;

-- =====================================================
-- 10. Reset Sequences
-- =====================================================

-- Reset GRN sequence
ALTER SEQUENCE IF EXISTS goods_received_notes_id_seq RESTART WITH 1;

-- Reset Production Order sequence
ALTER SEQUENCE IF EXISTS production_orders_id_seq RESTART WITH 1;

-- Reset Production Plan sequence
ALTER SEQUENCE IF EXISTS production_plans_id_seq RESTART WITH 1;

-- Reset Dispatch Order sequence
ALTER SEQUENCE IF EXISTS dispatch_orders_id_seq RESTART WITH 1;

-- Reset Stock Take sequence
ALTER SEQUENCE IF EXISTS stock_takes_id_seq RESTART WITH 1;

-- Reset Weigh Bridge sequence
ALTER SEQUENCE IF EXISTS weigh_bridge_tickets_id_seq RESTART WITH 1;

-- =====================================================
-- Re-enable triggers
-- =====================================================
SET session_replication_role = 'origin';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check counts (should all be 0)
SELECT 
  'Production Orders' as table_name, COUNT(*) as count FROM production_orders
UNION ALL
SELECT 'Production Plans', COUNT(*) FROM production_plans
UNION ALL
SELECT 'Dispatch Orders', COUNT(*) FROM dispatch_orders
UNION ALL
SELECT 'Material Transfers', COUNT(*) FROM material_transfers
UNION ALL
SELECT 'GRNs', COUNT(*) FROM goods_received_notes
UNION ALL
SELECT 'GRN Items', COUNT(*) FROM grn_items
UNION ALL
SELECT 'Quality Inspections', COUNT(*) FROM quality_inspections
UNION ALL
SELECT 'Stock Movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'Stock Takes', COUNT(*) FROM stock_takes
UNION ALL
SELECT 'Stock Take Lines', COUNT(*) FROM stock_take_lines
UNION ALL
SELECT 'Raw Material Lots', COUNT(*) FROM raw_material_lots
ORDER BY table_name;

-- Check chick management counts (if tables exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_purchase_orders') THEN
    RAISE NOTICE 'Chick Purchase Orders: %', (SELECT COUNT(*) FROM chick_purchase_orders);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_supplier_consignments') THEN
    RAISE NOTICE 'Chick Consignments: %', (SELECT COUNT(*) FROM chick_supplier_consignments);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chick_delivery_notes') THEN
    RAISE NOTICE 'Chick Delivery Notes: %', (SELECT COUNT(*) FROM chick_delivery_notes);
  END IF;
END $$;

-- Note: Weigh Bridge Tickets and Macropack tables excluded from count if they don't exist

-- Check all raw material stocks are ZERO (should return NO rows)
SELECT 
  code,
  name,
  current_stock,
  unit
FROM raw_materials
WHERE current_stock != 0
ORDER BY code;

-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ CLEARED:
--    - ALL Production Orders (all statuses)
--    - ALL Production Plans
--    - ALL Dispatch Orders
--    - ALL Material Transfers
--    - ALL Chick Purchase Orders
--    - ALL Chick Consignments
--    - ALL Chick Delivery Notes
--    - ALL Chick Invoices
--    - All GRNs and quality inspections
--    - All raw material lots
--    - All raw material stocks (set to ZERO)
--    - All stock movements
--    - All stock takes
--    - All weigh bridge tickets
--    - All macropack orders
--
-- ✅ PRESERVED:
--    - Raw material definitions (name, code, unit, etc.)
--    - Suppliers
--    - Warehouses
--    - Branches
--    - Machines
--    - Formulations (BOMs)
--    - Chick management data
--    - User profiles
-- =====================================================
