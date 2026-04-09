-- Create log_approval_action RPC function for approval audit trail
-- This function logs all approval actions to the approval_history table

DROP FUNCTION IF EXISTS log_approval_action(text, uuid, text, text, text, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION log_approval_action(
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
GRANT EXECUTE ON FUNCTION log_approval_action TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION log_approval_action IS 'Logs approval actions to the approval_history table for audit trail';
