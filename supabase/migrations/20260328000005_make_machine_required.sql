-- Make machine field required for production orders
-- Every batch must be tied to a specific machine for downtime tracking

-- Add NOT NULL constraint to machine_id
ALTER TABLE production_orders 
ALTER COLUMN machine_id SET NOT NULL;

-- Add comment explaining the requirement
COMMENT ON COLUMN production_orders.machine_id IS 'Required field - every production batch must be assigned to a specific machine for tracking and integration purposes';

-- Create a check constraint to ensure machine_id is not null
ALTER TABLE production_orders 
ADD CONSTRAINT production_orders_machine_required 
CHECK (machine_id IS NOT NULL);

-- Update RLS policies to ensure machine_id is always provided
DROP POLICY IF EXISTS "Authenticated users can insert production_orders" ON production_orders;
CREATE POLICY "Authenticated users can insert production_orders"
  ON production_orders FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND machine_id IS NOT NULL
    AND batch_number IS NOT NULL
  );
