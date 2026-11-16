BEGIN;
-- Use the same unit-cost master as ingredient issues. No historical backfill.
CREATE OR REPLACE FUNCTION public.load_order_packaging_unit_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  price numeric;
  matches integer;
BEGIN
  IF COALESCE(NEW.unit_cost, 0) > 0 THEN RETURN NEW; END IF;
  SELECT count(*), max(cost_per_unit) INTO matches, price
  FROM public.raw_materials
  WHERE is_active = true AND upper(trim(COALESCE(NULLIF(sage_code, ''), code))) = upper(trim(NEW.item_code));
  IF matches = 1 AND price > 0 THEN NEW.unit_cost := price; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS load_order_packaging_unit_cost ON public.production_order_packaging;
CREATE TRIGGER load_order_packaging_unit_cost BEFORE INSERT OR UPDATE OF actual_qty
ON public.production_order_packaging FOR EACH ROW EXECUTE FUNCTION public.load_order_packaging_unit_cost();

-- Reconciled issue values supersede estimates, including on a recovered issue.
CREATE OR REPLACE FUNCTION public.capture_sage_packaging_issue_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  component jsonb;
BEGIN
  IF NEW.event_type <> 'materials_issued' OR NEW.status <> 'success'
    OR jsonb_typeof(NEW.details->'postedComponents') IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_orders WHERE id = NEW.reference_id
    AND status IN ('pending', 'pending_finance', 'materials_issued', 'in_progress')) THEN RETURN NEW; END IF;
  FOR component IN SELECT * FROM jsonb_array_elements(NEW.details->'postedComponents') LOOP
    IF (component->>'unitCost')::numeric > 0 THEN
      UPDATE public.production_order_packaging SET unit_cost = (component->>'unitCost')::numeric
      WHERE production_order_id = NEW.reference_id
        AND upper(trim(item_code)) = upper(trim(component->>'sageCode'))
        AND planned_qty = (component->>'quantity')::numeric;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS capture_sage_packaging_issue_cost ON public.sync_log;
CREATE TRIGGER capture_sage_packaging_issue_cost AFTER INSERT OR UPDATE OF details, status
ON public.sync_log FOR EACH ROW EXECUTE FUNCTION public.capture_sage_packaging_issue_cost();
COMMIT;
