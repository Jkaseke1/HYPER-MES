-- BOM Material Variance Tracking
-- Compares BOM required materials to actually used materials for variance analysis

-- Create a function to calculate BOM variance for a production order
CREATE OR REPLACE FUNCTION calculate_bom_variance(p_production_order_id uuid)
RETURNS TABLE (
    raw_material_id uuid,
    raw_material_name text,
    raw_material_code text,
    planned_qty numeric,
    actual_qty numeric,
    variance_qty numeric,
    variance_pct numeric,
    variance_type text,
    unit text,
    unit_cost numeric,
    planned_cost numeric,
    actual_cost numeric,
    cost_variance numeric,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pom.raw_material_id,
        rm.name as raw_material_name,
        rm.code as raw_material_code,
        pom.planned_qty,
        COALESCE(pom.actual_qty, 0) as actual_qty,
        -- Calculate variance quantities
        COALESCE(pom.actual_qty, 0) - pom.planned_qty as variance_qty,
        -- Calculate variance percentage
        CASE 
            WHEN pom.planned_qty > 0 
            THEN ROUND(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / pom.planned_qty) * 100, 2)
            ELSE 0 
        END as variance_pct,
        -- Classify variance type
        CASE 
            WHEN COALESCE(pom.actual_qty, 0) = 0 THEN 'Not Used'
            WHEN COALESCE(pom.actual_qty, 0) = pom.planned_qty THEN 'Exact'
            WHEN COALESCE(pom.actual_qty, 0) > pom.planned_qty THEN 'Overuse'
            ELSE 'Underuse'
        END as variance_type,
        pom.unit,
        rm.cost_per_unit as unit_cost,
        -- Calculate costs
        pom.planned_qty * rm.cost_per_unit as planned_cost,
        COALESCE(pom.actual_qty, 0) * rm.cost_per_unit as actual_cost,
        -- Calculate cost variance
        (COALESCE(pom.actual_qty, 0) * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit) as cost_variance,
        -- Status based on variance percentage
        CASE 
            WHEN pom.issued = false THEN 'Pending'
            WHEN ABS(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 5 THEN 'Within Tolerance'
            WHEN ABS(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 10 THEN 'Minor Variance'
            ELSE 'Major Variance'
        END as status
    FROM production_order_materials pom
    JOIN raw_materials rm ON pom.raw_material_id = rm.id
    WHERE pom.production_order_id = p_production_order_id
    ORDER BY 
        CASE 
            WHEN pom.issued = false THEN 1
            ELSE 0
        END,
        ABS(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) DESC,
        rm.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a summary view for BOM variance analysis
CREATE OR REPLACE VIEW bom_variance_summary AS
SELECT 
    po.id as production_order_id,
    po.batch_number,
    po.formulation_id,
    f.name as formulation_name,
    f.code as formulation_code,
    po.planned_qty as batch_planned_qty,
    po.actual_qty as batch_actual_qty,
    -- Material counts
    COUNT(pom.id) as total_materials,
    COUNT(CASE WHEN pom.issued = true THEN 1 END) as issued_materials,
    COUNT(CASE WHEN pom.issued = false THEN 1 END) as pending_materials,
    -- Variance summaries
    COUNT(CASE WHEN pom.issued = true AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 5 THEN 1 END) as within_tolerance,
    COUNT(CASE WHEN pom.issued = true AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) > 5 AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 10 THEN 1 END) as minor_variance,
    COUNT(CASE WHEN pom.issued = true AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) > 10 THEN 1 END) as major_variance,
    -- Cost summaries
    SUM(pom.planned_qty * rm.cost_per_unit) as total_planned_cost,
    SUM(COALESCE(pom.actual_qty, 0) * rm.cost_per_unit) as total_actual_cost,
    SUM((COALESCE(pom.actual_qty, 0) * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit)) as total_cost_variance,
    -- Overall variance percentage
    CASE 
        WHEN SUM(pom.planned_qty * rm.cost_per_unit) > 0 
        THEN ROUND(((SUM((COALESCE(pom.actual_qty, 0) * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit)) / SUM(pom.planned_qty * rm.cost_per_unit)) * 100), 2)
        ELSE 0 
    END as overall_variance_pct,
    -- Status assessment
    CASE 
        WHEN COUNT(CASE WHEN pom.issued = false THEN 1 END) > 0 THEN 'Incomplete'
        WHEN COUNT(CASE WHEN pom.issued = true AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) > 10 THEN 1 END) > 0 THEN 'Major Variance Alert'
        WHEN COUNT(CASE WHEN pom.issued = true AND ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) > 5 THEN 1 END) > 0 THEN 'Minor Variance'
        ELSE 'Within Tolerance'
    END as variance_status,
    po.status as production_status,
    po.created_at,
    po.actual_end
