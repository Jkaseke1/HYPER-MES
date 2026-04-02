-- Fix BOM ingredient quantity calculation bug
-- The previous trigger used non-existent quantity_ratio field
-- Correct formula: (percentage / 100) × planned_qty

CREATE OR REPLACE FUNCTION auto_load_bom_ingredients()
RETURNS trigger AS $$
BEGIN
    -- Only proceed if a formulation is selected
    IF NEW.formulation_id IS NOT NULL THEN
        -- Insert all ingredients from the formulation's BOM
        INSERT INTO production_order_materials (
            production_order_id,
            raw_material_id,
            planned_qty,
            actual_qty,
            issued,
            issued_at,
            created_at
        )
        SELECT 
            NEW.id,
            fi.raw_material_id,
            -- Calculate planned quantity: (quantity / 50.0) × planned_qty
            -- This accounts for BOM quantities being per 50kg bag from Sage
            ((fi.quantity / 50.0) * NEW.planned_qty) as planned_qty,
            NULL as actual_qty, -- Will be set when issued
            false as issued, -- Not issued initially
            NULL as issued_at,
            NOW() as created_at
        FROM formulation_ingredients fi
        WHERE fi.formulation_id = NEW.formulation_id
        AND fi.is_active = true;
        
        -- Log the auto-load for debugging
        RAISE NOTICE 'Auto-loaded % ingredients for production order %', 
            (SELECT COUNT(*) FROM formulation_ingredients WHERE formulation_id = NEW.formulation_id AND is_active = true),
            NEW.batch_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger with updated function
DROP TRIGGER IF EXISTS on_production_order_created ON production_orders;
CREATE TRIGGER on_production_order_created
    AFTER INSERT ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_load_bom_ingredients();
