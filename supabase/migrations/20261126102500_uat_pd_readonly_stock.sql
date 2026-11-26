BEGIN;

CREATE TABLE public.uat_pd_stock_reads (
  sage_code text PRIMARY KEY,
  available_quantity numeric NOT NULL CHECK (available_quantity >= 0 AND available_quantity::text NOT IN ('NaN', 'Infinity', '-Infinity')),
  observed_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source = 'Hyperfeeds UAT Bench 20261124 / PD 19')
);

CREATE TABLE public.uat_pd_stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id),
  item_codes text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  message text,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.uat_pd_stock_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uat_pd_stock_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uat_pd_stock_reads, public.uat_pd_stock_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.uat_pd_stock_reads, public.uat_pd_stock_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.uat_pd_stock_reads, public.uat_pd_stock_requests TO service_role;
CREATE POLICY uat_pd_stock_reads_authenticated ON public.uat_pd_stock_reads FOR SELECT TO authenticated USING (true);
CREATE POLICY uat_pd_stock_requests_authenticated ON public.uat_pd_stock_requests FOR SELECT TO authenticated USING (requested_by = auth.uid());

CREATE FUNCTION public.prevent_uat_material_issue_during_pd_read()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.issued IS TRUE AND (TG_OP = 'INSERT' OR OLD.issued IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Material issue is disabled while UAT PD availability is being verified.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER uat_pd_read_prevent_issue
  BEFORE INSERT OR UPDATE OF issued ON public.production_order_materials
  FOR EACH ROW EXECUTE FUNCTION public.prevent_uat_material_issue_during_pd_read();

CREATE FUNCTION public.request_uat_pd_stock(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE codes text[]; request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request Sage PD stock.'; END IF;
  PERFORM 1 FROM public.production_orders
    WHERE id = p_order_id AND status IN ('pending', 'pending_finance') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select a pending production order.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_order_materials WHERE production_order_id = p_order_id) THEN
    RAISE EXCEPTION 'The order has no saved ingredients.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.production_order_materials m
    LEFT JOIN public.raw_materials r ON r.id = m.raw_material_id
    WHERE m.production_order_id = p_order_id
      AND (r.id IS NULL OR coalesce(nullif(btrim(r.sage_code), ''), nullif(btrim(r.code), '')) IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.production_order_packaging
    WHERE production_order_id = p_order_id AND nullif(btrim(item_code), '') IS NULL
  ) THEN RAISE EXCEPTION 'An ingredient or packaging item has no Sage code.'; END IF;
  SELECT array_agg(DISTINCT code ORDER BY code) INTO codes FROM (
    SELECT upper(btrim(coalesce(nullif(btrim(r.sage_code), ''), r.code))) AS code
    FROM public.production_order_materials m JOIN public.raw_materials r ON r.id = m.raw_material_id
    WHERE m.production_order_id = p_order_id
    UNION ALL
    SELECT upper(btrim(item_code)) FROM public.production_order_packaging WHERE production_order_id = p_order_id
  ) requested;
  IF cardinality(codes) NOT BETWEEN 1 AND 40 OR EXISTS (
    SELECT 1 FROM unnest(codes) c WHERE c !~ '^[A-Z0-9_-]+$'
  ) THEN RAISE EXCEPTION 'The order contains invalid Sage item codes.'; END IF;
  SELECT id INTO request_id FROM public.uat_pd_stock_requests
    WHERE order_id = p_order_id AND requested_by = auth.uid() AND item_codes = codes AND status IN ('pending', 'processing')
      AND created_at > clock_timestamp() - interval '5 minutes'
    ORDER BY created_at DESC LIMIT 1;
  IF request_id IS NOT NULL THEN RETURN request_id; END IF;
  INSERT INTO public.uat_pd_stock_requests(order_id, item_codes, requested_by)
    VALUES (p_order_id, codes, auth.uid()) RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_uat_pd_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_uat_pd_stock(uuid) TO authenticated;

CREATE FUNCTION public.complete_uat_pd_stock(p_request_id uuid, p_reads jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE req public.uat_pd_stock_requests%ROWTYPE; read_item jsonb; code text; qty numeric; observed timestamptz; seen text[] := '{}';
BEGIN
  SELECT * INTO req FROM public.uat_pd_stock_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR req.status <> 'processing' THEN RAISE EXCEPTION 'Stock request is not claimed.'; END IF;
  IF jsonb_typeof(p_reads) IS DISTINCT FROM 'array' OR jsonb_array_length(p_reads) <> cardinality(req.item_codes) THEN
    RAISE EXCEPTION 'Stock response does not contain every requested item.';
  END IF;
  FOR read_item IN SELECT value FROM jsonb_array_elements(p_reads) LOOP
    code := read_item->>'code';
    qty := (read_item->>'available')::numeric;
    observed := (read_item->>'observedAt')::timestamptz;
    IF code IS NULL OR NOT code = ANY(req.item_codes) OR code = ANY(seen)
      OR qty IS NULL OR qty::text IN ('NaN', 'Infinity', '-Infinity')
      OR observed IS NULL OR observed > clock_timestamp() OR observed < clock_timestamp() - interval '2 minutes' THEN
      RAISE EXCEPTION 'Invalid or stale Sage PD response for %.', code;
    END IF;
    seen := array_append(seen, code);
    INSERT INTO public.uat_pd_stock_reads(sage_code, available_quantity, observed_at, source)
      VALUES (code, greatest(0, qty), observed, 'Hyperfeeds UAT Bench 20261124 / PD 19')
    ON CONFLICT (sage_code) DO UPDATE SET available_quantity = excluded.available_quantity,
      observed_at = excluded.observed_at, source = excluded.source
      WHERE public.uat_pd_stock_reads.observed_at < excluded.observed_at;
  END LOOP;
  UPDATE public.uat_pd_stock_requests SET status = 'success', message = NULL, updated_at = clock_timestamp()
    WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_uat_pd_stock(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_uat_pd_stock(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
