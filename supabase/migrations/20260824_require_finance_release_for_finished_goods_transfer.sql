-- Finished goods stay in PD until Production records the physical handover and
-- Finance explicitly releases that handover for the Sage PD-to-DEB transfer.

ALTER TABLE public.finished_goods_transfers
  DROP CONSTRAINT IF EXISTS finished_goods_transfers_status_check;

ALTER TABLE public.finished_goods_transfers
  ADD CONSTRAINT finished_goods_transfers_status_check
  CHECK (status IN ('pending_finance', 'pending', 'posted', 'failed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.queue_finished_goods_transfer_to_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status <> 'pending' OR (TG_OP = 'UPDATE' AND OLD.status = 'pending') THEN
    RETURN NEW;
  END IF;

  IF NEW.production_verified_at IS NULL OR NEW.finance_verified_at IS NULL THEN
    RAISE EXCEPTION 'Production and Finance verification are required before a finished-goods transfer can be queued.';
  END IF;

  INSERT INTO public.sync_log (event_type, reference_id, reference_type, status, message, details)
  VALUES (
    'finished_goods_transfer_to_dispatch', NEW.id, 'finished_goods_transfers', 'pending',
    'Finance approved finished-goods transfer queued for Sage SDK Production to DEB posting',
    jsonb_build_object('transfer_number', NEW.transfer_number, 'production_order_id', NEW.production_order_id, 'formulation_id', NEW.formulation_id, 'quantity', NEW.quantity, 'transfer_date', NEW.transfer_date, 'verified_quantity', NEW.verified_quantity, 'verified_bags', NEW.verified_bags)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_finished_goods_transfer_queued ON public.finished_goods_transfers;
CREATE TRIGGER on_finished_goods_transfer_queued
  AFTER INSERT OR UPDATE OF status ON public.finished_goods_transfers
  FOR EACH ROW EXECUTE FUNCTION public.queue_finished_goods_transfer_to_dispatch();
