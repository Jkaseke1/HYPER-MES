-- Stop duplicate dispatch finance review packages.
--
-- A delivered dispatch may be approved by Accounts after delivery. That status
-- update must not create a second dispatch_delivered sync event when the first
-- event is already waiting in finance review.

CREATE OR REPLACE FUNCTION trigger_dispatch_delivered()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'delivered'
     AND NOT EXISTS (
       SELECT 1
       FROM sync_log
       WHERE event_type = 'dispatch_delivered'
         AND reference_id = NEW.id
         AND reference_type = 'dispatch_orders'
         AND status IN ('pending', 'retry', 'pending_finance_review', 'success')
     )
  THEN
    INSERT INTO sync_log (
      event_type,
      reference_id,
      reference_type,
      status,
      message,
      details
    ) VALUES (
      'dispatch_delivered',
      NEW.id,
      'dispatch_orders',
      'pending',
      'Dispatch order delivered',
      json_build_object(
        'dispatch_number', NEW.dispatch_number,
        'branch_id', NEW.branch_id,
        'dispatch_type', NEW.dispatch_type,
        'accounts_posting_status', NEW.accounts_posting_status,
        'total_weight', NEW.total_weight,
        'total_value', NEW.total_value,
        'delivered_at', NEW.delivered_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_dispatch_delivered ON dispatch_orders;
CREATE TRIGGER on_dispatch_delivered
  AFTER UPDATE OF status, accounts_posting_status ON dispatch_orders
  FOR EACH ROW
  WHEN (
    NEW.status = 'delivered'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.accounts_posting_status IS DISTINCT FROM NEW.accounts_posting_status
    )
  )
  EXECUTE FUNCTION trigger_dispatch_delivered();

COMMENT ON FUNCTION trigger_dispatch_delivered() IS
  'Idempotently creates Event 4 for Sage bridge when a dispatch is delivered or later approved by Accounts; pending finance review counts as already queued.';
