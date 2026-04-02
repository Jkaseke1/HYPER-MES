-- Add constraint to prevent 0 quantity ingredients in BOM
ALTER TABLE formulation_ingredients 
ADD CONSTRAINT check_positive_quantity CHECK (quantity > 0);

-- Add constraint to ensure percentage is between 0 and 100
ALTER TABLE formulation_ingredients 
ADD CONSTRAINT check_valid_percentage CHECK (percentage >= 0 AND percentage <= 100);

-- Create function to validate BOM totals
CREATE OR REPLACE FUNCTION validate_bom_total_percentage()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if total percentage for this formulation is close to 100%
  -- Allow 0.1% tolerance for rounding
  IF (SELECT ABS(SUM(percentage) - 100) > 0.1 
      FROM formulation_ingredients 
      WHERE formulation_id = NEW.formulation_id) THEN
    RAISE EXCEPTION 'BOM ingredients must total 100%% (currently: %%)', 
      (SELECT SUM(percentage) FROM formulation_ingredients WHERE formulation_id = NEW.formulation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate BOM percentages on insert/update
CREATE TRIGGER trigger_validate_bom_percentage
AFTER INSERT OR UPDATE ON formulation_ingredients
FOR EACH ROW
EXECUTE FUNCTION validate_bom_total_percentage();
