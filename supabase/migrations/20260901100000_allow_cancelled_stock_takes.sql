-- A practice Sage snapshot must be safely cancellable before any physical
-- quantity is entered, so it never blocks the subsequent real stock take.

ALTER TABLE public.stock_takes
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.stock_takes
  DROP CONSTRAINT IF EXISTS stock_takes_status_check;

ALTER TABLE public.stock_takes
  ADD CONSTRAINT stock_takes_status_check
  CHECK (status IN ('OPEN', 'FROZEN', 'CLOSED', 'CANCELLED'));

CREATE OR REPLACE FUNCTION public.cancel_stock_take(
  p_stock_take_id uuid,
  p_reason text DEFAULT 'Practice run cancelled before counts were entered.'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_take stock_takes%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF COALESCE(v_role, '') NOT IN ('admin', 'md', 'warehouse_manager', 'raw_material_manager') THEN
    RAISE EXCEPTION 'Only the Raw Materials/Warehouse owner or an administrator can cancel a stock take.';
  END IF;

  SELECT * INTO v_take FROM stock_takes WHERE id = p_stock_take_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock take not found.';
  END IF;
  IF v_take.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Only an open stock take can be cancelled.';
  END IF;
  IF EXISTS (SELECT 1 FROM stock_take_lines WHERE stock_take_id = p_stock_take_id AND counted_qty IS NOT NULL) THEN
    RAISE EXCEPTION 'A stock take with entered quantities cannot be cancelled.';
  END IF;

  UPDATE stock_takes
  SET status = 'CANCELLED',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Practice run cancelled before counts were entered.'),
      updated_at = now()
  WHERE id = p_stock_take_id;

  INSERT INTO stock_take_audit_log (stock_take_id, action, changed_by, notes)
  VALUES (p_stock_take_id, 'stock_take_cancelled', auth.uid(), COALESCE(NULLIF(btrim(p_reason), ''), 'Practice run cancelled before counts were entered.'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_stock_take(uuid, text) TO authenticated, service_role;
