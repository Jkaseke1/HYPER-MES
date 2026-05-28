-- Fix chick_purchase_orders FK to point to chick_suppliers
-- This fixes the issue where the old migration created the FK pointing to the wrong table

-- Step 1: Drop ALL supplier_id related constraints on chick_purchase_orders
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'chick_purchase_orders'::regclass
      AND conname LIKE '%supplier%'
  LOOP
    EXECUTE format('ALTER TABLE chick_purchase_orders DROP CONSTRAINT IF EXISTS %I', rec.conname);
    RAISE NOTICE 'Dropped constraint: %', rec.conname;
  END LOOP;
END $$;

-- Step 2: Add correct FK pointing to chick_suppliers
ALTER TABLE chick_purchase_orders
  ADD CONSTRAINT chick_purchase_orders_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES chick_suppliers(id);

-- Step 3: Verify
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'chick_purchase_orders'::regclass
  AND conname LIKE '%supplier%';

-- Step 4: Refresh cache
NOTIFY pgrst, 'reload schema';
