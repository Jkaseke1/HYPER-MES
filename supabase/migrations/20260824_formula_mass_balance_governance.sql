-- Finance control: work orders may only use an approved, mass-balanced formula.
-- Formula ingredients are recorded in the same operational unit as batch_size (kg).

CREATE OR REPLACE FUNCTION public.validate_formula_for_production_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_size numeric;
  v_status text;
  v_ingredient_total numeric;
BEGIN
  IF NEW.formulation_id IS NULL THEN
    RAISE EXCEPTION 'A formulation is required before creating a production order.';
  END IF;

  SELECT batch_size, status
    INTO v_batch_size, v_status
    FROM public.formulations
   WHERE id = NEW.formulation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected formulation no longer exists.';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'The selected formulation must be approved and active before it can be used on a production order.';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
    INTO v_ingredient_total
    FROM public.formulation_ingredients
   WHERE formulation_id = NEW.formulation_id
     AND is_active = true;

  IF v_ingredient_total <= 0 THEN
    RAISE EXCEPTION 'The selected formulation has no active BOM ingredients.';
  END IF;
  IF ABS(v_ingredient_total - v_batch_size) > 0.01 THEN
    RAISE EXCEPTION 'Formula mass balance is invalid: BOM ingredients total % kg but the standard batch is % kg.', v_ingredient_total, v_batch_size;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_production_order_formula_validation ON public.production_orders;
CREATE TRIGGER before_production_order_formula_validation
  BEFORE INSERT OR UPDATE OF formulation_id ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_formula_for_production_order();

-- BSG50's Finance-approved reference formula is 1,000 kg. The imported
-- ingredients were entered per 50 kg bag, so convert them to the 1,000 kg
-- standard formula. Work orders remain flexible and scale from this reference.
UPDATE public.formulation_ingredients fi
   SET quantity = ROUND((fi.quantity * 20)::numeric, 4),
       percentage = ROUND((fi.percentage)::numeric, 4)
  FROM public.formulations f
 WHERE fi.formulation_id = f.id
   AND f.code = 'BSG50'
   AND f.sage_code = 'BSG50'
   AND f.batch_size = 5000
   AND f.version = 1;

UPDATE public.formulations
   SET batch_size = 1000,
       version = version + 1,
       status = 'draft',
       updated_at = now()
 WHERE code = 'BSG50'
   AND sage_code = 'BSG50'
   AND batch_size = 5000
   AND version = 1;
