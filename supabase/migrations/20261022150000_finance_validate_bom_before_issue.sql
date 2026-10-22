-- Finance must validate the formula and BOM before materials are issued.
-- Production can only send the order for review; stock does not move until
-- Finance approves and the existing issue RPCs run.

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;
ALTER TABLE public.production_orders
  ADD CONSTRAINT production_orders_status_check
  CHECK (status IN ('pending', 'pending_finance', 'materials_issued', 'in_progress', 'completed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.enforce_production_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ingredient_count integer;
    issued_count integer;
    has_outputs boolean;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE issued = true)
      INTO ingredient_count, issued_count
      FROM public.production_order_materials
     WHERE production_order_id = COALESCE(NEW.id, OLD.id);

    has_outputs := COALESCE(NEW.actual_qty, 0) > 0;
    IF NOT has_outputs THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.production_outputs
         WHERE production_order_id = COALESCE(NEW.id, OLD.id)
           AND quantity_produced IS NOT NULL
           AND quantity_produced > 0
      ) INTO has_outputs;
    END IF;

    IF NEW.status = 'pending_finance' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only a pending production order can be sent to Finance for BOM and formula validation.';
      END IF;
      IF ingredient_count = 0 THEN
        RAISE EXCEPTION 'Cannot send to Finance — no ingredients linked to this order. Please set up the BOM for this formulation first.';
      END IF;
    END IF;

    IF NEW.status = 'materials_issued' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status IS DISTINCT FROM 'pending_finance' THEN
        RAISE EXCEPTION 'Cannot issue materials until Finance has validated the formula and BOM.';
      END IF;
      IF ingredient_count = 0 THEN
        RAISE EXCEPTION 'Cannot issue materials — no ingredients linked to this order. Please set up the BOM for this formulation first.';
      END IF;
      IF issued_count < ingredient_count THEN
        RAISE EXCEPTION 'Cannot mark materials as issued — not all ingredients have been issued individually. Please issue each ingredient separately from the Components tab.';
      END IF;
    END IF;

    IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM NEW.status AND OLD.status != 'materials_issued' THEN
      RAISE EXCEPTION 'Cannot start production — materials must be issued first. Please issue all ingredients before starting production.';
    END IF;

    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status != 'in_progress' THEN
        RAISE EXCEPTION 'Cannot complete production order — production must be in progress first. Please start production before completing.';
      END IF;
      IF NOT has_outputs THEN
        RAISE EXCEPTION 'Cannot complete production order — actual output quantities must be recorded first. Please enter production outputs in the Output tab.';
      END IF;
    END IF;

    IF OLD.status IN ('materials_issued', 'in_progress', 'completed') AND NEW.status IN ('pending', 'pending_finance') AND OLD.status != NEW.status THEN
      RAISE EXCEPTION 'Cannot revert production order status from % to % — workflow must move forward only.', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.production_orders.status IS
  'pending → pending_finance (Finance validates formula/BOM) → materials_issued → in_progress → completed.';

NOTIFY pgrst, 'reload schema';
