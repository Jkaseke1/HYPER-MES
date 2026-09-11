-- Keep one product/formula family under the same code while preserving
-- every approved BOM as an immutable version.

ALTER TABLE public.formulations DROP CONSTRAINT IF EXISTS formulations_code_key;
ALTER TABLE public.formulations DROP CONSTRAINT IF EXISTS formulations_sage_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS formulations_code_version_key
  ON public.formulations (code, version);

CREATE OR REPLACE FUNCTION public.create_formulation_version(
  p_source_formulation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source public.formulations%ROWTYPE;
  v_new_id uuid;
  v_next_version integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create a formulation version';
  END IF;

  SELECT * INTO v_source
  FROM public.formulations
  WHERE id = p_source_formulation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source formulation not found: %', p_source_formulation_id;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_next_version
  FROM public.formulations
  WHERE code = v_source.code;

  INSERT INTO public.formulations (
    name, code, version, category, description, batch_size, batch_unit,
    target_protein, target_fat, target_fiber, target_moisture,
    estimated_cost_per_unit, status, created_by, approved_by,
    sage_code, unit_size_variants, is_approved, approved_at,
    approval_notes, is_daily_active, variation_name
  )
  VALUES (
    v_source.name, v_source.code, v_next_version, v_source.category,
    v_source.description, v_source.batch_size, v_source.batch_unit,
    v_source.target_protein, v_source.target_fat, v_source.target_fiber,
    v_source.target_moisture, v_source.estimated_cost_per_unit, 'draft',
    auth.uid(), NULL, v_source.sage_code, v_source.unit_size_variants,
    false, NULL, '', false, v_source.variation_name
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.formulation_ingredients (
    formulation_id, raw_material_id, quantity, unit, percentage,
    is_critical, notes, sort_order
  )
  SELECT v_new_id, raw_material_id, quantity, unit, percentage,
         is_critical, notes, sort_order
  FROM public.formulation_ingredients
  WHERE formulation_id = p_source_formulation_id;

  INSERT INTO public.production_bom_packaging (
    formulation_id, item_code, description, unit, expected_qty_per_tonne
  )
  SELECT v_new_id, item_code, description, unit, expected_qty_per_tonne
  FROM public.production_bom_packaging
  WHERE formulation_id = p_source_formulation_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.create_formulation_version(uuid) IS
  'Copies a formula BOM into the next draft version of the same formula code without modifying the source version.';
