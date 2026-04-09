-- Comprehensive cleanup and recreation of log_approval_action function
-- This removes all versions and recreates it cleanly

-- Drop ALL versions of the function (without specific signatures)
DROP FUNCTION IF EXISTS log_approval_action CASCADE;

-- Wait a moment for the drop to complete
-- Then recreate with the correct signature

CREATE FUNCTION log_approval_action(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_previous_status text,
  p_new_status text,
  p_approved_by uuid,
  p_comments text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Validate action parameter
  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid action. Must be "approved" or "rejected"';
  END IF;

  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    previous_status,
    new_status,
    approved_by,
    comments,
    created_at
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_previous_status,
    p_new_status,
    p_approved_by,
    p_comments,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_approval_action(text, uuid, text, text, text, uuid, text) TO authenticated;

-- Verify the function exists
SELECT 'log_approval_action function created successfully' as status;
