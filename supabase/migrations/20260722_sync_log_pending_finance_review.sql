-- Allow bridge two-phase status after prepare (before finance posts to Sage)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sync_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.sync_log
  ADD CONSTRAINT sync_log_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'pending_finance_review',
    'success',
    'failed',
    'retry'
  )) NOT VALID;

COMMENT ON CONSTRAINT sync_log_status_check ON public.sync_log
  IS 'Includes pending_finance_review for two-phase Sage posting (prepare → finance approve → post).';
