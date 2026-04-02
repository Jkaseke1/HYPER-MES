-- Add sage_code field to formulations for Sage Pastel integration
ALTER TABLE formulations ADD COLUMN sage_code VARCHAR(50) UNIQUE;

-- Add comment explaining the field
COMMENT ON COLUMN formulations.sage_code IS 'Sage Pastel item code for integration and syncing';

-- Create index for faster lookups
CREATE INDEX idx_formulations_sage_code ON formulations(sage_code);
