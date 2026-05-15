-- Chick Bookings / Purchase Orders Module
-- Tracks purchase of chicks with multi-step approval and batch delivery tracking

-- Chick Purchase Orders
CREATE TABLE IF NOT EXISTS chick_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text, -- denormalized for display
  ordered_qty numeric NOT NULL DEFAULT 0,
  delivered_qty numeric DEFAULT 0,
  remaining_qty numeric GENERATED ALWAYS AS (ordered_qty - delivered_qty) STORED,
  unit_price numeric DEFAULT 0,
  total_value numeric GENERATED ALWAYS AS (ordered_qty * unit_price) STORED,
  currency text DEFAULT 'USD',
  
  -- Approval workflow
  status text DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Created by purchase admin
    'finance_verified',   -- Finance Owen verified
    'md_approved',        -- MD approved
    'paid',               -- Payment made
    'partially_delivered', -- Some batches received
    'fully_delivered',    -- All chicks received
    'closed',             -- Invoice matched, PO closed
    'rejected'            -- Rejected at any step
  )),
  
  -- Finance verification
  finance_verified_by uuid REFERENCES profiles(id),
  finance_verified_at timestamptz,
  finance_notes text,
  
  -- MD approval
  md_approved_by uuid REFERENCES profiles(id),
  md_approved_at timestamptz,
  md_notes text,
  
  -- Payment
  payment_date timestamptz,
  payment_reference text,
  payment_amount numeric DEFAULT 0,
  payment_method text DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'ecocash', 'other')),
  
  -- Invoice from supplier
  invoice_received boolean DEFAULT false,
  invoice_number text,
  invoice_date timestamptz,
  invoice_amount numeric DEFAULT 0,
  
  -- Delivery tracking
  expected_delivery_date timestamptz,
  delivery_instructions text DEFAULT '',
  
  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chick Deliveries (batch receipts)
CREATE TABLE IF NOT EXISTS chick_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES chick_purchase_orders(id) ON DELETE CASCADE,
  delivery_number text,
  delivery_date timestamptz DEFAULT now(),
  qty_received numeric NOT NULL DEFAULT 0,
  qty_rejected numeric DEFAULT 0, -- dead on arrival, etc.
  qty_accepted numeric GENERATED ALWAYS AS (qty_received - qty_rejected) STORED,
  batch_notes text DEFAULT '',
  received_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE chick_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chick_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chick_purchase_orders"
  ON chick_purchase_orders FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert chick_purchase_orders"
  ON chick_purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update chick_purchase_orders"
  ON chick_purchase_orders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read chick_deliveries"
  ON chick_deliveries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert chick_deliveries"
  ON chick_deliveries FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update chick_deliveries"
  ON chick_deliveries FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chick_po_status ON chick_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_chick_po_supplier ON chick_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_chick_po_created ON chick_purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_chick_deliveries_po ON chick_deliveries(po_id);

-- Trigger to auto-update delivered_qty on chick_purchase_orders
CREATE OR REPLACE FUNCTION update_chick_po_delivered_qty()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chick_purchase_orders
  SET delivered_qty = (
    SELECT COALESCE(SUM(qty_accepted), 0)
    FROM chick_deliveries
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
  ),
  status = CASE
    WHEN (
      SELECT COALESCE(SUM(qty_accepted), 0)
      FROM chick_deliveries
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    ) >= ordered_qty THEN 'fully_delivered'
    WHEN (
      SELECT COALESCE(SUM(qty_accepted), 0)
      FROM chick_deliveries
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    ) > 0 THEN 'partially_delivered'
    ELSE status
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id)
    AND status NOT IN ('draft', 'finance_verified', 'md_approved', 'paid', 'rejected');
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_chick_po_qty ON chick_deliveries;
CREATE TRIGGER trg_update_chick_po_qty
AFTER INSERT OR UPDATE OR DELETE ON chick_deliveries
FOR EACH ROW
EXECUTE FUNCTION update_chick_po_delivered_qty();
