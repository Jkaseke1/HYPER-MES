-- Enforce sequential workflow for production orders
-- This function prevents skipping steps in the production workflow

CREATE OR REPLACE FUNCTION enforce_production_workflow()
RETURNS trigger AS $$
DECLARE
    ingredient_count INTEGER;
    issued_count INTEGER;
    has_outputs BOOLEAN;
BEGIN
    -- Get ingredient counts for this production order
    SELECT 
        COUNT(*) as ingredient_count,
        COUNT(CASE WHEN issued = true THEN 1 END) as issued_count
    INTO ingredient_count, issued_count
    FROM production_order_materials
    WHERE production_order_id = COALESCE(NEW.production_order_id, OLD.production_order_id);
    
    -- Check if there are any outputs for completion check
    SELECT EXISTS(
        SELECT 1 FROM production_outputs 
        WHERE production_order_id = COALESCE(NEW.production_order_id, OLD.production_order_id)
        AND quantity_produced IS NOT NULL AND quantity_produced > 0
    ) INTO has_outputs;
    
    -- ENFORCEMENT RULES
    
    -- Rule 1: Cannot move to materials_issued unless ALL ingredients are issued
    IF NEW.status = 'materials_issued' THEN
        IF ingredient_count = 0 THEN
            RAISE EXCEPTION 'Cannot issue materials — no ingredients linked to this order. Please set up the BOM for this formulation first.';
        END IF;
        
        IF issued_count < ingredient_count THEN
            RAISE EXCEPTION 'Cannot mark materials as issued — not all ingredients have been issued individually. Please issue each ingredient separately from the Components tab.';
        END IF;
    END IF;
    
    -- Rule 2: Cannot move to in_progress unless status is materials_issued
    IF NEW.status = 'in_progress' THEN
        IF OLD.status != 'materials_issued' THEN
            RAISE EXCEPTION 'Cannot start production — materials must be issued first. Please issue all ingredients before starting production.';
        END IF;
    END IF;
    
    -- Rule 3: Cannot move to completed unless status is in_progress AND outputs are recorded
    IF NEW.status = 'completed' THEN
        IF OLD.status != 'in_progress' THEN
            RAISE EXCEPTION 'Cannot complete production order — production must be in progress first. Please start production before completing.';
        END IF;
        
        IF NOT has_outputs THEN
            RAISE EXCEPTION 'Cannot complete production order — actual output quantities must be recorded first. Please enter production outputs in the Output tab.';
        END IF;
    END IF;
    
    -- Rule 4: Cannot go backwards (except for admin corrections)
    IF OLD.status IN ('materials_issued', 'in_progress', 'completed') 
       AND NEW.status IN ('pending') 
       AND OLD.status != NEW.status THEN
        RAISE EXCEPTION 'Cannot revert production order status from % to % — workflow must move forward only.', OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce workflow
DROP TRIGGER IF EXISTS check_production_workflow ON production_orders;
CREATE TRIGGER check_production_workflow
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION enforce_production_workflow();
