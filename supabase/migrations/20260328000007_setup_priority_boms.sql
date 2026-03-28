-- Set up BOM ingredients for priority formulations
-- These formulations need their ingredients set up for testing

-- First, check if formulations exist and get their IDs
DO $$
DECLARE
    bsg50_id uuid;
    bsc50_id uuid;
    bgm50_id uuid;
BEGIN
    -- Get formulation IDs
    SELECT id INTO bsg50_id FROM formulations WHERE code = 'BSG50';
    SELECT id INTO bsc50_id FROM formulations WHERE code = 'BSC50';
    SELECT id INTO bgm50_id FROM formulations WHERE code = 'BGM50';
    
    -- BSG50 (Broiler Starter/Grower 50kg) - Standard broiler feed
    IF bsg50_id IS NOT NULL THEN
        -- Clear existing ingredients to avoid duplicates
        DELETE FROM formulation_ingredients WHERE formulation_id = bsg50_id;
        
        -- Add BOM ingredients (typical broiler starter/grower composition)
        INSERT INTO formulation_ingredients (formulation_id, raw_material_id, quantity_ratio, unit, is_active) VALUES
        -- Energy sources (60% of formulation)
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'MAIZE'), 60.00, 'kg', true),
        
        -- Protein sources (30% of formulation)
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'SBM'), 25.00, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'FISHMEAL'), 5.00, 'kg', true),
        
        -- Vitamins and minerals (5% of formulation)
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'VIT_PREMIX'), 2.50, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'MIN_PREMIX'), 2.00, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'LYSINE'), 0.30, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'METHIONINE'), 0.20, 'kg', true),
        
        -- Additives and binders (5% of formulation)
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'LIME_STONE'), 3.00, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'SALT'), 0.50, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'ENZYME'), 0.20, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'TOXIN_BINDER'), 0.30, 'kg', true),
        (bsg50_id, (SELECT id FROM raw_materials WHERE code = 'ANTIOXIDANT'), 0.20, 'kg', true);
        
        RAISE NOTICE 'Set up BOM for BSG50 (Broiler Starter/Grower 50kg)';
    ELSE
        RAISE NOTICE 'BSG50 formulation not found - skipping BOM setup';
    END IF;
    
    -- BSC50 (Broiler Starter Crumbs 50kg) - Crumbled starter feed
    IF bsc50_id IS NOT NULL THEN
        -- Clear existing ingredients
        DELETE FROM formulation_ingredients WHERE formulation_id = bsc50_id;
        
        -- Add BOM ingredients (similar to BSG50 but with different ratios for crumb texture)
        INSERT INTO formulation_ingredients (formulation_id, raw_material_id, quantity_ratio, unit, is_active) VALUES
        -- Energy sources (58% of formulation - slightly lower for better crumb)
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'MAIZE'), 55.00, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'WHEAT_BRAN'), 3.00, 'kg', true),
        
        -- Protein sources (32% of formulation - higher protein for starter)
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'SBM'), 28.00, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'FISHMEAL'), 4.00, 'kg', true),
        
        -- Vitamins and minerals (6% of formulation - higher for starter)
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'VIT_PREMIX'), 3.00, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'MIN_PREMIX'), 2.50, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'LYSINE'), 0.35, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'METHIONINE'), 0.25, 'kg', true),
        
        -- Additives and binders (4% of formulation)
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'LIME_STONE'), 2.50, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'SALT'), 0.40, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'ENZYME'), 0.25, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'TOXIN_BINDER'), 0.35, 'kg', true),
        (bsc50_id, (SELECT id FROM raw_materials WHERE code = 'ANTIOXIDANT'), 0.25, 'kg', true);
        
        RAISE NOTICE 'Set up BOM for BSC50 (Broiler Starter Crumbs 50kg)';
    ELSE
        RAISE NOTICE 'BSC50 formulation not found - skipping BOM setup';
    END IF;
    
    -- BGM50 (Broiler Grower Mash 50kg) - Grower phase feed
    IF bgm50_id IS NOT NULL THEN
        -- Clear existing ingredients
        DELETE FROM formulation_ingredients WHERE formulation_id = bgm50_id;
        
        -- Add BOM ingredients (lower protein, higher energy for grower phase)
        INSERT INTO formulation_ingredients (formulation_id, raw_material_id, quantity_ratio, unit, is_active) VALUES
        -- Energy sources (65% of formulation - higher energy for growth)
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'MAIZE'), 62.00, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'WHEAT_BRAN'), 3.00, 'kg', true),
        
        -- Protein sources (25% of formulation - lower protein for grower)
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'SBM'), 22.00, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'FISHMEAL'), 3.00, 'kg', true),
        
        -- Vitamins and minerals (5% of formulation)
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'VIT_PREMIX'), 2.00, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'MIN_PREMIX'), 2.00, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'LYSINE'), 0.25, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'METHIONINE'), 0.15, 'kg', true),
        
        -- Additives and binders (5% of formulation)
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'LIME_STONE'), 3.50, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'SALT'), 0.50, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'ENZYME'), 0.20, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'TOXIN_BINDER'), 0.30, 'kg', true),
        (bgm50_id, (SELECT id FROM raw_materials WHERE code = 'ANTIOXIDANT'), 0.20, 'kg', true);
        
        RAISE NOTICE 'Set up BOM for BGM50 (Broiler Grower Mash 50kg)';
    ELSE
        RAISE NOTICE 'BGM50 formulation not found - skipping BOM setup';
    END IF;
    
    RAISE NOTICE 'BOM setup completed for priority formulations';
END $$;

-- Create a view to check BOM completeness
CREATE OR REPLACE VIEW formulation_bom_status AS
SELECT 
    f.id,
    f.code,
    f.name,
    COUNT(fi.id) as ingredient_count,
    COUNT(CASE WHEN fi.is_active = true THEN 1 END) as active_ingredients,
    CASE 
        WHEN COUNT(fi.id) = 0 THEN 'No BOM'
        WHEN COUNT(CASE WHEN fi.is_active = true THEN 1 END) = 0 THEN 'No Active Ingredients'
        WHEN COUNT(CASE WHEN fi.is_active = true THEN 1 END) >= 8 THEN 'Complete'
        ELSE 'Incomplete'
    END as bom_status,
    CASE 
        WHEN COUNT(fi.id) = 0 THEN 'red'
        WHEN COUNT(CASE WHEN fi.is_active = true THEN 1 END) = 0 THEN 'amber'
        WHEN COUNT(CASE WHEN fi.is_active = true THEN 1 END) >= 8 THEN 'emerald'
        ELSE 'amber'
    END as status_color
FROM formulations f
LEFT JOIN formulation_ingredients fi ON f.id = fi.formulation_id
GROUP BY f.id, f.code, f.name
ORDER BY f.code;
