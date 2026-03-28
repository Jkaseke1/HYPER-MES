-- Diagnostic Query for Warehouse Stock Issues
-- Run this in Supabase SQL Editor to check raw_materials data

-- 1. Check current_stock values for all materials
SELECT 
    name,
    code,
    current_stock,
    reorder_level,
    cost_per_unit,
    is_active,
    category,
    unit
FROM raw_materials 
WHERE is_active = true
ORDER BY current_stock DESC
LIMIT 20;

-- 2. Check specifically for Maize Yellow
SELECT 
    name,
    code,
    current_stock,
    reorder_level,
    cost_per_unit,
    is_active
FROM raw_materials 
WHERE name ILIKE '%maize%' OR code ILIKE '%maize%'
ORDER BY name;

-- 3. Check for null current_stock values
SELECT 
    COUNT(*) as total_materials,
    COUNT(CASE WHEN current_stock IS NULL THEN 1 END) as null_stock_count,
    COUNT(CASE WHEN current_stock = 0 THEN 1 END) as zero_stock_count,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as positive_stock_count,
    MAX(current_stock) as max_stock,
    MIN(current_stock) as min_stock
FROM raw_materials 
WHERE is_active = true;

-- 4. Check data types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'raw_materials' 
AND column_name = 'current_stock';

-- 5. Sample of materials with their current_stock
SELECT 
    name,
    code,
    current_stock,
    CASE 
        WHEN current_stock = 0 THEN 'Out of Stock'
        WHEN current_stock <= reorder_level THEN 'Low Stock'
        ELSE 'In Stock'
    END as calculated_status
FROM raw_materials 
WHERE is_active = true
ORDER BY current_stock DESC
LIMIT 10;
