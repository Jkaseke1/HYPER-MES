ALTER TABLE formulations ADD COLUMN sage_code VARCHAR(50) UNIQUE;

CREATE INDEX idx_formulations_sage_code ON formulations(sage_code);

ALTER TABLE formulations ADD COLUMN unit_size_variants JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_formulations_unit_size_variants ON formulations USING GIN (unit_size_variants);

ALTER TABLE formulation_ingredients ADD CONSTRAINT check_positive_quantity CHECK (quantity > 0);

ALTER TABLE formulation_ingredients ADD CONSTRAINT check_valid_percentage CHECK (percentage >= 0 AND percentage <= 100);

CREATE OR REPLACE FUNCTION validate_bom_total_percentage()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT ABS(SUM(percentage) - 100) > 0.1 
      FROM formulation_ingredients 
      WHERE formulation_id = NEW.formulation_id) THEN
    RAISE EXCEPTION 'BOM ingredients must total 100%% (currently: %%)', 
      (SELECT SUM(percentage) FROM formulation_ingredients WHERE formulation_id = NEW.formulation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_bom_percentage
AFTER INSERT OR UPDATE ON formulation_ingredients
FOR EACH ROW
EXECUTE FUNCTION validate_bom_total_percentage();
