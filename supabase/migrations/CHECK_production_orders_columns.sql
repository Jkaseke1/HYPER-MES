-- Check production_orders table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'production_orders'
ORDER BY ordinal_position;
