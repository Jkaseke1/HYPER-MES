-- Add unit_size_variants JSONB field to store multiple unit size options
ALTER TABLE formulations ADD COLUMN unit_size_variants JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN formulations.unit_size_variants IS 'JSON array of unit size variants with batch sizes. Example: [{"size": "8kg", "batch_size": 800}, {"size": "10kg", "batch_size": 1000}, {"size": "25kg", "batch_size": 2500}]';

-- Create index for JSONB queries
CREATE INDEX idx_formulations_unit_size_variants ON formulations USING GIN (unit_size_variants);
