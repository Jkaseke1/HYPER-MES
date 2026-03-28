-- Fix for BOM auto-load trigger - remove updated_at column
-- Run this in Supabase SQL Editor to fix the 400 Bad Request error

-- Drop and recreate the trigger with correct columns
DROP TRIGGER IF EXISTS on_production_order_created ON production_orders;
DROP FUNCTION IF EXISTS auto_load_bom_ingredients();

-- Recreate the function without updated_at column
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
            -- Calculate planned quantity: BOM ratio × planned batch size
            (fi.quantity_ratio * NEW.planned_qty) as planned_qty,
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

-- Recreate the trigger
CREATE TRIGGER on_production_order_created
    AFTER INSERT ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_load_bom_ingredients();

-- Verify the fix
SELECT 'Trigger fixed successfully' as status;
