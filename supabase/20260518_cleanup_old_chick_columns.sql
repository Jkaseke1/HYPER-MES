-- Migration to clean up old chick_purchase_orders columns
-- Handles dependency on pending_approvals view

-- Step 1: Drop and recreate pending_approvals view to remove dependency on old columns
DROP VIEW IF EXISTS pending_approvals CASCADE;

-- Step 2: Recreate pending_approvals view using new chick schema
CREATE OR REPLACE VIEW pending_approvals AS
-- Chick Purchase Orders
SELECT 
  'chick_po' AS approval_type,
  cpo.id,
  cpo.po_number AS reference_number,
  s.name AS description,
  cpo.status,
  cpo.created_at,
  cpo.created_by,
  cpo.approved_by,
  cpo.approved_at
FROM chick_purchase_orders cpo
LEFT JOIN chick_suppliers s ON s.id = cpo.supplier_id
WHERE cpo.status IN ('SUBMITTED', 'DRAFT')

UNION ALL

-- Production Orders
SELECT 
  'production_order' AS approval_type,
  po.id,
  po.batch_number AS reference_number,
  f.name AS description,
  po.status,
  po.created_at,
  NULL::uuid AS created_by,
  po.approved_by,
  po.approved_at
FROM production_orders po
LEFT JOIN formulations f ON f.id = po.formulation_id
WHERE po.status = 'pending_approval'

ORDER BY created_at DESC;

-- Grant permissions
GRANT SELECT ON pending_approvals TO authenticated;

-- Step 3: Now we can safely drop the old columns
-- Drop computed/dependent columns first, then their dependencies
ALTER TABLE chick_purchase_orders 
DROP COLUMN IF EXISTS remaining_qty CASCADE,
DROP COLUMN IF EXISTS total_value CASCADE;

-- Now drop the rest of the old columns
ALTER TABLE chick_purchase_orders 
DROP COLUMN IF EXISTS supplier_name,
DROP COLUMN IF EXISTS ordered_qty,
DROP COLUMN IF EXISTS delivered_qty,
DROP COLUMN IF EXISTS unit_price,
DROP COLUMN IF EXISTS finance_verified_by,
DROP COLUMN IF EXISTS finance_verified_at,
DROP COLUMN IF EXISTS finance_notes,
DROP COLUMN IF EXISTS md_approved_by,
DROP COLUMN IF EXISTS md_approved_at,
DROP COLUMN IF EXISTS md_notes,
DROP COLUMN IF EXISTS payment_date,
DROP COLUMN IF EXISTS payment_reference,
DROP COLUMN IF EXISTS payment_amount,
DROP COLUMN IF EXISTS payment_method,
DROP COLUMN IF EXISTS invoice_received,
DROP COLUMN IF EXISTS invoice_number,
DROP COLUMN IF EXISTS invoice_date,
DROP COLUMN IF EXISTS invoice_amount,
DROP COLUMN IF EXISTS delivery_instructions;

-- Step 3: Add comment
COMMENT ON VIEW pending_approvals IS 'Unified view of all items requiring approval across the system';
