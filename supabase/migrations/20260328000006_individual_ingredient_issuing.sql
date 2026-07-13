-- Individual ingredient issuing function
-- This allows each ingredient to be issued separately, firing Sage triggers individually

CREATE OR REPLACE FUNCTION issue_individual_ingredient(
    p_material_id uuid,
    p_actual_qty numeric,
    p_issued_by uuid
)
RETURNS void AS $$
DECLARE
    v_production_order_id uuid;
    v_material_exists boolean;
BEGIN
    -- Check if the material exists
    SELECT EXISTS(
        SELECT 1 FROM production_order_materials 
        WHERE id = p_material_id
    ) INTO v_material_exists;
    
    IF NOT v_material_exists THEN
        RAISE EXCEPTION 'Production order material not found';
    END IF;
    
    -- Get the production order ID for logging
    SELECT production_order_id INTO v_production_order_id
    FROM production_order_materials
    WHERE id = p_material_id;
    
    -- Update the specific ingredient as issued
    UPDATE production_order_materials
    SET 
        actual_qty = p_actual_qty,
        issued = true,
        issued_at = NOW(),
        issued_by = p_issued_by
    WHERE id = p_material_id;
    
    -- Log the individual ingredient issuance for Sage integration
    INSERT INTO sync_log (
        event_type,
        reference_id,
        reference_type,
        status,
        message,
        details
    ) VALUES (
        'materials_issued',
        p_material_id,
        'production_order_materials',
        'pending',
        'Individual ingredient issued - ready for Sage sync',
        json_build_object(
            'material_id', p_material_id,
            'production_order_id', v_production_order_id,
            'actual_qty', p_actual_qty,
            'issued_by', p_issued_by,
            'issued_at', NOW()
        )
    );
    
    -- Log for debugging
    RAISE NOTICE 'Individual ingredient % issued for production order %', 
        p_material_id, v_production_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a convenience function to check if all ingredients are issued
CREATE OR REPLACE FUNCTION check_all_ingredients_issued(p_production_order_id uuid)
RETURNS boolean AS $$
DECLARE
    total_ingredients integer;
    issued_ingredients integer;
BEGIN
    -- Count total ingredients
    SELECT COUNT(*) INTO total_ingredients
    FROM production_order_materials
    WHERE production_order_id = p_production_order_id;
    
    -- Count issued ingredients
    SELECT COUNT(*) INTO issued_ingredients
    FROM production_order_materials
    WHERE production_order_id = p_production_order_id
    AND issued = true;
    
    -- Return true if all are issued
    RETURN total_ingredients > 0 AND total_ingredients = issued_ingredients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view to show ingredient issuance status
CREATE OR REPLACE VIEW production_order_ingredients_status AS
SELECT 
    pom.id,
    pom.production_order_id,
    po.batch_number,
    po.status as order_status,
    pom.raw_material_id,
    rm.name as raw_material_name,
    rm.code as raw_material_code,
    pom.planned_qty,
    pom.actual_qty,
    pom.issued,
    pom.issued_at,
    pom.issued_by,
    CASE 
        WHEN pom.issued THEN 'Issued'
        ELSE 'Pending'
    END as issuance_status,
    -- Helper column for UI - can this ingredient be issued?
    CASE 
        WHEN NOT pom.issued AND po.status IN ('pending', 'materials_issued') THEN true
        ELSE false
    END as can_issue
FROM production_order_materials pom
JOIN production_orders po ON pom.production_order_id = po.id
JOIN raw_materials rm ON pom.raw_material_id = rm.id
ORDER BY po.batch_number, rm.name;
