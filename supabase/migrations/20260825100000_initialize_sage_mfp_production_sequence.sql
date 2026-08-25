-- Production order numbers continue Sage's existing manufacturing-process sequence.
-- MFP010379 is the last legacy Sage process reference, so MES starts at MFP010380.
INSERT INTO batch_sequences (prefix, year, next_sequence)
VALUES ('MFP', 0, 10380)
ON CONFLICT (prefix, year) DO UPDATE
SET next_sequence = GREATEST(batch_sequences.next_sequence, EXCLUDED.next_sequence),
    updated_at = NOW();

CREATE OR REPLACE FUNCTION reserve_next_mfp_sequence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sequence integer;
BEGIN
  UPDATE batch_sequences
  SET next_sequence = next_sequence + 1,
      updated_at = NOW()
  WHERE prefix = 'MFP' AND year = 0
  RETURNING next_sequence - 1 INTO v_sequence;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'Sage MFP sequence has not been initialized.';
  END IF;

  RETURN v_sequence;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_next_mfp_sequence() TO authenticated;
