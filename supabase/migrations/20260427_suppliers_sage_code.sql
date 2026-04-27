-- Add sage_code column to suppliers for Sage Pastel integration
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS sage_code TEXT;

-- Index for fast bridge lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_sage_code ON suppliers (sage_code);
