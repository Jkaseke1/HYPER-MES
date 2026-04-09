-- Test the log_approval_action function
-- Run this to verify the function works correctly

-- First, check if the function exists and its signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.prokind
FROM pg_proc p
WHERE p.proname = 'log_approval_action'
ORDER BY p.oid;

-- Test calling the function with sample data
-- Replace the UUIDs with actual values from your database
SELECT log_approval_action(
  'material_transfer'::text,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'approved'::text,
  'pending'::text,
  'approved'::text,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  NULL::text
);

-- Check if the record was inserted
SELECT * FROM approval_history 
WHERE entity_type = 'material_transfer' 
ORDER BY created_at DESC 
LIMIT 1;
