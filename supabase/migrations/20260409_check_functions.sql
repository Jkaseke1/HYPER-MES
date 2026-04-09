-- Diagnostic script to check existing functions
-- Run this to see what log_approval_action functions exist

-- List all functions named log_approval_action with their signatures
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
WHERE p.proname = 'log_approval_action'
ORDER BY p.oid;

-- Also check the approval_history table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'approval_history'
ORDER BY ordinal_position;
