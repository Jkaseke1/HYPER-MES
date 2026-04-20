-- Add current_stock column to formulations table for tracking finished goods inventory
ALTER TABLE formulations
ADD COLUMN IF NOT EXISTS current_stock numeric DEFAULT 0;

-- Create a function to calculate current stock for a formulation from stock_movements
CREATE OR REPLACE FUNCTION calculate_formulation_stock(p_formulation_id uuid)
RETURNS numeric AS $$
DECLARE
  v_stock numeric;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'production_output' THEN quantity
      WHEN movement_type = 'dispatch' THEN -quantity
      WHEN movement_type = 'adjustment' THEN quantity
      ELSE 0
    END
  ), 0)
  INTO v_stock
  FROM stock_movements
  WHERE formulation_id = p_formulation_id;
  
  RETURN v_stock;
END;
$$ LANGUAGE plpgsql;

-- Populate current_stock for all existing formulations
UPDATE formulations
SET current_stock = calculate_formulation_stock(id);

-- Create a trigger to update current_stock when stock_movements are inserted
CREATE OR REPLACE FUNCTION update_formulation_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.formulation_id IS NOT NULL THEN
    UPDATE formulations
    SET current_stock = calculate_formulation_stock(NEW.formulation_id)
    WHERE id = NEW.formulation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_formulation_stock ON stock_movements;
CREATE TRIGGER trigger_update_formulation_stock
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_formulation_stock();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_formulations_current_stock ON formulations(current_stock);