FROM production_orders po
JOIN formulations f ON po.formulation_id = f.id
LEFT JOIN production_order_materials pom ON po.id = pom.production_order_id
LEFT JOIN raw_materials rm ON pom.raw_material_id = rm.id
GROUP BY po.id, po.batch_number, po.formulation_id, f.name, f.code, po.planned_qty, po.actual_qty, po.status, po.created_at, po.actual_end
ORDER BY po.created_at DESC;

-- Create a function to automatically log significant variances
CREATE OR REPLACE FUNCTION log_material_variances()
RETURNS trigger AS $$
BEGIN
    -- Only log for completed production orders
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Check for major variances (>10%) and log them
        INSERT INTO sync_log (
            event_type,
            reference_id,
            reference_type,
            status,
            message,
            details
        )
        SELECT 
            'material_variance_alert',
            NEW.id,
            'production_order',
            'pending',
            'Major material variance detected - requires investigation',
            json_build_object(
                'production_order_id', NEW.id,
                'batch_number', NEW.batch_number,
                'major_variance_count', major_variance_count,
                'total_cost_variance', total_cost_variance,
                'overall_variance_pct', overall_variance_pct,
                'detected_at', NOW()
            )
        FROM (
            SELECT 
                COUNT(CASE WHEN ABS(((pom.actual_qty - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) > 10 THEN 1 END) as major_variance_count,
                SUM((pom.actual_qty * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit)) as total_cost_variance,
                CASE 
                    WHEN SUM(pom.planned_qty * rm.cost_per_unit) > 0 
                    THEN ((SUM((pom.actual_qty * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit)) / SUM(pom.planned_qty * rm.cost_per_unit)) * 100)
                    ELSE 0 
                END as overall_variance_pct
            FROM production_order_materials pom
            JOIN raw_materials rm ON pom.raw_material_id = rm.id
            WHERE pom.production_order_id = NEW.id
            AND pom.issued = true
        ) variance_data
        WHERE major_variance_count > 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log variances on completion
DROP TRIGGER IF EXISTS on_production_order_completed_variances ON production_orders;
CREATE TRIGGER on_production_order_completed_variances
    AFTER UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_material_variances();

-- Create a material variance report view for reconciliation
CREATE OR REPLACE VIEW material_variance_report AS
SELECT 
    -- Production order info
    po.batch_number,
    po.created_at::date as production_date,
    f.name as formulation_name,
    f.code as formulation_code,
    po.planned_qty as batch_size,
    
    -- Material details
    rm.name as material_name,
    rm.code as material_code,
    pom.planned_qty as bom_required_qty,
    COALESCE(pom.actual_qty, 0) as actual_used_qty,
    pom.unit,
    
    -- Variance calculations
    COALESCE(pom.actual_qty, 0) - pom.planned_qty as qty_variance,
    CASE 
        WHEN pom.planned_qty > 0 
        THEN ROUND(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / pom.planned_qty) * 100, 2)
        ELSE 0 
    END as pct_variance,
    
    -- Cost impact
    rm.cost_per_unit as unit_cost,
    pom.planned_qty * rm.cost_per_unit as planned_cost,
    COALESCE(pom.actual_qty, 0) * rm.cost_per_unit as actual_cost,
    (COALESCE(pom.actual_qty, 0) * rm.cost_per_unit) - (pom.planned_qty * rm.cost_per_unit) as cost_variance,
    
    -- Classification
    CASE 
        WHEN pom.issued = false THEN 'Not Issued'
        WHEN ABS(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 5 THEN 'Within Tolerance'
        WHEN ABS(((COALESCE(pom.actual_qty, 0) - pom.planned_qty) / NULLIF(pom.planned_qty, 0)) * 100) <= 10 THEN 'Minor Variance'
        ELSE 'Major Variance'
    END as variance_classification,
    
    -- Status
    CASE 
        WHEN po.status = 'completed' THEN 'Completed'
        WHEN pom.issued = true THEN 'Issued'
        ELSE 'Pending'
    END as material_status,
    
    -- Timestamps
    pom.issued_at,
    po.actual_end as production_completed_at
    
FROM production_orders po
JOIN formulations f ON po.formulation_id = f.id
JOIN production_order_materials pom ON po.id = pom.production_order_id
JOIN raw_materials rm ON pom.raw_material_id = rm.id
WHERE po.status IN ('completed', 'in_progress', 'materials_issued')
ORDER BY po.created_at DESC, po.batch_number, rm.name;
