-- Add chick bookings and other missing entities to pending_approvals view

DROP VIEW IF EXISTS pending_approvals;

CREATE VIEW pending_approvals AS
-- Sales Orders
SELECT 
  'sales_order' as entity_type,
  id as entity_id,
  order_number as entity_number,
  customer_name as entity_name,
  status,
  created_at,
  created_by,
  branch_id
FROM sales_orders
WHERE status = 'pending'

UNION ALL

-- GRN
SELECT 
  'grn' as entity_type,
  id as entity_id,
  grn_number as entity_number,
  COALESCE((SELECT name FROM suppliers WHERE id = supplier_id), 'Unknown') as entity_name,
  status,
  created_at,
  received_by as created_by,
  branch_id
FROM goods_received_notes
WHERE status = 'pending'

UNION ALL

-- Quality Inspections
SELECT 
  'quality_inspection' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  batch_number as entity_name,
  result as status,
  created_at,
  NULL as created_by,
  NULL as branch_id
FROM quality_inspections
WHERE result = 'pending'

UNION ALL

-- Production Orders
SELECT 
  'production_order' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  batch_number as entity_name,
  status,
  created_at,
  operator_id as created_by,
  NULL as branch_id
FROM production_orders
WHERE status = 'pending'

UNION ALL

-- Dispatch Orders
SELECT 
  'dispatch_order' as entity_type,
  id as entity_id,
  dispatch_number as entity_number,
  dispatch_number as entity_name,
  status,
  created_at,
  prepared_by as created_by,
  branch_id
FROM dispatch_orders
WHERE status = 'pending'

UNION ALL

-- Chick Purchase Orders (Finance Verification)
SELECT 
  'chick_booking' as entity_type,
  id as entity_id,
  po_number as entity_number,
  supplier_name as entity_name,
  'pending_finance' as status,
  created_at,
  created_by,
  NULL as branch_id
FROM chick_purchase_orders
WHERE status = 'draft'

UNION ALL

-- Chick Purchase Orders (MD Approval)
SELECT 
  'chick_booking' as entity_type,
  id as entity_id,
  po_number as entity_number,
  supplier_name as entity_name,
  'pending_md' as status,
  created_at,
  created_by,
  NULL as branch_id
FROM chick_purchase_orders
WHERE status = 'finance_verified'

UNION ALL

-- Chick Purchase Orders (Payment)
SELECT 
  'chick_booking' as entity_type,
  id as entity_id,
  po_number as entity_number,
  supplier_name as entity_name,
  'pending_payment' as status,
  created_at,
  created_by,
  NULL as branch_id
FROM chick_purchase_orders
WHERE status = 'md_approved'

UNION ALL

-- Macropack Orders
SELECT 
  'macropack_order' as entity_type,
  id as entity_id,
  order_number as entity_number,
  order_number as entity_name,
  status,
  created_at,
  COALESCE(created_by, NULL) as created_by,
  NULL as branch_id
FROM macropack_orders
WHERE status = 'pending'

UNION ALL

-- Reconciliation Periods
SELECT 
  'reconciliation_period' as entity_type,
  id as entity_id,
  period_name as entity_number,
  period_name as entity_name,
  status,
  created_at,
  created_by,
  NULL as branch_id
FROM reconciliation_periods
WHERE status = 'pending'

UNION ALL

-- Material Transfers
SELECT 
  'material_transfer' as entity_type,
  id as entity_id,
  transfer_number as entity_number,
  transfer_number as entity_name,
  status,
  created_at,
  created_by,
  NULL as branch_id
FROM material_transfers
WHERE status = 'pending'

UNION ALL

-- Work Orders (Maintenance)
SELECT 
  'work_order' as entity_type,
  id as entity_id,
  work_order_number as entity_number,
  description as entity_name,
  status,
  created_at,
  created_by,
  NULL as branch_id
FROM maintenance_work_orders
WHERE status = 'pending';
