-- Production cannot begin until the latest Sage MFDR material issue for the
-- batch has posted successfully. This protects the workflow even if a client
-- bypasses the MES button or has an old browser build open.

CREATE OR REPLACE FUNCTION public.enforce_sage_issue_before_production_start()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sage_status text;
  v_sage_message text;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    SELECT status, message
      INTO v_sage_status, v_sage_message
      FROM public.sync_log
     WHERE event_type = 'materials_issued'
       AND reference_type = 'production_orders'
       AND reference_id = NEW.id
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    IF COALESCE(v_sage_status, '') <> 'success' THEN
      RAISE EXCEPTION
        'Cannot start production until Sage material issue succeeds. Current Sage status: %. %',
        COALESCE(v_sage_status, 'not queued'),
        COALESCE(v_sage_message, 'Issue materials in MES and wait for Sage posting.');
    END IF;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT status, message
      INTO v_sage_status, v_sage_message
      FROM public.sync_log
     WHERE event_type = 'production_completed'
       AND reference_type = 'production_orders'
       AND reference_id = NEW.id
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    IF COALESCE(v_sage_status, '') <> 'success' THEN
      RAISE EXCEPTION
        'Cannot complete production until Sage finished-goods posting succeeds. Current Sage status: %. %',
        COALESCE(v_sage_status, 'not queued'),
        COALESCE(v_sage_message, 'Queue the finished-goods receipt and wait for Sage posting.');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sage_issue_before_production_start ON public.production_orders;

CREATE TRIGGER trg_enforce_sage_issue_before_production_start
BEFORE UPDATE OF status ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sage_issue_before_production_start();

COMMENT ON FUNCTION public.enforce_sage_issue_before_production_start()
IS 'Blocks production start and completion until their latest required Sage sync_log events succeeded.';
