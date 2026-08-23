-- Finished goods are manufactured into Sage Production (PD). Production clerks
-- explicitly transfer them to Sage Dispatch (DEB); completing a batch never does
-- that transfer automatically.

CREATE TABLE IF NOT EXISTS public.finished_goods_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id),
  formulation_id uuid NOT NULL REFERENCES public.formulations(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  initiated_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  sage_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finished_goods_transfers_order ON public.finished_goods_transfers(production_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finished_goods_transfers_status ON public.finished_goods_transfers(status, created_at);

ALTER TABLE public.finished_goods_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage finished goods transfers" ON public.finished_goods_transfers;
CREATE POLICY "Authenticated users can manage finished goods transfers"
  ON public.finished_goods_transfers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Add the dedicated SDK transfer event without assuming the prior constraint name.
DO $migration$
DECLARE v_constraint_name text;
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
    'grn_confirmed', 'materials_issued', 'production_completed',
    'dispatch_delivered', 'price_sync', 'customer_sync', 'error',
    'material_variance_alert', 'macropack_manufactured',
    'reconciliation_variance_approved', 'rm_cost_updated',
    'reconciliation_completed', 'material_transfer_to_production',
    'finished_goods_transfer_to_dispatch'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION public.queue_finished_goods_transfer_to_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  INSERT INTO public.sync_log (event_type, reference_id, reference_type, status, message, details)
  VALUES (
    'finished_goods_transfer_to_dispatch', NEW.id, 'finished_goods_transfers', 'pending',
    'Finished-goods transfer queued for Sage SDK Production to DEB posting',
    jsonb_build_object('transfer_number', NEW.transfer_number, 'production_order_id', NEW.production_order_id, 'formulation_id', NEW.formulation_id, 'quantity', NEW.quantity, 'transfer_date', NEW.transfer_date)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_finished_goods_transfer_queued ON public.finished_goods_transfers;
CREATE TRIGGER on_finished_goods_transfer_queued
  AFTER INSERT ON public.finished_goods_transfers
  FOR EACH ROW EXECUTE FUNCTION public.queue_finished_goods_transfer_to_dispatch();
