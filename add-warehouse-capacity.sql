-- =====================================================
-- ADD CAPACITY FIELD TO WAREHOUSES TABLE
-- =====================================================

-- Add capacity field to warehouses
ALTER TABLE warehouses 
  ADD COLUMN IF NOT EXISTS capacity_tons numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stock_tons numeric DEFAULT 0;

-- Add capacity utilization percentage calculation
COMMENT ON COLUMN warehouses.capacity_tons IS 'Maximum storage capacity in metric tons';
COMMENT ON COLUMN warehouses.current_stock_tons IS 'Current stock level in metric tons';

-- Verify the columns were added
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'warehouses' 
  AND column_name IN ('capacity_tons', 'current_stock_tons')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Warehouse capacity fields added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New Fields:';
  RAISE NOTICE '- capacity_tons: Maximum storage capacity';
  RAISE NOTICE '- current_stock_tons: Current stock level';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now track:';
  RAISE NOTICE '- Warehouse capacity utilization';
  RAISE NOTICE '- Available space';
  RAISE NOTICE '- Capacity alerts when near full';
END $$;
