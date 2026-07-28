-- Migration: Add driver info, hired trucks, physical D-Note, branch confirmation, and accounts approval fields to dispatch_orders

ALTER TABLE dispatch_orders 
  ADD COLUMN IF NOT EXISTS dispatch_type text DEFAULT 'branch_transfer' CHECK (dispatch_type IN ('branch_transfer', 'customer_direct')),
  ADD COLUMN IF NOT EXISTS customer_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS physical_dnote_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hfdn_reference text DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS vat_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_hired_truck boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transporter_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS driver_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS trailer_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS branch_confirmed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS branch_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS branch_confirmation_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS branch_confirmation_status text DEFAULT 'pending' CHECK (branch_confirmation_status IN ('pending', 'confirmed', 'rejected')),
  ADD COLUMN IF NOT EXISTS accounts_approved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS accounts_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounts_approval_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS accounts_posting_status text DEFAULT 'pending' CHECK (accounts_posting_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN dispatch_orders.dispatch_type IS 'branch_transfer for IBT transfers, customer_direct for direct sales';
COMMENT ON COLUMN dispatch_orders.physical_dnote_number IS 'Serial number from physical D-Note book (e.g. 35877)';
COMMENT ON COLUMN dispatch_orders.hfdn_reference IS 'HFDN reference number (e.g. HFDN 16+0947.5)';
COMMENT ON COLUMN dispatch_orders.is_hired_truck IS 'Flag indicating whether third party hired truck was used';
COMMENT ON COLUMN dispatch_orders.branch_confirmation_status IS 'Delivery confirmation status from receiving branch';
COMMENT ON COLUMN dispatch_orders.accounts_posting_status IS 'Accounts posting approval status for Sage/Financial posting';
