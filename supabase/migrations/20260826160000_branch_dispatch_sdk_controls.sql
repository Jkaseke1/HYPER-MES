-- Branch dispatches are configured explicitly and released only after receipt and Finance approval.
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS sage_warehouse_code text,
  ADD COLUMN IF NOT EXISTS sage_warehouse_id integer;
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS sage_warehouse_code text,
  ADD COLUMN IF NOT EXISTS sage_warehouse_id integer;

ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS warehouses_sage_warehouse_id_positive;
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_sage_warehouse_id_positive CHECK (sage_warehouse_id IS NULL OR sage_warehouse_id > 0);
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_sage_warehouse_code_unique ON public.warehouses (upper(sage_warehouse_code)) WHERE sage_warehouse_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_branch_receipt_once ON public.stock_movements (reference_id, formulation_id, movement_type) WHERE movement_type = 'transfer_in' AND reference_id IS NOT NULL AND formulation_id IS NOT NULL;

-- Reuse the established Evolution warehouse mapping that the legacy dispatch
-- bridge used. MES branch account codes can be duplicated, so the mapping is
-- stored on every matching branch while the physical MES warehouse remains
-- the single ledger location for that Sage warehouse.
WITH sage_mapping (sage_account_code, warehouse_code, warehouse_id) AS (
  VALUES
    ('AMT0002', 'AMT', 2), ('BUL0001', 'BUL', 3), ('KAG0001', 'KAG', 5),
    ('MAK0001', 'MAK', 7), ('MAR0001', 'MAR', 8), ('MAS0001', 'MAS', 9),
    ('NGE0001', 'NGE', 10), ('SHO0001', 'SHO', 11), ('MTR0002', 'MUT', 21),
    ('MBU0001', 'MBU', 23), ('ZVI0001', 'ZVI', 24), ('FCS0001', 'FCS', 26),
    ('EPW0001', 'EPW', 27), ('MAZ00001', 'MAZ', 28), ('MSA0002', 'MSA', 31),
    ('DAN0002', 'DAN', 32), ('HAT0001', 'HAT', 35), ('GLE0002', 'GLE', 36),
    ('DOM0002', 'DOM', 37), ('MAINDOM0002', 'MAIN', 38), ('CHI000001', 'CHI', 39),
    ('CHK0001', 'CHK', 40), ('SOU0001', 'SOU', 41), ('CHR0002', 'CHR', 43),
    ('GWE0001', 'GWE', 44)
)
UPDATE public.branches b
SET sage_warehouse_code = m.warehouse_code, sage_warehouse_id = m.warehouse_id
FROM sage_mapping m
WHERE upper(b.sage_code) = m.sage_account_code;

WITH sage_mapping (warehouse_code, warehouse_id) AS (
  VALUES
    ('AMT', 2), ('BUL', 3), ('KAG', 5), ('MAK', 7), ('MAR', 8), ('MAS', 9),
    ('NGE', 10), ('SHO', 11), ('MUT', 21), ('MBU', 23), ('ZVI', 24), ('FCS', 26),
    ('EPW', 27), ('MAZ', 28), ('MSA', 31), ('DAN', 32), ('HAT', 35), ('GLE', 36),
    ('DOM', 37), ('MAIN', 38), ('CHI', 39), ('CHK', 40), ('SOU', 41), ('CHR', 43), ('GWE', 44)
)
UPDATE public.warehouses w
SET sage_warehouse_code = m.warehouse_code, sage_warehouse_id = m.warehouse_id
FROM sage_mapping m
WHERE upper(w.code) = m.warehouse_code;

CREATE OR REPLACE FUNCTION public.confirm_branch_dispatch_receipt(
  p_dispatch_id uuid,
  p_confirmation_notes text,
  p_confirmed_by uuid,
  p_lines jsonb
)
RETURNS void AS $$
DECLARE
  v_dispatch public.dispatch_orders%ROWTYPE;
  v_receiving_warehouse uuid;
  v_line jsonb;
  v_formulation_id uuid;
  v_quantity numeric;
