-- =====================================================
-- RAW MATERIALS RESET SCRIPT (Limited Scope)
-- =====================================================
-- This script ONLY clears raw materials related data:
-- - GRNs (Goods Received Notes)
-- - RM Warehouse stocks (sets to ZERO)
-- - Stock Takes
-- - Weigh Bridge Tickets
-- =====================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- =====================================================
-- 1. GOODS RECEIVED NOTES (GRN)
-- =====================================================

-- Quality inspections (must delete first due to foreign keys)
DELETE FROM quality_inspections WHERE 1=1;

-- GRN items
DELETE FROM grn_items WHERE 1=1;

-- Goods received notes
DELETE FROM goods_received_notes WHERE 1=1;

-- =====================================================
-- 2. RM WAREHOUSE - Reset ALL stocks to ZERO
-- =====================================================

-- Clear raw material lots (this drives current_stock)
DELETE FROM raw_material_lots WHERE 1=1;

-- Reset current_stock to ZERO for all raw materials
UPDATE raw_materials SET current_stock = 0 WHERE 1=1;

-- Clear stock movements related to raw materials
DELETE FROM stock_movements WHERE 1=1;

-- =====================================================
-- 3. STOCK TAKE - Clear all stock take records
-- =====================================================

-- Stock take audit log (must delete first)
DELETE FROM stock_take_audit_log WHERE 1=1;

-- Stock take lines
DELETE FROM stock_take_lines WHERE 1=1;

-- Stock takes
DELETE FROM stock_takes WHERE 1=1;

-- =====================================================
-- 4. WEIGH BRIDGE TICKETS - Clear all records
-- =====================================================

-- Weigh bridge tickets (if table exists)
DELETE FROM weigh_bridge_tickets WHERE 1=1;

-- =====================================================
-- 5. Reset Sequences
-- =====================================================

-- Reset GRN sequence
ALTER SEQUENCE IF EXISTS goods_received_notes_id_seq RESTART WITH 1;

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
  'GRNs' as table_name, COUNT(*) as count FROM goods_received_notes
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
UNION ALL
SELECT 'Weigh Bridge Tickets', COUNT(*) FROM weigh_bridge_tickets
ORDER BY table_name;

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
--    - All GRNs and quality inspections
--    - All raw material lots
--    - All raw material stocks (set to ZERO)
--    - All stock movements
--    - All stock takes
--    - All weigh bridge tickets
--
-- ✅ PRESERVED:
--    - Raw material definitions (name, code, unit, etc.)
--    - Suppliers
--    - Warehouses
--    - Branches
--    - Formulations
--    - Production orders
--    - Dispatch orders
--    - Chick management data
--    - All other modules
-- =====================================================
