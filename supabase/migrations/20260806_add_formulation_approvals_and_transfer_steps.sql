-- Migration: Add formulation finance approval, daily active selection, and transfer steps
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS approval_notes TEXT DEFAULT '';
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS is_daily_active BOOLEAN DEFAULT false;
ALTER TABLE formulations ADD COLUMN IF NOT EXISTS variation_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_formulations_code_daily_active ON formulations(code, is_daily_active);
CREATE INDEX IF NOT EXISTS idx_formulations_is_approved ON formulations(is_approved);

-- Function to set a specific formulation as Finance-Approved Active Today
CREATE OR REPLACE FUNCTION set_daily_active_formulation(
  p_formulation_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM formulations WHERE id = p_formulation_id;

  IF v_code IS NOT NULL THEN
    -- Clear is_daily_active for all formulations sharing the same code
    UPDATE formulations
    SET is_daily_active = false
    WHERE code = v_code;
  END IF;

  -- Mark target formulation as active today & finance approved
  UPDATE formulations
  SET is_daily_active = true,
      is_approved = true,
      approved_by = p_approved_by,
      approved_at = NOW(),
      approval_notes = COALESCE(p_notes, approval_notes),
      status = 'active',
      updated_at = NOW()
  WHERE id = p_formulation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
