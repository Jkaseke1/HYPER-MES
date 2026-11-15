-- Refuse issues that exceed available FIFO lots and make the bulk issue
-- operation atomic so one short ingredient cannot leave a partial issue.
CREATE OR REPLACE FUNCTION public.issue_individual_ingredient(
  p_material_id UUID,
  p_actual_qty  NUMERIC,
  p_issued_by   UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_production_order_id UUID;
  v_raw_material_id     UUID;
  v_unit                TEXT;
  v_unit_cost           NUMERIC;
  v_depleted            NUMERIC;
  v_batch_sample        TEXT;
  v_is_issued           BOOLEAN;
  v_order_status        TEXT;
  v_issuer_role         TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_issued_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The issuing user must match the authenticated user.';
  END IF;

  SELECT role INTO v_issuer_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_issuer_role IS NULL OR v_issuer_role NOT IN ('finance', 'accountant', 'admin') THEN
    RAISE EXCEPTION 'Finance approval is required to issue production materials.';
  END IF;

  IF p_actual_qty IS NULL OR p_actual_qty <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity: % (must be > 0)', p_actual_qty
      USING HINT = 'Enter a positive actual qty before issuing to production.';
  END IF;

  SELECT production_order_id
    INTO v_production_order_id
  FROM public.production_order_materials AS pom
  WHERE pom.id = p_material_id;

  IF v_production_order_id IS NULL THEN
    RAISE EXCEPTION 'Production order material % not found', p_material_id;
  END IF;

  SELECT status
    INTO v_order_status
  FROM public.production_orders
  WHERE id = v_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', v_production_order_id;
  END IF;

  IF v_order_status <> 'pending_finance' THEN
    RAISE EXCEPTION 'Production order % is not awaiting Finance approval', v_production_order_id;
  END IF;

  SELECT raw_material_id, unit, issued
    INTO v_raw_material_id, v_unit, v_is_issued
  FROM public.production_order_materials
  WHERE id = p_material_id
    AND production_order_id = v_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order material % not found', p_material_id;
  END IF;

  IF v_is_issued IS TRUE THEN
    RAISE EXCEPTION 'Production order material % has already been issued', p_material_id;
  END IF;

  PERFORM 1
  FROM public.raw_materials
  WHERE id = v_raw_material_id
  FOR UPDATE;

  SELECT cost_per_unit
    INTO v_unit_cost
  FROM public.raw_materials
  WHERE id = v_raw_material_id;

  SELECT batch_number INTO v_batch_sample
  FROM public.raw_material_lots
  WHERE raw_material_id = v_raw_material_id
    AND status = 'active'
    AND qty_remaining > 0
  ORDER BY received_date ASC, created_at ASC
  LIMIT 1;

  SELECT public.rm_lot_fifo_deplete(v_raw_material_id, p_actual_qty)
    INTO v_depleted;

  IF COALESCE(v_depleted, 0) < p_actual_qty THEN
    RAISE EXCEPTION 'Insufficient active lot quantity for material %: requested %, available %',
      v_raw_material_id, p_actual_qty, COALESCE(v_depleted, 0)
      USING HINT = 'Reconcile material lots before issuing this production ingredient.';
  END IF;

  INSERT INTO public.stock_movements (
    movement_type, reference_type, reference_id,
    raw_material_id, quantity, unit, batch_number,
    movement_date, performed_by, notes
  ) VALUES (
    'production_input', 'production_order_material', p_material_id,
    v_raw_material_id, -ABS(p_actual_qty), COALESCE(v_unit, 'kg'),
    COALESCE(v_batch_sample, ''),
    NOW(), p_issued_by,
    'Issued to production order ' || v_production_order_id::TEXT
  );

  UPDATE public.production_order_materials
  SET
    actual_qty = p_actual_qty,
    issued = TRUE,
    issued_at = NOW(),
    issued_by = p_issued_by,
    unit_cost = ROUND(COALESCE(v_unit_cost, 0)::numeric, 4),
    total_cost = ROUND((p_actual_qty * COALESCE(v_unit_cost, 0))::numeric, 4)
  WHERE id = p_material_id;
END;
$$;

COMMENT ON FUNCTION public.issue_individual_ingredient(UUID, NUMERIC, UUID) IS
  'Issues a production ingredient only when FIFO lots cover the full quantity; shortfalls abort and roll back the RPC.';

CREATE OR REPLACE FUNCTION public.issue_production_order_materials(
  p_production_order_id UUID,
  p_issued_by UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_status TEXT;
  v_issuer_role  TEXT;
  v_material     RECORD;
  v_issued_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR p_issued_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The issuing user must match the authenticated user.';
  END IF;

  SELECT role INTO v_issuer_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_issuer_role IS NULL OR v_issuer_role NOT IN ('finance', 'accountant', 'admin') THEN
    RAISE EXCEPTION 'Finance approval is required to issue production materials.';
  END IF;

  SELECT status INTO v_order_status
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', p_production_order_id;
  END IF;

  IF v_order_status <> 'pending_finance' THEN
    RAISE EXCEPTION 'Production order % is not awaiting Finance approval', p_production_order_id;
  END IF;

  -- Lock materials in a consistent order so concurrent issues cannot consume
  -- the same lots based on stale availability.
  PERFORM rm.id
  FROM public.raw_materials AS rm
  JOIN (
    SELECT DISTINCT raw_material_id
    FROM public.production_order_materials
    WHERE production_order_id = p_production_order_id
      AND issued IS NOT TRUE
  ) AS pending ON pending.raw_material_id = rm.id
  ORDER BY rm.id
  FOR UPDATE OF rm;

  FOR v_material IN
    SELECT
      pom.id,
      pom.raw_material_id,
      pom.planned_qty,
      rm.code,
      COALESCE(SUM(lot.qty_remaining) FILTER (
        WHERE lot.status = 'active' AND lot.qty_remaining > 0
      ), 0) AS available_qty
    FROM public.production_order_materials AS pom
    JOIN public.raw_materials AS rm ON rm.id = pom.raw_material_id
    LEFT JOIN public.raw_material_lots AS lot ON lot.raw_material_id = pom.raw_material_id
    WHERE pom.production_order_id = p_production_order_id
      AND pom.issued IS NOT TRUE
    GROUP BY pom.id, pom.raw_material_id, pom.planned_qty, rm.code
    ORDER BY pom.raw_material_id, pom.id
  LOOP
    IF v_material.planned_qty IS NULL OR v_material.planned_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid planned quantity for material %', v_material.code;
    END IF;

    IF v_material.available_qty < v_material.planned_qty THEN
      RAISE EXCEPTION 'Insufficient active lots for %: required %, available %',
        v_material.code, v_material.planned_qty, v_material.available_qty
        USING HINT = 'Reconcile material lots before issuing this production order.';
    END IF;
  END LOOP;

  FOR v_material IN
    SELECT id, planned_qty
    FROM public.production_order_materials
    WHERE production_order_id = p_production_order_id
      AND issued IS NOT TRUE
    ORDER BY raw_material_id, id
  LOOP
    PERFORM public.issue_individual_ingredient(
      v_material.id,
      v_material.planned_qty,
      p_issued_by
    );
    v_issued_count := v_issued_count + 1;
  END LOOP;

  IF v_issued_count = 0 THEN
    RAISE EXCEPTION 'Production order % has no unissued materials', p_production_order_id;
  END IF;

  RETURN v_issued_count;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_individual_ingredient(UUID, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_individual_ingredient(UUID, NUMERIC, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.issue_production_order_materials(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_production_order_materials(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.issue_production_order_materials(UUID, UUID) IS
  'Finance-only, atomic issue of all unissued materials for a pending-finance order; rejects the entire operation if any active lots are insufficient.';
