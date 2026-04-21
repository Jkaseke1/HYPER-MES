-- Expand sync_log CHECK constraints so every event type MES emits and every
-- status the bridge worker uses is accepted. Purely additive — all previously
-- allowed values remain valid. No data is modified.
--
-- Reasons:
-- 1. Trigger log_material_variances() inserts event_type = 'material_variance_alert'
--    which is not in the original CHECK list, causing PO completion UPDATEs to
--    fail with a constraint violation for variance batches.
-- 2. Bridge worker sets status = 'processing' while handling an event; original
--    CHECK only allowed pending/success/failed/retry, so the intermediate update
--    was silently erroring out.
-- 3. Bridge handlers exist for macropack, reconciliation variance and RM cost
--    update events — whitelisting those event_types here unblocks those flows
--    when their emitting triggers are added later.

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Drop existing event_type CHECK (name is auto-generated, resolve dynamically)
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sync_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Drop existing status CHECK
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sync_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- Recreate with expanded, forward-compatible lists
ALTER TABLE public.sync_log
  ADD CONSTRAINT sync_log_event_type_check
  CHECK (event_type IN (
    -- Originally allowed
    'grn_confirmed',
    'materials_issued',
    'production_completed',
    'dispatch_delivered',
    'price_sync',
    'customer_sync',
    'error',
    -- Emitted by MES triggers but previously rejected
    'material_variance_alert',
    -- Handled by bridge worker, reserved for future MES triggers
    'macropack_manufactured',
    'reconciliation_variance_approved',
    'rm_cost_updated',
    'reconciliation_completed'
  ));

ALTER TABLE public.sync_log
  ADD CONSTRAINT sync_log_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'success',
    'failed',
    'retry'
  ));

COMMENT ON CONSTRAINT sync_log_event_type_check ON public.sync_log
  IS 'Expanded 2026-04-21: added material_variance_alert, macropack_manufactured, reconciliation_variance_approved, rm_cost_updated, reconciliation_completed.';

COMMENT ON CONSTRAINT sync_log_status_check ON public.sync_log
  IS 'Expanded 2026-04-21: added ''processing'' (used by bridge worker during handler execution).';
