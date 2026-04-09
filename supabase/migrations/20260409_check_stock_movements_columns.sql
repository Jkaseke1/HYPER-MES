-- Check the structure of stock_movements table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;

-- Also check a sample record to see what data is available
SELECT * FROM stock_movements LIMIT 1;
