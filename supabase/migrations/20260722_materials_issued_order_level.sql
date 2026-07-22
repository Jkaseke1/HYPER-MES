-- Group materials_issued bridge events at PRODUCTION ORDER level
-- so finance approves one review package (all BOM lines), not each ingredient.

CREATE OR REPLACE FUNCTION trigger_materials_issued()
RETURNS trigger AS $$
BEGIN
  -- Intentionally no-op for bridge sync.
  -- One order-level materials_issued event is emitted when the production
  -- order status becomes materials_issued (see trigger_order_materials_issued).
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_order_materials_issued()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sync_log
    WHERE event_type = 'materials_issued'
      AND reference_id = NEW.id
      AND reference_type = 'production_orders'
      AND status IN ('pending', 'processing', 'pending_finance_review', 'success')
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO sync_log (
    event_type,
    reference_id,
    reference_type,
    status,
    message,
    details
  ) VALUES (
    'materials_issued',
    NEW.id,
    'production_orders',
    'pending',
    'All materials issued for production order - ready for Sage sync',
    json_build_object(
      'production_order_id', NEW.id,
      'batch_number', NEW.batch_number,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_materials_issued ON production_orders;
CREATE TRIGGER on_order_materials_issued
  AFTER UPDATE ON production_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'materials_issued')
  EXECUTE FUNCTION trigger_order_materials_issued();

COMMENT ON FUNCTION trigger_materials_issued() IS 'No-op: materials_issued bridge event is order-level only';
COMMENT ON FUNCTION trigger_order_materials_issued() IS 'Fires one materials_issued sync_log per production order';
