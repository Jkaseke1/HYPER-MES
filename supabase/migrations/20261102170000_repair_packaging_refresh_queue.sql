BEGIN;
-- Preserve each installed event allowlist and add only the read-only refresh event.
DO $$
DECLARE rule record;
BEGIN
  FOR rule IN
    SELECT c.conname, pg_get_expr(c.conbin, c.conrelid) AS expression
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'event_type'
    WHERE c.conrelid = 'public.sync_log'::regclass AND c.contype = 'c'
      AND c.conkey = ARRAY[a.attnum]::smallint[]
  LOOP
    IF position('sage_stock_refresh' IN rule.expression) = 0 THEN
      EXECUTE format('ALTER TABLE public.sync_log DROP CONSTRAINT %I', rule.conname);
      EXECUTE format('ALTER TABLE public.sync_log ADD CONSTRAINT %I CHECK ((%s) OR event_type = %L) NOT VALID',
        rule.conname, rule.expression, 'sage_stock_refresh');
    END IF;
  END LOOP;
END;
$$;
ALTER TABLE public.sage_stock_balances
  ADD COLUMN IF NOT EXISTS average_unit_cost numeric CHECK (average_unit_cost >= 0),
  ADD COLUMN IF NOT EXISTS cost_synced_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_production_packaging_cost_refresh(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE codes text[]; event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to refresh packaging prices.'; END IF;
  PERFORM 1 FROM public.production_orders WHERE id = p_order_id AND status <> 'completed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an open production order.'; END IF;
  SELECT array_agg(DISTINCT upper(trim(item_code))) INTO codes
    FROM public.production_order_packaging WHERE production_order_id = p_order_id;
  IF COALESCE(array_length(codes, 1), 0) = 0 OR array_length(codes, 1) > 20 THEN
    RAISE EXCEPTION 'The order requires between 1 and 20 mapped packaging items.';
  END IF;
  SELECT id INTO event_id FROM public.sync_log
    WHERE reference_id = p_order_id AND event_type = 'sage_stock_refresh'
      AND (status IN ('pending', 'processing') OR created_at > now() - interval '60 seconds')
    ORDER BY created_at DESC LIMIT 1;
  IF event_id IS NOT NULL THEN RETURN event_id; END IF;
  INSERT INTO public.sync_log(event_type, reference_type, reference_id, status, details)
    VALUES ('sage_stock_refresh', 'production_orders', p_order_id, 'pending',
      jsonb_build_object('itemCodes', to_jsonb(codes), 'warehouseCodes', jsonb_build_array('PD'),
        'reason', 'production packaging cost refresh', 'requestedBy', auth.uid())) RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_production_packaging_cost_refresh(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_production_packaging_cost_refresh(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cache_order_packaging_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.warehouse_id = 19 AND NEW.average_unit_cost > 0 THEN
    UPDATE public.production_order_packaging pop SET unit_cost = NEW.average_unit_cost
    FROM public.production_orders po
    WHERE pop.production_order_id = po.id AND po.status IN ('pending', 'pending_finance', 'materials_issued', 'in_progress')
      AND upper(trim(pop.item_code)) = upper(trim(NEW.sage_code)) AND pop.unit_cost = 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cache_order_packaging_price ON public.sage_stock_balances;
CREATE TRIGGER cache_order_packaging_price AFTER INSERT OR UPDATE OF average_unit_cost
ON public.sage_stock_balances FOR EACH ROW EXECUTE FUNCTION public.cache_order_packaging_price();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'sage_stock_balances') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sage_stock_balances;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
