-- Create trigger to update raw_materials stock when material transfer is approved

-- Create function to update raw materials stock
CREATE OR REPLACE FUNCTION update_raw_materials_on_transfer_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transfer is approved, update the raw_materials stock
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.movement_type = 'transfer' THEN
    -- Update the raw_materials table to add the transferred quantity
    UPDATE raw_materials
    SET 
      current_stock = current_stock + NEW.quantity,
      updated_at = NOW()
    WHERE id = NEW.material_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_raw_materials_on_transfer_approval ON stock_movements;

-- Create trigger on stock_movements table
CREATE TRIGGER trigger_update_raw_materials_on_transfer_approval
AFTER UPDATE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_raw_materials_on_transfer_approval();

-- Also create a function to handle retroactive updates for already-approved transfers
CREATE OR REPLACE FUNCTION update_raw_materials_for_approved_transfers()
RETURNS void AS $$
BEGIN
  -- Update raw_materials for all approved transfers that haven't been processed yet
  UPDATE raw_materials rm
  SET 
    current_stock = current_stock + sm.quantity,
    updated_at = NOW()
  FROM stock_movements sm
  WHERE sm.material_id = rm.id
    AND sm.movement_type = 'transfer'
    AND sm.status = 'approved'
    AND sm.approved_at IS NOT NULL
    AND sm.updated_at > NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Run the retroactive update for already-approved transfers
SELECT update_raw_materials_for_approved_transfers();