BEGIN
  SELECT * INTO v_dispatch FROM public.dispatch_orders WHERE id = p_dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch % was not found.', p_dispatch_id; END IF;
  IF v_dispatch.status <> 'delivered' THEN RAISE EXCEPTION 'Branch receipt can only be confirmed after delivery.'; END IF;
  IF v_dispatch.branch_confirmation_status = 'confirmed' THEN RAISE EXCEPTION 'This branch receipt has already been confirmed.'; END IF;
  SELECT w.id INTO v_receiving_warehouse
  FROM public.branches b
  JOIN public.warehouses w ON upper(w.code) = upper(b.sage_warehouse_code)
  WHERE b.id = v_dispatch.branch_id AND w.type = 'finished_goods' AND w.is_active = true;
  IF v_receiving_warehouse IS NULL THEN RAISE EXCEPTION 'No active finished-goods warehouse is configured for the receiving branch.'; END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_formulation_id := NULLIF(v_line->>'formulation_id', '')::uuid;
    v_quantity := COALESCE((v_line->>'quantity')::numeric, 0);
    IF v_formulation_id IS NULL THEN RAISE EXCEPTION 'Every branch receipt line requires a finished-good formulation.'; END IF;
    IF v_quantity < 0 THEN RAISE EXCEPTION 'Received quantity cannot be negative.'; END IF;
    INSERT INTO public.stock_movements (warehouse_id, raw_material_id, formulation_id, movement_type, quantity, unit, notes, reference_type, reference_id, batch_number, movement_date, performed_by)
    VALUES (v_receiving_warehouse, NULL, v_formulation_id, 'transfer_in', v_quantity, COALESCE(v_line->>'unit', 'kg'),
      format('Branch Goods Receipt %s - Received %s %s', v_dispatch.dispatch_number, v_quantity, COALESCE(v_line->>'unit', 'kg')),
      'dispatch_order', v_dispatch.id, NULLIF(v_line->>'batch_number', ''), now(), p_confirmed_by)
    ON CONFLICT (reference_id, formulation_id, movement_type) WHERE movement_type = 'transfer_in' AND reference_id IS NOT NULL AND formulation_id IS NOT NULL DO NOTHING;
  END LOOP;

  UPDATE public.dispatch_orders SET status = 'delivered', delivered_at = now(), branch_confirmation_status = 'confirmed',
    branch_confirmed_by = p_confirmed_by, branch_confirmed_at = now(), branch_confirmation_notes = COALESCE(p_confirmation_notes, ''), updated_at = now()
  WHERE id = v_dispatch.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_dispatch_delivered()
RETURNS trigger AS $$
BEGIN
  IF NEW.dispatch_type = 'branch_transfer' AND NEW.status = 'delivered' AND NEW.branch_confirmation_status = 'confirmed' AND NEW.accounts_posting_status = 'approved'
     AND NOT EXISTS (SELECT 1 FROM public.sync_log WHERE event_type = 'dispatch_delivered' AND reference_id = NEW.id AND reference_type = 'dispatch_orders' AND status IN ('pending', 'retry', 'processing', 'pending_finance_review', 'success'))
  THEN
    INSERT INTO public.sync_log (event_type, reference_id, reference_type, status, message, details)
    VALUES ('dispatch_delivered', NEW.id, 'dispatch_orders', 'pending', 'Branch receipt and Finance release completed', jsonb_build_object('dispatch_number', NEW.dispatch_number, 'branch_id', NEW.branch_id, 'dispatch_type', NEW.dispatch_type));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_dispatch_delivered ON public.dispatch_orders;
CREATE TRIGGER on_dispatch_delivered AFTER UPDATE OF status, branch_confirmation_status, accounts_posting_status ON public.dispatch_orders
  FOR EACH ROW WHEN (NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.branch_confirmation_status IS DISTINCT FROM NEW.branch_confirmation_status OR OLD.accounts_posting_status IS DISTINCT FROM NEW.accounts_posting_status))
  EXECUTE FUNCTION public.trigger_dispatch_delivered();

COMMENT ON COLUMN public.warehouses.sage_warehouse_code IS 'Sage warehouse code used by the Evolution SDK for this MES warehouse.';
COMMENT ON COLUMN public.warehouses.sage_warehouse_id IS 'Sage warehouse numeric ID used for MES read-only stock cache reconciliation.';
COMMENT ON COLUMN public.branches.sage_warehouse_code IS 'Sage warehouse code receiving this branch dispatch.';
COMMENT ON COLUMN public.branches.sage_warehouse_id IS 'Sage warehouse numeric ID used for MES stock cache reconciliation.';
