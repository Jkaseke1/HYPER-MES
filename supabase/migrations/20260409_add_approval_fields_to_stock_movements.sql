-- Add approval workflow fields to stock_movements table for material transfers
-- This enables the approval system to work with material transfers

ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_transit', 'received', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_approved_by ON stock_movements(approved_by);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);

-- Add comment for documentation
COMMENT ON COLUMN stock_movements.status IS 'Current approval status: pending, approved, in_transit, received, or rejected';
COMMENT ON COLUMN stock_movements.approved_by IS 'User ID of the person who approved/rejected the transfer';
COMMENT ON COLUMN stock_movements.approved_at IS 'Timestamp when the transfer was approved or rejected';
COMMENT ON COLUMN stock_movements.rejection_reason IS 'Reason for rejection if the transfer was rejected';
