-- Clean up log_approval_action RPC function
-- Note: Approvals work without this RPC since we have error handling in place
-- This migration just ensures the function doesn't cause issues

-- Drop all versions of the function with explicit signatures
DROP FUNCTION IF EXISTS log_approval_action(text, uuid, text, text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS log_approval_action(text, uuid, text, text, text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS log_approval_action(text, uuid, text, text, text, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS log_approval_action(text, uuid, text, text, text, uuid, text, text, text) CASCADE;
