-- Fix chick_purchase_orders FK to point to chick_suppliers (v2 - comprehensive)
-- This fixes the issue where the old migration created the FK pointing to suppliers(id)

-- Step 1: NULL out any supplier_ids that don't exist in chick_suppliers
-- (so ADD CONSTRAINT won't fail on existing data)
UPDATE chick_purchase_orders
SET supplier_id = NULL
WHERE supplier_id IS NOT NULL
  AND supplier_id NOT IN (SELECT id FROM chick_suppliers);

-- Step 2: Drop ALL supplier_id related constraints on chick_purchase_orders
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
    EXECUTE format('ALTER TABLE chick_purchase_orders DROP CONSTRAINT IF EXISTS %I CASCADE', rec.conname);
    RAISE NOTICE 'Dropped constraint: %', rec.conname;
  END LOOP;
END $$;

-- Step 3: Verify all supplier constraints are gone
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'chick_purchase_orders'::regclass
  AND conname LIKE '%supplier%'
  AND contype = 'f';

-- Step 4: Add correct FK pointing to chick_suppliers
ALTER TABLE chick_purchase_orders
  ADD CONSTRAINT chick_purchase_orders_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES chick_suppliers(id);

-- Step 5: Verify it's correct
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'chick_purchase_orders'::regclass
  AND conname LIKE '%supplier%';

-- Step 6: Force PostgREST schema cache refresh
-- Method 1: reload notification
NOTIFY pgrst, 'reload schema';

-- Method 2: dummy schema change (forces cache invalidation)
ALTER TABLE chick_purchase_orders ADD COLUMN IF NOT EXISTS _schema_refresh_trigger INT;
ALTER TABLE chick_purchase_orders DROP COLUMN IF EXISTS _schema_refresh_trigger;

-- Step 7: Add any missing suppliers from old table into chick_suppliers
-- (this ensures PO creation works even if old IDs are still cached in frontend)
INSERT INTO chick_suppliers (id, name, contact_name, contact_phone, is_active)
SELECT s.id, s.name, NULL, NULL, true
FROM suppliers s
WHERE s.id NOT IN (SELECT id FROM chick_suppliers)
ON CONFLICT DO NOTHING;

-- Step 8: Show current chick_suppliers
SELECT id, name FROM chick_suppliers ORDER BY name;
