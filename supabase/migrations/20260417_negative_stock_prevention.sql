-- Negative Stock Prevention & Exception Logging

CREATE TABLE IF NOT EXISTS stock_exceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL,
  material_name TEXT NOT NULL,
  available_qty NUMERIC(14,4),
  requested_qty NUMERIC(14,4),
  shortfall_qty NUMERIC(14,4),
  override_reason TEXT,
  overridden_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE stock_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Auth read stock_exceptions"
ON stock_exceptions
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Auth insert stock_exceptions"
ON stock_exceptions
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Index for lookups
CREATE INDEX idx_stock_exceptions_transaction_type ON stock_exceptions(transaction_type);
CREATE INDEX idx_stock_exceptions_created_at ON stock_exceptions(created_at);
CREATE INDEX idx_stock_exceptions_overridden_by ON stock_exceptions(overridden_by);
