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
  NULL as branch_id
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
  id::text as entity_number,
  id::text as entity_name,
  status,
  created_at,
  submitted_by as created_by,
  NULL as branch_id
FROM macropack_manufacture_orders
WHERE status IN ('PENDING_RM', 'PENDING_SUPERVISOR')

UNION ALL

-- Reconciliation Periods
SELECT 
  'reconciliation_period' as entity_type,
  id as entity_id,
  year::text || '-' || LPAD(month::text, 2, '0') as entity_number,
  TO_CHAR(TO_DATE(month::text || '-' || year::text, 'MM-YYYY'), 'Mon YYYY') as entity_name,
  status,
  created_at,
  created_by,
  branch_id
FROM reconciliation_periods
WHERE status = 'draft'

UNION ALL

-- Material Transfers
SELECT 
  'material_transfer' as entity_type,
  id as entity_id,
  transfer_number as entity_number,
  COALESCE((SELECT name FROM raw_materials WHERE id = raw_material_id), 'Unknown') as entity_name,
  status,
  created_at,
  requested_by as created_by,
  NULL as branch_id
FROM material_transfers
WHERE status = 'pending'

UNION ALL

-- Weigh Bridge Tickets
SELECT 
  'weigh_bridge_ticket' as entity_type,
  id as entity_id,
  ticket_no as entity_number,
  COALESCE(vehicle_reg, ticket_no) as entity_name,
  'pending_link' as status,
  created_at,
  created_by,
  NULL as branch_id
FROM weigh_bridge_tickets
WHERE status = 'open'

UNION ALL

-- Work Orders (Maintenance)
SELECT 
  'work_order' as entity_type,
  id as entity_id,
  wo_number as entity_number,
  title as entity_name,
  status,
  created_at,
  reported_by as created_by,
  branch_id
FROM maintenance_work_orders
WHERE status = 'open';
