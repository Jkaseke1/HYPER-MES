-- Snapshot the approved formulation BOM onto each production order.
-- Formulation quantities are stored against the standard batch size; the
-- production order receives a scaled, immutable material requirement list.

CREATE OR REPLACE FUNCTION public.populate_production_order_bom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_size numeric;
  v_ingredient_count integer;
BEGIN
  IF NEW.formulation_id IS NULL OR COALESCE(NEW.planned_qty, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT batch_size
  INTO v_batch_size
  FROM public.formulations
  WHERE id = NEW.formulation_id;

  IF COALESCE(v_batch_size, 0) <= 0 THEN
    RAISE EXCEPTION 'Formulation % has an invalid reference batch size.', NEW.formulation_id;
  END IF;

  SELECT COUNT(*)
  INTO v_ingredient_count
  FROM public.formulation_ingredients
  WHERE formulation_id = NEW.formulation_id
    AND COALESCE(quantity, 0) > 0
    AND raw_material_id IS NOT NULL;

  IF v_ingredient_count = 0 THEN
    RAISE EXCEPTION 'Formulation % has no usable BOM ingredients.', NEW.formulation_id;
  END IF;

  INSERT INTO public.production_order_materials (
    production_order_id,
    raw_material_id,
    planned_qty,
    actual_qty,
    wastage_qty,
    unit,
    unit_cost,
    total_cost,
    issued
  )
  SELECT
    NEW.id,
    fi.raw_material_id,
    ROUND((fi.quantity * NEW.planned_qty / v_batch_size)::numeric, 3),
    0,
    0,
    COALESCE(NULLIF(fi.unit, ''), 'kg'),
    COALESCE(rm.cost_per_unit, 0),
    ROUND((fi.quantity * NEW.planned_qty / v_batch_size * COALESCE(rm.cost_per_unit, 0))::numeric, 2),
    false
  FROM public.formulation_ingredients fi
  LEFT JOIN public.raw_materials rm ON rm.id = fi.raw_material_id
  WHERE fi.formulation_id = NEW.formulation_id
    AND COALESCE(fi.quantity, 0) > 0
    AND fi.raw_material_id IS NOT NULL
  ORDER BY fi.sort_order, fi.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_production_order_bom ON public.production_orders;
CREATE TRIGGER trg_populate_production_order_bom
AFTER INSERT ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.populate_production_order_bom();

REVOKE ALL ON FUNCTION public.populate_production_order_bom() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_production_order_bom() TO authenticated, service_role;
