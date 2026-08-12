-- Material-transfer → Sage bridge
-- MES still manages its Buffer workflow internally. When Production accepts a
-- transfer, emit one idempotent Sage event that moves the material from the
-- Sage Raw Materials warehouse (18) to Sage Production (19) for finance review.

DO $migration$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sync_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END
$migration$;

ALTER TABLE public.sync_log
  ADD CONSTRAINT sync_log_event_type_check
  CHECK (event_type IN (
    'grn_confirmed',
    'materials_issued',
    'production_completed',
    'dispatch_delivered',
    'price_sync',
    'customer_sync',
    'error',
    'material_variance_alert',
    'macropack_manufactured',
    'reconciliation_variance_approved',
    'rm_cost_updated',
    'reconciliation_completed',
    'material_transfer_to_production'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION public.queue_sage_material_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status <> 'received' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sync_log
    WHERE event_type = 'material_transfer_to_production'
      AND reference_type = 'material_transfers'
      AND reference_id = NEW.id
      AND status IN ('pending', 'processing', 'pending_finance_review', 'success')
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sync_log (
    event_type, reference_id, reference_type, status, message, details
  ) VALUES (
    'material_transfer_to_production',
    NEW.id,
    'material_transfers',
    'pending',
    'Material transfer accepted to Production - ready for Sage RM to Production posting',
    jsonb_build_object(
      'transfer_number', NEW.transfer_number,
      'raw_material_id', NEW.raw_material_id,
      'quantity', NEW.quantity,
      'production_order_id', NEW.production_order_id,
      'transfer_date', NEW.transfer_date
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_material_transfer_received_sage ON public.material_transfers;
CREATE TRIGGER on_material_transfer_received_sage
  AFTER UPDATE OF status ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_sage_material_transfer();

COMMENT ON FUNCTION public.queue_sage_material_transfer()
  IS 'Queues the approved Sage RM (18) to Production (19) transfer only after MES Production accepts the transfer.';
