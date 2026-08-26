-- MES GRN references now follow the Sage GRV number stream.
-- Sage UAT last confirmed GRV: HFGRV003717, so the next MES reservation is 003718.
INSERT INTO public.batch_sequences (prefix, year, next_sequence)
VALUES ('SAGE_GRV', 0, 3718)
ON CONFLICT (prefix, year) DO UPDATE
SET next_sequence = GREATEST(public.batch_sequences.next_sequence, EXCLUDED.next_sequence),
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.reserve_next_sage_grv_sequence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sequence integer;
BEGIN
  UPDATE public.batch_sequences
  SET next_sequence = next_sequence + 1,
      updated_at = NOW()
  WHERE prefix = 'SAGE_GRV'
    AND year = 0
  RETURNING next_sequence - 1 INTO v_sequence;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'Sage GRV sequence has not been initialized.';
  END IF;

  RETURN v_sequence;
END;
$$;

-- Sage remains the authority for the actual GRV document number. After every
-- successful post, move MES forward if Sage assigned a higher number.
CREATE OR REPLACE FUNCTION public.advance_sage_grv_sequence(p_grv_number text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match text[];
  v_sage_sequence integer;
  v_next_sequence integer;
BEGIN
  v_match := regexp_match(COALESCE(p_grv_number, ''), '([0-9]+)$');

  IF v_match IS NULL THEN
    RAISE EXCEPTION 'Cannot read a numeric sequence from Sage GRV number: %', p_grv_number;
  END IF;

  v_sage_sequence := v_match[1]::integer;

  UPDATE public.batch_sequences
  SET next_sequence = GREATEST(next_sequence, v_sage_sequence + 1),
      updated_at = NOW()
  WHERE prefix = 'SAGE_GRV'
    AND year = 0
  RETURNING next_sequence INTO v_next_sequence;

  IF v_next_sequence IS NULL THEN
    RAISE EXCEPTION 'Sage GRV sequence has not been initialized.';
  END IF;

  RETURN v_next_sequence;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_next_sage_grv_sequence() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.advance_sage_grv_sequence(text) TO authenticated, service_role;
