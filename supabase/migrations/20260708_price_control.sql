-- Price Control for Finished Goods
-- This adds price approval workflow between batch completion and dispatch

-- Price approvals table
CREATE TABLE IF NOT EXISTS price_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES production_orders(id) ON DELETE CASCADE,
  formulation_id UUID REFERENCES formulations(id),
  unit_price_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price_zig DECIMAL(10,2) NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE price_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view price approvals" ON price_approvals;
DROP POLICY IF EXISTS "Finance can create price approvals" ON price_approvals;
DROP POLICY IF EXISTS "Finance can update price approvals" ON price_approvals;

-- Allow authenticated users to read price approvals
CREATE POLICY "Authenticated users can view price approvals"
  ON price_approvals FOR SELECT
  TO authenticated
  USING (true);

-- Allow finance role to insert price approvals
CREATE POLICY "Finance can create price approvals"
  ON price_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'finance' OR profiles.role = 'admin')
    )
  );

-- Allow finance role to update price approvals
CREATE POLICY "Finance can update price approvals"
  ON price_approvals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'finance' OR profiles.role = 'admin')
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_price_approvals_updated_at ON price_approvals;

CREATE TRIGGER update_price_approvals_updated_at
  BEFORE UPDATE ON price_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add price approval status to production_orders (optional, for quick reference)
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS price_approval_status TEXT DEFAULT 'pending'
CHECK (price_approval_status IN ('pending', 'approved', 'rejected'));

-- Add foreign key to price_approvals if status is approved
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS price_approval_id UUID REFERENCES price_approvals(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_approvals_batch_id ON price_approvals(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_approvals_status ON price_approvals(status);
CREATE INDEX IF NOT EXISTS idx_price_approvals_formulation_id ON price_approvals(formulation_id);

-- View: Completed batches pending price approval
CREATE OR REPLACE VIEW completed_batches_pending_price_approval AS
SELECT
  pb.id,
  pb.batch_number,
  pb.formulation_id,
  f.name AS formulation_name,
  f.sage_code,
  pb.actual_qty,
  pb.actual_end AS completion_date,
  pb.price_approval_status,
  pa.id AS price_approval_id,
  pa.unit_price_usd,
  pa.unit_price_zig,
  pa.status AS approval_status,
  pa.approved_by,
  pa.approved_at,
  pa.notes,
  pb.cost_per_unit
FROM production_orders pb
JOIN formulations f ON pb.formulation_id = f.id
LEFT JOIN price_approvals pa ON pa.batch_id = pb.id
WHERE pb.status = 'completed'
AND (pb.price_approval_status = 'pending' OR pb.price_approval_status IS NULL)
ORDER BY pb.actual_end DESC;

-- Grant access to the view
GRANT SELECT ON completed_batches_pending_price_approval TO authenticated;
