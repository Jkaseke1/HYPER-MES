-- Add triggers for Sage Pastel bridge integration
-- These triggers will fire when key events happen in the MES

-- Trigger for GRN confirmation (Event 1)
CREATE OR REPLACE FUNCTION trigger_grn_confirmed()
RETURNS trigger AS $$
BEGIN
  -- Insert sync log entry for bridge to process
  INSERT INTO sync_log (
    event_type,
    reference_id,
    reference_type,
    status,
    message,
    details
  ) VALUES (
    'grn_confirmed',
    NEW.id,
    'goods_received_notes',
    'pending',
    'GRN confirmed - ready for Sage sync',
    json_build_object(
      'grn_number', NEW.grn_number,
      'supplier_id', NEW.supplier_id,
      'warehouse_id', NEW.warehouse_id,
      'received_date', NEW.received_date
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for GRN status change to 'approved'
DROP TRIGGER IF EXISTS on_grn_approved ON goods_received_notes;
CREATE TRIGGER on_grn_approved
  AFTER UPDATE ON goods_received_notes
  FOR EACH ROW
  WHEN (OLD.status != 'approved' AND NEW.status = 'approved')
  EXECUTE FUNCTION trigger_grn_confirmed();

-- Trigger for production order materials issued (Event 2)
CREATE OR REPLACE FUNCTION trigger_materials_issued()
RETURNS trigger AS $$
BEGIN
  -- Insert sync log entry for bridge to process
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
    'production_order_materials',
    'pending',
    'Materials issued for production',
    json_build_object(
      'production_order_id', NEW.production_order_id,
      'raw_material_id', NEW.raw_material_id,
      'actual_qty', NEW.actual_qty,
      'issued_at', NEW.issued_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for production_order_materials.issued = true
DROP TRIGGER IF EXISTS on_materials_issued ON production_order_materials;
CREATE TRIGGER on_materials_issued
  AFTER UPDATE ON production_order_materials
  FOR EACH ROW
  WHEN (OLD.issued != true AND NEW.issued = true)
  EXECUTE FUNCTION trigger_materials_issued();

-- Trigger for production order completion (Event 3)
CREATE OR REPLACE FUNCTION trigger_production_completed()
RETURNS trigger AS $$
BEGIN
  -- Insert sync log entry for bridge to process
  INSERT INTO sync_log (
    event_type,
    reference_id,
    reference_type,
    status,
    message,
    details
  ) VALUES (
    'production_completed',
    NEW.id,
    'production_orders',
    'pending',
    'Production order completed',
    json_build_object(
      'batch_number', NEW.batch_number,
      'formulation_id', NEW.formulation_id,
      'actual_qty', NEW.actual_qty,
      'completed_at', NEW.actual_end
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for production_orders.status = 'completed'
DROP TRIGGER IF EXISTS on_production_completed ON production_orders;
CREATE TRIGGER on_production_completed
  AFTER UPDATE ON production_orders
  FOR EACH ROW
  WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION trigger_production_completed();

-- Trigger for dispatch order delivery (Event 4)
CREATE OR REPLACE FUNCTION trigger_dispatch_delivered()
RETURNS trigger AS $$
BEGIN
  -- Insert sync log entry for bridge to process
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
      'total_value', NEW.total_value,
      'delivered_at', NEW.delivered_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for dispatch_orders.status = 'delivered'
DROP TRIGGER IF EXISTS on_dispatch_delivered ON dispatch_orders;
CREATE TRIGGER on_dispatch_delivered
  AFTER UPDATE ON dispatch_orders
  FOR EACH ROW
  WHEN (OLD.status != 'delivered' AND NEW.status = 'delivered')
  EXECUTE FUNCTION trigger_dispatch_delivered();

-- Add comments for documentation
COMMENT ON FUNCTION trigger_grn_confirmed() IS 'Trigger for GRN approval - fires Event 1 for Sage bridge';
COMMENT ON FUNCTION trigger_materials_issued() IS 'Trigger for material issuance - fires Event 2 for Sage bridge';
COMMENT ON FUNCTION trigger_production_completed() IS 'Trigger for production completion - fires Event 3 for Sage bridge';
COMMENT ON FUNCTION trigger_dispatch_delivered() IS 'Trigger for dispatch delivery - fires Event 4 for Sage bridge';
