-- Quick verification script for production order creation issues
-- Run this in Supabase SQL Editor to diagnose the problem

-- 1. Check if machine_id is NOT NULL in production_orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'production_orders' 
AND column_name = 'machine_id';

-- 2. Check if workflow trigger exists
SELECT tgname, tgrelid::regclass as table_name, tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname = 'check_production_workflow';

-- 3. Check if auto-load BOM trigger exists
SELECT tgname, tgrelid::regclass as table_name, tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname = 'on_production_order_created';

-- 4. Check RLS policies for production_orders
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'production_orders';

-- 5. Test if service_role has access to production_orders
SELECT has_table_privilege('service_role', 'production_orders', 'INSERT') as can_insert,
       has_table_privilege('service_role', 'production_orders', 'SELECT') as can_select,
       has_table_privilege('service_role', 'production_orders', 'UPDATE') as can_update;

-- 6. Check if formulations have BOM ingredients
SELECT f.code, f.name, COUNT(fi.id) as ingredient_count
FROM formulations f
LEFT JOIN formulation_ingredients fi ON f.id = fi.formulation_id AND fi.is_active = true
WHERE f.code IN ('BSG50', 'BSC50', 'BGM50')
GROUP BY f.code, f.name;

-- 7. Check if machines table has data
SELECT COUNT(*) as machine_count FROM machines;

-- 8. Check current production_orders table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'production_orders'
ORDER BY ordinal_position;
