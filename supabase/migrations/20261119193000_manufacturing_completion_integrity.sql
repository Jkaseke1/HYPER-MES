-- Protect completion records at the database boundary. Existing duplicates
-- must be reconciled by their owner before these indexes can be installed.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE UNIQUE INDEX manufacturing_output_once
  ON public.production_outputs(production_order_id)
  WHERE production_order_id IS NOT NULL;

CREATE UNIQUE INDEX manufacturing_output_movement_once
  ON public.stock_movements(reference_id)
  WHERE movement_type = 'production_output'
    AND reference_type = 'production_order'
    AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX manufacturing_packaging_usage_once
  ON public.batch_packaging_used(production_order_id, packaging_sku_id);

CREATE UNIQUE INDEX manufacturing_completion_event_once
  ON public.sync_log(reference_id)
  WHERE event_type = 'production_completed'
    AND reference_type = 'production_orders'
    AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finalize_sage_manufacturing_completion(
  p_order_id uuid,
  p_event_id uuid,
  p_sage_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.production_orders%ROWTYPE;
  v_event public.sync_log%ROWTYPE;
  v_reference text;
  v_now timestamptz := clock_timestamp();
BEGIN
  v_reference := NULLIF(btrim(p_sage_result->>'processReference'), '');
  IF jsonb_typeof(p_sage_result) IS DISTINCT FROM 'object'
     OR p_sage_result->>'status' IS DISTINCT FROM 'posted'
     OR v_reference IS NULL THEN
    RAISE EXCEPTION 'A verified Sage manufacturing posting result is required.';
  END IF;

  SELECT * INTO STRICT v_order FROM public.production_orders
  WHERE id = p_order_id FOR UPDATE;

  SELECT * INTO STRICT v_event FROM public.sync_log
  WHERE id = p_event_id AND reference_id = p_order_id
    AND reference_type = 'production_orders'
    AND event_type = 'production_completed'
  FOR UPDATE;

  IF v_reference IS DISTINCT FROM v_order.batch_number
     OR (v_order.sage_mfp_reference IS NOT NULL
         AND v_order.sage_mfp_reference IS DISTINCT FROM v_reference) THEN
    RAISE EXCEPTION 'The Sage process reference does not match the production order.';
  END IF;

  IF v_event.status = 'success' AND v_order.status = 'completed'
     AND v_order.sage_mfp_reference = v_reference THEN
    RETURN to_jsonb(v_event);
  END IF;

  IF v_event.status IS DISTINCT FROM 'processing' OR v_order.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Expected the claimed completion event and an in-progress order; reconcile before retrying.';
  END IF;

  -- The order guard requires Sage success to be visible in this transaction.
  UPDATE public.sync_log
  SET status = 'success', next_retry_at = NULL,
      message = 'Sage manufacturing completion reconciled.',
      sage_response = p_sage_result, updated_at = v_now
  WHERE id = p_event_id
  RETURNING * INTO v_event;

  UPDATE public.production_orders
  SET status = 'completed', actual_end = v_now,
      sage_mfp_reference = v_reference, sage_mfp_posting_status = 'posted',
      sage_mfp_posting_message = 'Sage manufacturing completion reconciled.',
      sage_mfp_posted_at = v_now, updated_at = v_now
  WHERE id = p_order_id;
  RETURN to_jsonb(v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sage_manufacturing_completion(uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_sage_manufacturing_completion(uuid,uuid,jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
