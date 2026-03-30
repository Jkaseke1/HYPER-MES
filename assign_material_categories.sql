-- Fix 2: Assign Categories to Materials
-- Run this in Supabase SQL Editor to categorize all materials

-- Update materials with proper categories based on their names and types
UPDATE raw_materials SET category = 'grain' 
WHERE name ILIKE '%maize%' OR name ILIKE '%millet%' OR name ILIKE '%wheat%' OR name ILIKE '%corn%';

UPDATE raw_materials SET category = 'protein' 
WHERE name ILIKE '%soya%' OR name ILIKE '%sunflower%' OR name ILIKE '%cotton%' OR name ILIKE '%protein%';

UPDATE raw_materials SET category = 'mineral' 
WHERE name ILIKE '%limestone%' OR name ILIKE '%calcium%' OR name ILIKE '%phosphate%' OR name ILIKE '%mineral%';

UPDATE raw_materials SET category = 'vitamin' 
WHERE name ILIKE '%vitamin%' OR name ILIKE '%premix%' OR name ILIKE '%supplement%';

UPDATE raw_materials SET category = 'additive' 
WHERE name ILIKE '%molasses%' OR name ILIKE '%additive%' OR name ILIKE '%binder%' OR name ILIKE '%enzyme%';

-- Set category to 'other' for any remaining uncategorized materials
UPDATE raw_materials SET category = 'other' 
WHERE category IS NULL OR category = '';

-- Verify the category assignments
SELECT 
    category,
    COUNT(*) as count,
    STRING_AGG(name, ', ' ORDER BY name) as materials
FROM raw_materials 
WHERE is_active = true OR is_active IS NULL
GROUP BY category
ORDER BY category;

-- Show all materials with their new categories
SELECT 
    name,
    code,
    category,
    current_stock,
    reorder_level,
    cost_per_unit
FROM raw_materials 
WHERE is_active = true OR is_active IS NULL
ORDER BY category, name;
