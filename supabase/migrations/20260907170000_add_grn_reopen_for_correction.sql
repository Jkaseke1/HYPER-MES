-- A GRN can be corrected only before Sage has posted it. Reopening reverses the
-- MES effects created during approval so a corrected re-approval is not double counted.

CREATE TABLE IF NOT EXISTS public.grn_correction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_received_notes(id),
  corrected_by uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL,
  previous_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_correction_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can read GRN correction audit"
  ON public.grn_correction_audit
  FOR SELECT TO authenticated
  USING (public.has_mes_role(ARRAY['admin', 'finance', 'accountant']));

CREATE OR REPLACE FUNCTION public.reopen_grn_for_correction(
  p_grn_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn public.goods_received_notes%ROWTYPE;
  v_item record;
BEGIN
  IF NOT public.has_mes_role(ARRAY['admin', 'finance', 'accountant']) THEN
    RAISE EXCEPTION 'Only Finance, Accountant, or Admin users can reopen a GRN.';
  END IF;

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A correction reason is required.';
  END IF;

  SELECT * INTO v_grn
  FROM public.goods_received_notes
  WHERE id = p_grn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN % was not found.', p_grn_id;
  END IF;

  IF v_grn.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved, not-yet-posted GRN can be reopened.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sync_log
    WHERE event_type = 'grn_confirmed'
      AND reference_type = 'goods_received_notes'
      AND reference_id = p_grn_id
      AND status IN ('success', 'processing')
  ) THEN
    RAISE EXCEPTION 'This GRN is already posting or posted to Sage and cannot be edited. Use a reversal/correction process instead.';
  END IF;

  INSERT INTO public.grn_correction_audit (grn_id, corrected_by, reason, previous_snapshot)
  SELECT
    v_grn.id,
    auth.uid(),
    btrim(p_reason),
    jsonb_build_object(
      'header', to_jsonb(v_grn),
      'items', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM public.grn_items i WHERE i.grn_id = v_grn.id), '[]'::jsonb)
    );

  FOR v_item IN
    SELECT raw_material_id, received_qty
    FROM public.grn_items
    WHERE grn_id = v_grn.id
  LOOP
    PERFORM public.update_warehouse_balance(
      v_item.raw_material_id,
      v_grn.warehouse_id,
      -COALESCE(v_item.received_qty, 0)
    );
  END LOOP;

  DELETE FROM public.rm_cost_register
  WHERE grn_id = v_grn.id
    AND source = 'GRN';

  DELETE FROM public.rm_daily_receipts
  WHERE grn_reference = v_grn.grn_number;

  UPDATE public.sync_log
  SET
    status = 'failed',
    message = format('Cancelled for correction: %s', btrim(p_reason)),
    next_retry_at = NULL,
    updated_at = now()
  WHERE event_type = 'grn_confirmed'
    AND reference_type = 'goods_received_notes'
    AND reference_id = v_grn.id
    AND status IN ('pending', 'retry', 'failed');

  UPDATE public.goods_received_notes
  SET
    status = 'pending',
    approved_by = NULL,
    approved_at = NULL,
    rejection_reason = NULL,
    vat_mode = 'pending_finance',
    vat_treatment = NULL,
    vat_tax_type_id = NULL,
    vat_code = NULL,
    vat_rate = NULL,
    vat_reviewed_by = NULL,
    vat_reviewed_at = NULL,
    updated_at = now()
  WHERE id = v_grn.id;
END;
$$;

DROP POLICY IF EXISTS "MES operators can edit pending GRN headers" ON public.goods_received_notes;
CREATE POLICY "MES operators can edit pending GRN headers"
  ON public.goods_received_notes
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND public.has_mes_role(ARRAY['admin', 'warehouse_manager', 'raw_material_manager', 'rm_manager', 'procurement', 'finance', 'accountant'])
  )
  WITH CHECK (
    status = 'pending'
    AND public.has_mes_role(ARRAY['admin', 'warehouse_manager', 'raw_material_manager', 'rm_manager', 'procurement', 'finance', 'accountant'])
  );

REVOKE ALL ON FUNCTION public.reopen_grn_for_correction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_grn_for_correction(uuid, text) TO authenticated, service_role;
