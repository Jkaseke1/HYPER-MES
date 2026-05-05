-- Temporary Worker Payroll System
-- Manages casual/temporary production workers and their payments via Ecocash

-- 1. temporary_workers table
CREATE TABLE IF NOT EXISTS temporary_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL, -- Ecocash number
  national_id text,
  department text CHECK (department IN ('Production', 'Packing', 'Warehouse', 'Maintenance', 'Cleaning', 'General')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  hire_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. payroll_periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_number text UNIQUE NOT NULL, -- e.g., "2026-W18" for week 18
  period_type text DEFAULT 'weekly' CHECK (period_type IN ('daily', 'weekly', 'biweekly', 'monthly')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'calculating', 'review', 'approved', 'paid', 'closed')),
  total_workers integer DEFAULT 0,
  total_hours numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  paid_by uuid REFERENCES profiles(id),
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. worker_attendance table (daily clock in/out)
CREATE TABLE IF NOT EXISTS worker_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES temporary_workers(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  hours_worked numeric,
  overtime_hours numeric DEFAULT 0,
  department text,
  supervisor_id uuid REFERENCES profiles(id),
  production_order_id uuid REFERENCES production_orders(id), -- Link to specific batch
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, work_date)
);

-- 4. payroll_lines table (individual worker payments per period)
CREATE TABLE IF NOT EXISTS payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid REFERENCES payroll_periods(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES temporary_workers(id) ON DELETE CASCADE,
  total_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 2.50, -- USD per hour
  overtime_rate numeric DEFAULT 3.75, -- 1.5x regular rate
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions numeric DEFAULT 0, -- Advances, loans, etc.
  net_amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'ecocash' CHECK (payment_method IN ('ecocash', 'cash', 'bank_transfer')),
  ecocash_number text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  ecocash_transaction_id text,
  payment_date timestamptz,
  payment_error text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(payroll_period_id, worker_id)
);

-- 5. worker_advances table (loans/advances to be deducted)
CREATE TABLE IF NOT EXISTS worker_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES temporary_workers(id) ON DELETE CASCADE,
  advance_date date DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  reason text,
  approved_by uuid REFERENCES profiles(id),
  deducted_amount numeric DEFAULT 0,
  balance numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'deducting', 'paid_off', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. ecocash_payment_batches table (bulk payment tracking)
CREATE TABLE IF NOT EXISTS ecocash_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid REFERENCES payroll_periods(id),
  batch_number text UNIQUE NOT NULL,
  total_payments integer DEFAULT 0,
  total_amount numeric DEFAULT 0,
  successful_payments integer DEFAULT 0,
  failed_payments integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  initiated_by uuid REFERENCES profiles(id),
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  ecocash_batch_id text, -- External batch ID from Ecocash
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. payroll_audit_log table
CREATE TABLE IF NOT EXISTS payroll_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid REFERENCES payroll_periods(id),
  worker_id uuid REFERENCES temporary_workers(id),
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_temp_workers_status ON temporary_workers(status);
CREATE INDEX IF NOT EXISTS idx_temp_workers_phone ON temporary_workers(phone_number);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_worker_attendance_date ON worker_attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker ON worker_attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_period ON payroll_lines(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_worker ON payroll_lines(worker_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_status ON payroll_lines(payment_status);
CREATE INDEX IF NOT EXISTS idx_worker_advances_worker ON worker_advances(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_advances_status ON worker_advances(status);

-- RLS Policies
ALTER TABLE temporary_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecocash_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Enable read access for authenticated users on temporary_workers"
  ON temporary_workers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on payroll_periods"
  ON payroll_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on worker_attendance"
  ON worker_attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on payroll_lines"
  ON payroll_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on worker_advances"
  ON worker_advances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on ecocash_payment_batches"
  ON ecocash_payment_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for authenticated users on payroll_audit_log"
  ON payroll_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Allow all operations for authenticated users (will be restricted by app logic)
CREATE POLICY "Enable all operations for authenticated users on temporary_workers"
  ON temporary_workers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on payroll_periods"
  ON payroll_periods FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on worker_attendance"
  ON worker_attendance FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on payroll_lines"
  ON payroll_lines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on worker_advances"
  ON worker_advances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on ecocash_payment_batches"
  ON ecocash_payment_batches FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users on payroll_audit_log"
  ON payroll_audit_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE temporary_workers IS 'Casual/temporary production workers';
COMMENT ON TABLE payroll_periods IS 'Payroll periods (weekly/monthly cycles)';
COMMENT ON TABLE worker_attendance IS 'Daily worker clock in/out records';
COMMENT ON TABLE payroll_lines IS 'Individual worker payments per payroll period';
COMMENT ON TABLE worker_advances IS 'Advances/loans given to workers';
COMMENT ON TABLE ecocash_payment_batches IS 'Bulk Ecocash payment batches';
COMMENT ON TABLE payroll_audit_log IS 'Audit trail for payroll changes';
