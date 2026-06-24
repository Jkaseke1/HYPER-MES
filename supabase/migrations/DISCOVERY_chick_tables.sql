-- DISCOVERY QUERIES FOR CHICK MANAGEMENT
-- Run these in Supabase SQL Editor to see what already exists

-- 1. List all existing chick tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%chick%'
ORDER BY table_name;

-- 2. Show columns for any chick tables found
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name ILIKE '%chick%'
ORDER BY table_name, ordinal_position;

-- 3. Show existing chick data (if tables exist)
-- Uncomment these one by one after checking table existence:

-- SELECT * FROM chick_suppliers LIMIT 50;
-- SELECT * FROM chick_purchase_orders LIMIT 50;
-- SELECT * FROM chick_bookings LIMIT 50;
-- SELECT * FROM chick_deliveries LIMIT 50;
-- SELECT * FROM chick_distribution LIMIT 50;

-- 4. Check branches master if it exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('branches', 'branch_master', 'chick_branches')
ORDER BY table_name;

-- 5. If branches table exists, show its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'branches'
ORDER BY ordinal_position;

-- 6. Show branch data if exists
-- SELECT * FROM branches LIMIT 100;

-- 7. Check for any existing chick-related views
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name ILIKE '%chick%';

-- 8. Check for existing chick-related indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename ILIKE '%chick%'
ORDER BY tablename, indexname;

-- 9. Check for existing RLS policies on chick tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename ILIKE '%chick%'
ORDER BY tablename, policyname;
