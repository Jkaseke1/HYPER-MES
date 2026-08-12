-- Management reporting schedules and read-only Sage transaction history.
-- A gateway executes schedules and imports Sage history; MES never reposts imported transactions.

CREATE TABLE IF NOT EXISTS management_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('executive_daily', 'production_oee', 'quality_holds', 'inventory_variance', 'sage_integration')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  delivery_time time NOT NULL DEFAULT '07:00',
  recipients text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS management_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES management_report_schedules(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'delivered', 'failed')),
  delivery_channel text NOT NULL DEFAULT 'gateway',
  recipient_count integer NOT NULL DEFAULT 0,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sage_imported_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sage_transaction_key text NOT NULL UNIQUE,
  sage_source_database text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('issue', 'receipt', 'transfer_out', 'transfer_in', 'adjustment', 'manufacture', 'dispatch', 'other')),
  transaction_date timestamptz NOT NULL,
  item_code text NOT NULL,
  item_description text,
  warehouse_code text,
  counter_warehouse_code text,
  quantity_in numeric NOT NULL DEFAULT 0,
  quantity_out numeric NOT NULL DEFAULT 0,
  unit_cost numeric,
  reference text,
  description text,
  source_document_type text,
  source_document_number text,
  mes_reference_type text,
  mes_reference_id uuid,
  import_status text NOT NULL DEFAULT 'imported' CHECK (import_status IN ('imported', 'linked', 'exception', 'ignored')),
  import_error text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_management_report_schedules_enabled ON management_report_schedules(enabled, frequency);
CREATE INDEX IF NOT EXISTS idx_management_report_runs_created ON management_report_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sage_imported_transactions_date ON sage_imported_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_sage_imported_transactions_item ON sage_imported_transactions(item_code, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_sage_imported_transactions_reference ON sage_imported_transactions(reference);

ALTER TABLE management_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_imported_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage management report schedules" ON management_report_schedules FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read management report runs" ON management_report_runs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read Sage imported transactions" ON sage_imported_transactions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE sage_imported_transactions IS 'Read-only mirrored Sage transaction history. Imported rows reconcile MES and Sage; they must never produce a second MES stock movement.';
COMMENT ON TABLE management_report_schedules IS 'Report configuration. A secure gateway executes delivery and records runs.';
