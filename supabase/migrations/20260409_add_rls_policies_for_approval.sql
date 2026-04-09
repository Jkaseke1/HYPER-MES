-- Add RLS policies to allow authenticated users to update stock_movements for approval

-- Enable RLS on stock_movements if not already enabled
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Authenticated users can insert stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Authenticated users can update stock_movements" ON stock_movements;

-- Policy: Allow authenticated users to read stock_movements
CREATE POLICY "Authenticated users can read stock_movements"
  ON stock_movements
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to insert stock_movements
CREATE POLICY "Authenticated users can insert stock_movements"
  ON stock_movements
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to update stock_movements (for approval)
CREATE POLICY "Authenticated users can update stock_movements"
  ON stock_movements
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Also enable RLS on approval_history and add policies
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read approval_history" ON approval_history;
DROP POLICY IF EXISTS "Authenticated users can insert approval_history" ON approval_history;

-- Policy: Allow authenticated users to read approval_history
CREATE POLICY "Authenticated users can read approval_history"
  ON approval_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to insert approval_history
CREATE POLICY "Authenticated users can insert approval_history"
  ON approval_history
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
