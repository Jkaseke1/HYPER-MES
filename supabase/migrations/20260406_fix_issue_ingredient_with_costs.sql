-- Update issue_individual_ingredient RPC to include unit_cost and total_cost
-- This ensures costs are set atomically when an ingredient is issued

CREATE OR REPLACE FUNCTION issue_individual_ingredient(
    p_material_id uuid,
    p_actual_qty numeric,
    p_issued_by uuid
)
RETURNS void AS $$
DECLARE
    v_production_order_id uuid;
    v_material_exists boolean;
    v_raw_material_id uuid;
    v_unit_cost numeric;
BEGIN
    -- Check if the material exists
    SELECT EXISTS(
        SELECT 1 FROM production_order_materials 
        WHERE id = p_material_id
    ) INTO v_material_exists;
    
    IF NOT v_material_exists THEN
        RAISE EXCEPTION 'Production order material not found';
    END IF;
    
    -- Get the production order ID and raw material ID for logging
    SELECT production_order_id, raw_material_id INTO v_production_order_id, v_raw_material_id
    FROM production_order_materials
    WHERE id = p_material_id;
    
    -- Get the unit cost from raw materials
    SELECT cost_per_unit INTO v_unit_cost
    FROM raw_materials
    WHERE id = v_raw_material_id;
    
    -- Update the specific ingredient as issued with costs
    UPDATE production_order_materials
    SET 
        actual_qty = p_actual_qty,
        issued = true,
        issued_at = NOW(),
        issued_by = p_issued_by,
        unit_cost = ROUND(COALESCE(v_unit_cost, 0)::numeric, 4),
        total_cost = ROUND((p_actual_qty * COALESCE(v_unit_cost, 0))::numeric, 4)
    WHERE id = p_material_id;
    
    -- Log the individual ingredient issuance for Sage integration
    INSERT INTO sync_log (
        event_type,
        reference_id,
        reference_type,
        status,
        description,
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
            'unit_cost', ROUND(COALESCE(v_unit_cost, 0)::numeric, 4),
            'total_cost', ROUND((p_actual_qty * COALESCE(v_unit_cost, 0))::numeric, 4),
            'issued_by', p_issued_by,
            'issued_at', NOW()
        )
    ) ON CONFLICT DO NOTHING;
    
    -- Log for debugging
    RAISE NOTICE 'Individual ingredient % issued for production order % with unit_cost %', 
        p_material_id, v_production_order_id, ROUND(COALESCE(v_unit_cost, 0)::numeric, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
