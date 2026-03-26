-- =====================================================
-- CHECK AND ADD CURRENCY COLUMN TO RAW MATERIALS
-- Run this to add currency support to raw_materials table
-- =====================================================

-- Check if currency_code column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raw_materials' 
  AND column_name IN ('currency_code', 'cost_per_unit_usd');

-- Add currency_code column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_materials' AND column_name = 'currency_code'
  ) THEN
    ALTER TABLE raw_materials 
      ADD COLUMN currency_code text DEFAULT 'ZAR' REFERENCES currencies(code);
    RAISE NOTICE 'Added currency_code column to raw_materials';
  ELSE
    RAISE NOTICE 'currency_code column already exists';
  END IF;
END $$;

-- Add cost_per_unit_usd column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_materials' AND column_name = 'cost_per_unit_usd'
  ) THEN
    ALTER TABLE raw_materials 
      ADD COLUMN cost_per_unit_usd numeric DEFAULT 0;
    RAISE NOTICE 'Added cost_per_unit_usd column to raw_materials';
  ELSE
    RAISE NOTICE 'cost_per_unit_usd column already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'raw_materials' 
  AND column_name IN ('currency_code', 'cost_per_unit_usd', 'warehouse_id')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Currency columns check complete!';
  RAISE NOTICE 'You can now save raw materials with currency support.';
END $$;
