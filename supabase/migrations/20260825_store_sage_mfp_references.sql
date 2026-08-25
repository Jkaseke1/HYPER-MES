-- Retains the Sage manufacturing-process reference allocated for each MES batch.
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS sage_mfp_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_orders_sage_mfp_reference
  ON production_orders (sage_mfp_reference)
  WHERE sage_mfp_reference IS NOT NULL;
