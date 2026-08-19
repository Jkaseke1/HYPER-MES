-- Production materials must scale from each formula's approved batch size.
-- A 1,000 kg BOM is not a 50 kg recipe; hard-coding 50 caused incorrect
-- material quantities and made some formulas appear as 5,000 kg batches.

CREATE OR REPLACE FUNCTION public.auto_load_bom_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.formulation_id IS NOT NULL THEN
    INSERT INTO public.production_order_materials (
      production_order_id,
      raw_material_id,
      planned_qty,
      actual_qty,
      issued,
      issued_at,
      created_at
    )
    SELECT
      NEW.id,
      fi.raw_material_id,
      ROUND((fi.quantity * NEW.planned_qty / NULLIF(f.batch_size, 0))::numeric, 4),
      NULL,
      false,
      NULL,
      now()
    FROM public.formulation_ingredients fi
    JOIN public.formulations f ON f.id = fi.formulation_id
    WHERE fi.formulation_id = NEW.formulation_id
      AND fi.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_production_order_created ON public.production_orders;

CREATE TRIGGER on_production_order_created
  AFTER INSERT ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_load_bom_ingredients();
