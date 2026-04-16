-- Monthly RM Reconciliation table
CREATE TABLE IF NOT EXISTS monthly_rm_reconciliation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  warehouse TEXT NOT NULL,
  material_type TEXT NOT NULL,
  material_id UUID,
  material_name TEXT NOT NULL,
  opening_stock_kg NUMERIC(14,4),
  receipts_kg NUMERIC(14,4),
  issues_kg NUMERIC(14,4),
  expected_closing_kg NUMERIC(14,4),
  physical_count_kg NUMERIC(14,4),
  system_stock_kg NUMERIC(14,4),
  variance_kg NUMERIC(14,4) GENERATED ALWAYS AS (physical_count_kg - system_stock_kg) STORED,
  variance_pct NUMERIC(8,4),
  variance_reason_code TEXT,
  variance_comment TEXT,
  reconciliation_status TEXT DEFAULT 'OPEN' CHECK (reconciliation_status IN ('OPEN','REVIEWED','APPROVED')),
  submitted_by UUID,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE monthly_rm_reconciliation ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read monthly_rm_reconciliation" ON monthly_rm_reconciliation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert monthly_rm_reconciliation" ON monthly_rm_reconciliation FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update monthly_rm_reconciliation" ON monthly_rm_reconciliation FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete monthly_rm_reconciliation" ON monthly_rm_reconciliation FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_rm_recon_period ON monthly_rm_reconciliation(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_monthly_rm_recon_material ON monthly_rm_reconciliation(material_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rm_recon_status ON monthly_rm_reconciliation(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_monthly_rm_recon_type ON monthly_rm_reconciliation(material_type);
