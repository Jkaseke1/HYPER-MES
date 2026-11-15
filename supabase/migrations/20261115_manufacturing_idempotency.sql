BEGIN;

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS creation_request_id uuid,
  ADD COLUMN IF NOT EXISTS production_line_cost numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS production_orders_creation_request_id_uidx
  ON public.production_orders (creation_request_id)
  WHERE creation_request_id IS NOT NULL;

COMMENT ON COLUMN public.production_orders.creation_request_id IS
  'Client request key used to prevent a retried MES order submission from creating a second production order.';

CREATE OR REPLACE FUNCTION public.record_production_daily_issues_once(
  p_production_order_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.production_orders%ROWTYPE;
  v_issue record;
  v_existing_count integer;
  v_existing_qty numeric;
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record production issues.';
  END IF;

  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', p_production_order_id;
  END IF;

  FOR v_issue IN
    SELECT
      pom.raw_material_id,
      rm.name AS raw_material_name,
      SUM(pom.actual_qty) AS quantity_kg
    FROM public.production_order_materials AS pom
    JOIN public.raw_materials AS rm ON rm.id = pom.raw_material_id
    WHERE pom.production_order_id = p_production_order_id
      AND pom.issued IS TRUE
    GROUP BY pom.raw_material_id, rm.name
    ORDER BY pom.raw_material_id
  LOOP
    IF v_issue.quantity_kg IS NULL OR v_issue.quantity_kg <= 0 THEN
      RAISE EXCEPTION 'Issued quantity is invalid for order % and material %.',
        v_order.batch_number, v_issue.raw_material_name;
    END IF;

    SELECT COUNT(*), MAX(issue.quantity_kg)
      INTO v_existing_count, v_existing_qty
    FROM public.rm_daily_issues AS issue
    WHERE issue.production_order_ref = v_order.batch_number
      AND (
        issue.raw_material_id = v_issue.raw_material_id
        OR (
          issue.raw_material_id IS NULL
          AND issue.raw_material_name = v_issue.raw_material_name
        )
      );

    IF v_existing_count > 1 THEN
      RAISE EXCEPTION
        'Duplicate daily issue records already exist for order % and material %; reconcile them before retrying.',
        v_order.batch_number, v_issue.raw_material_name;
    ELSIF v_existing_count = 1 THEN
      IF v_existing_qty IS NULL OR ABS(v_existing_qty - v_issue.quantity_kg) > 0.00005 THEN
        RAISE EXCEPTION
          'Daily issue record for order % and material % does not match the issued quantity; reconcile it before retrying.',
          v_order.batch_number, v_issue.raw_material_name;
      END IF;

      UPDATE public.rm_daily_issues
      SET raw_material_id = v_issue.raw_material_id
      WHERE production_order_ref = v_order.batch_number
        AND raw_material_id IS NULL
        AND raw_material_name = v_issue.raw_material_name;
    ELSE
      INSERT INTO public.rm_daily_issues (
        issue_date,
        raw_material_name,
        raw_material_id,
        quantity_kg,
        production_order_ref,
        created_by
      ) VALUES (
        CURRENT_DATE,
        v_issue.raw_material_name,
        v_issue.raw_material_id,
        v_issue.quantity_kg,
        v_order.batch_number,
        auth.uid()
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  IF v_inserted = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.production_order_materials
    WHERE production_order_id = p_production_order_id
      AND issued IS TRUE
  ) THEN
    RAISE EXCEPTION 'Production order % has no issued materials to record', v_order.batch_number;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.record_production_daily_issues_once(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_production_daily_issues_once(uuid) TO authenticated;

COMMENT ON FUNCTION public.record_production_daily_issues_once(uuid) IS
  'Records one idempotent daily-issues summary per production order and raw material; detects conflicting or duplicate legacy rows.';

CREATE OR REPLACE FUNCTION public.queue_production_completion_once(
  p_production_order_id uuid,
  p_completion jsonb,
  p_packaging jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.production_orders%ROWTYPE;
  v_existing_status text;
  v_existing_details jsonb;
  v_actual_qty numeric;
  v_rejected_qty numeric;
  v_wastage_qty numeric;
  v_output_id uuid;
  v_row_count integer;
  v_existing_qty numeric;
  v_packaging_item jsonb;
  v_packaging_sku_id uuid;
  v_bags_used integer;
  v_implied_tonnes numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to complete a production order.';
  END IF;
  IF jsonb_typeof(p_completion) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Production completion details must be an object.';
  END IF;
  IF jsonb_typeof(p_packaging) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Production packaging declaration must be an array.';
  END IF;

  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', p_production_order_id;
  END IF;
  IF v_order.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Production order % is not in progress', v_order.batch_number;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.production_order_materials
    WHERE production_order_id = p_production_order_id
  ) OR EXISTS (
    SELECT 1
    FROM public.production_order_materials
    WHERE production_order_id = p_production_order_id
      AND issued IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'All production materials must be issued before completion of order %.',
      v_order.batch_number;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.sync_log
    WHERE event_type = 'materials_issued'
      AND reference_type IN ('production_orders', 'production_order')
      AND reference_id = p_production_order_id
      AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'Sage material issue must succeed before completion of order %.',
      v_order.batch_number;
  END IF;

  SELECT status, details INTO v_existing_status, v_existing_details
  FROM public.sync_log
  WHERE event_type = 'production_completed'
    AND reference_type = 'production_orders'
    AND reference_id = p_production_order_id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_status IN ('pending', 'processing', 'success') THEN
      IF v_existing_details ? 'completionRequest'
        AND v_existing_details->'completionRequest' IS DISTINCT FROM jsonb_build_object(
          'completion', p_completion,
          'packaging', p_packaging
        ) THEN
        RAISE EXCEPTION 'A completion is already queued for order % with different output details.',
          v_order.batch_number;
      END IF;
      RETURN 'already-queued';
    END IF;
    RAISE EXCEPTION
      'A previous Sage completion event is %; resolve or retry that event instead of creating another.',
      v_existing_status;
  END IF;

  v_actual_qty := NULLIF(p_completion->>'actual_qty', '')::numeric;
  v_rejected_qty := COALESCE(NULLIF(p_completion->>'rejected_qty', '')::numeric, 0);
  v_wastage_qty := COALESCE(NULLIF(p_completion->>'wastage_qty', '')::numeric, 0);

  IF v_actual_qty IS NULL OR v_actual_qty <= 0
    OR v_rejected_qty < 0 OR v_rejected_qty > v_actual_qty
    OR v_wastage_qty < 0 THEN
    RAISE EXCEPTION 'Enter valid positive output and non-negative rejected/wastage quantities.';
  END IF;
  IF COALESCE(NULLIF(p_completion->>'actual_bags', '')::numeric, 0) < 0
    OR COALESCE(NULLIF(p_completion->>'rejected_bags', '')::numeric, 0) < 0
    OR COALESCE(NULLIF(p_completion->>'wastage_bags', '')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'Bag counts cannot be negative.';
  END IF;

  UPDATE public.production_orders
  SET
    raw_material_cost = COALESCE(NULLIF(p_completion->>'raw_material_cost', '')::numeric, raw_material_cost),
    packaging_cost = COALESCE(NULLIF(p_completion->>'packaging_cost', '')::numeric, packaging_cost),
    labour_cost = COALESCE(NULLIF(p_completion->>'labour_cost', '')::numeric, labour_cost),
    machine_cost = COALESCE(NULLIF(p_completion->>'machine_cost', '')::numeric, machine_cost),
    overhead_cost = COALESCE(NULLIF(p_completion->>'overhead_cost', '')::numeric, overhead_cost),
    production_line_cost = COALESCE(NULLIF(p_completion->>'production_line_cost', '')::numeric, production_line_cost),
    actual_qty = v_actual_qty,
    actual_bags = NULLIF(p_completion->>'actual_bags', '')::numeric,
    rejected_qty = v_rejected_qty,
    rejected_bags = NULLIF(p_completion->>'rejected_bags', '')::numeric,
    wastage_qty = v_wastage_qty,
    wastage_bags = NULLIF(p_completion->>'wastage_bags', '')::numeric,
    actual_hours = NULLIF(p_completion->>'actual_hours', '')::numeric,
    average_throughput = NULLIF(p_completion->>'average_throughput', '')::numeric,
    total_cost = COALESCE(NULLIF(p_completion->>'total_cost', '')::numeric, total_cost),
    cost_per_unit = COALESCE(NULLIF(p_completion->>'cost_per_unit', '')::numeric, cost_per_unit),
    actual_end = NULL,
    updated_at = NOW()
  WHERE id = p_production_order_id;

  SELECT COUNT(*) INTO v_row_count
  FROM public.production_outputs
  WHERE production_order_id = p_production_order_id;

  IF v_row_count > 1 THEN
    RAISE EXCEPTION 'Multiple finished-output records already exist for order %; reconcile them before completion.',
      v_order.batch_number;
  ELSIF v_row_count = 1 THEN
    SELECT id INTO v_output_id
    FROM public.production_outputs
    WHERE production_order_id = p_production_order_id
    ORDER BY recorded_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    FOR UPDATE;

    UPDATE public.production_outputs
    SET
      quantity_produced = v_actual_qty,
      quantity_bags = NULLIF(p_completion->>'actual_bags', '')::numeric,
      rejected_quantity = v_rejected_qty,
      rejected_bags = NULLIF(p_completion->>'rejected_bags', '')::numeric,
      wastage_quantity = v_wastage_qty,
      wastage_bags = NULLIF(p_completion->>'wastage_bags', '')::numeric,
      bag_size_kg = NULLIF(p_completion->>'bag_size_kg', '')::numeric,
      unit = v_order.unit,
      recorded_at = NOW(),
      recorded_by = auth.uid()
    WHERE id = v_output_id;
  ELSE
    INSERT INTO public.production_outputs (
      production_order_id,
      batch_number,
      quantity_produced,
      quantity_bags,
      rejected_quantity,
      rejected_bags,
      wastage_quantity,
      wastage_bags,
      bag_size_kg,
      unit,
      recorded_by
    ) VALUES (
      p_production_order_id,
      v_order.batch_number,
      v_actual_qty,
      NULLIF(p_completion->>'actual_bags', '')::numeric,
      v_rejected_qty,
      NULLIF(p_completion->>'rejected_bags', '')::numeric,
      v_wastage_qty,
      NULLIF(p_completion->>'wastage_bags', '')::numeric,
      NULLIF(p_completion->>'bag_size_kg', '')::numeric,
      v_order.unit,
      auth.uid()
    );
  END IF;

  SELECT COUNT(*), MAX(quantity)
    INTO v_row_count, v_existing_qty
  FROM public.stock_movements
  WHERE movement_type = 'production_output'
    AND reference_type = 'production_order'
    AND reference_id = p_production_order_id;

  IF v_row_count > 1 THEN
    RAISE EXCEPTION 'Multiple finished-stock movements already exist for order %; reconcile them before completion.',
      v_order.batch_number;
  ELSIF v_row_count = 1 THEN
    IF v_existing_qty IS DISTINCT FROM v_actual_qty THEN
      RAISE EXCEPTION 'Existing finished-stock movement quantity differs for order %; reconcile it before completion.',
        v_order.batch_number;
    END IF;
  ELSE
    INSERT INTO public.stock_movements (
      movement_type,
      formulation_id,
      quantity,
      unit,
      notes,
      reference_type,
      reference_id,
      batch_number,
      movement_date,
      performed_by
    ) VALUES (
      'production_output',
      v_order.formulation_id,
      v_actual_qty,
      v_order.unit,
      'Production output recorded',
      'production_order',
      p_production_order_id,
      v_order.batch_number,
      NOW(),
      auth.uid()
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_packaging) AS item(value)
    GROUP BY item.value->>'packaging_sku_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Packaging declaration contains duplicate SKU lines.';
  END IF;

  FOR v_packaging_item IN
    SELECT value FROM jsonb_array_elements(p_packaging)
  LOOP
    v_packaging_sku_id := NULLIF(v_packaging_item->>'packaging_sku_id', '')::uuid;
    v_bags_used := NULLIF(v_packaging_item->>'bags_used', '')::integer;
    v_implied_tonnes := COALESCE(NULLIF(v_packaging_item->>'implied_tonnes', '')::numeric, 0);

    IF v_packaging_sku_id IS NULL OR v_bags_used IS NULL OR v_bags_used <= 0 OR v_implied_tonnes < 0 THEN
      RAISE EXCEPTION 'Packaging declaration contains an invalid SKU, bag count, or implied tonnage.';
    END IF;

    SELECT COUNT(*) INTO v_row_count
    FROM public.batch_packaging_used
    WHERE production_order_id = p_production_order_id
      AND packaging_sku_id = v_packaging_sku_id;

    IF v_row_count > 1 THEN
      RAISE EXCEPTION 'Duplicate packaging usage already exists for order % and SKU %; reconcile it before completion.',
        v_order.batch_number, v_packaging_sku_id;
    ELSIF v_row_count = 1 THEN
      UPDATE public.batch_packaging_used
      SET bags_used = v_bags_used, implied_tonnes = v_implied_tonnes
      WHERE production_order_id = p_production_order_id
        AND packaging_sku_id = v_packaging_sku_id;
    ELSE
      INSERT INTO public.batch_packaging_used (
        production_order_id,
        packaging_sku_id,
        bags_used,
        implied_tonnes,
        created_by
      ) VALUES (
        p_production_order_id,
        v_packaging_sku_id,
        v_bags_used,
        v_implied_tonnes,
        auth.uid()
      );
    END IF;

    UPDATE public.production_order_packaging
    SET actual_qty = v_bags_used
    WHERE production_order_id = p_production_order_id
      AND packaging_sku_id = v_packaging_sku_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Packaging SKU % is not configured for production order %.',
        v_packaging_sku_id, v_order.batch_number;
    END IF;
  END LOOP;

  INSERT INTO public.sync_log (
    event_type,
    reference_type,
    reference_id,
    status,
    description,
    message,
    details,
    created_at,
    updated_at
  ) VALUES (
    'production_completed',
    'production_orders',
    p_production_order_id,
    'pending',
    'Batch completed — ' || v_order.batch_number,
    'Production completion queued. Please wait while Sage posts the finished-goods receipt; MES will complete this batch automatically once Sage confirms it.',
    jsonb_build_object(
      'completionRequest',
      jsonb_build_object('completion', p_completion, 'packaging', p_packaging)
    ),
    NOW(),
    NOW()
  );

  RETURN 'queued';
END;
$$;

REVOKE ALL ON FUNCTION public.queue_production_completion_once(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_production_completion_once(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.queue_production_completion_once(uuid, jsonb, jsonb) IS
  'Atomically records one production completion snapshot, stock movement, packaging declaration, and Sage event per in-progress order.';

COMMIT;
