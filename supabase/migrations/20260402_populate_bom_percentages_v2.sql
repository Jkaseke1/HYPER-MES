-- Populate percentage column from quantity data (v2)
-- Temporarily disable validation trigger to allow percentage population
-- BOM was seeded from Sage with quantities per 50kg bag
-- Calculate percentage: (quantity / 50.0) * 100

-- Disable the validation trigger temporarily
DROP TRIGGER IF EXISTS trigger_validate_bom_percentage ON formulation_ingredients;

-- Populate the percentage column
UPDATE formulation_ingredients fi
SET percentage = ROUND((fi.quantity / 50.0) * 100, 4)
WHERE fi.percentage = 0 AND fi.quantity > 0;

-- Re-create the validation trigger
CREATE TRIGGER trigger_validate_bom_percentage
AFTER INSERT OR UPDATE ON formulation_ingredients
FOR EACH ROW
EXECUTE FUNCTION validate_bom_total_percentage();
