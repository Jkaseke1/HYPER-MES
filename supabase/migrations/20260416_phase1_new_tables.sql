-- HYPER-MES Phase 1 — New Database Tables
-- Tables only, no UI

-- 1. USD/ZIG Rate History
CREATE TABLE IF NOT EXISTS usd_zig_rate_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  effective_date DATE UNIQUE NOT NULL,
  rate NUMERIC(10,4) NOT NULL,
  set_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Variance Reason Codes
CREATE TABLE IF NOT EXISTS variance_reason_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT
);

-- 3. RM Cost Register
CREATE TABLE IF NOT EXISTS rm_cost_register (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID REFERENCES raw_materials(id),
  effective_date DATE NOT NULL,
  cost_per_tonne_usd NUMERIC(12,4) NOT NULL,
  source TEXT CHECK (source IN ('GRN','MANUAL','SAGE_SYNC')),
  grn_id UUID,
  usd_zig_rate NUMERIC(10,4),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Packaging SKUs
CREATE TABLE IF NOT EXISTS packaging_skus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  bag_size_kg NUMERIC(6,2),
  is_active BOOLEAN DEFAULT TRUE,
  sage_stock_code TEXT
);

-- 5. Period Production Summary
CREATE TABLE IF NOT EXISTS period_production_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start DATE,
  period_end DATE,
  product_id UUID,
  formulation_version TEXT,
  tonnes_produced NUMERIC(14,4),
  rm_cost_per_mt_usd NUMERIC(12,4),
  sell_price_per_mt_usd NUMERIC(12,4),
  margin_per_mt_usd NUMERIC(12,4),
  total_margin_usd NUMERIC(14,4),
  margin_pct NUMERIC(8,4),
  usd_zig_rate NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE usd_zig_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rm_cost_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_production_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can read all
CREATE POLICY "Authenticated users can read usd_zig_rate_history" ON usd_zig_rate_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert usd_zig_rate_history" ON usd_zig_rate_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update usd_zig_rate_history" ON usd_zig_rate_history FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read variance_reason_codes" ON variance_reason_codes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert variance_reason_codes" ON variance_reason_codes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update variance_reason_codes" ON variance_reason_codes FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read rm_cost_register" ON rm_cost_register FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert rm_cost_register" ON rm_cost_register FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update rm_cost_register" ON rm_cost_register FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read packaging_skus" ON packaging_skus FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert packaging_skus" ON packaging_skus FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update packaging_skus" ON packaging_skus FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read period_production_summary" ON period_production_summary FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert period_production_summary" ON period_production_summary FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update period_production_summary" ON period_production_summary FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rm_cost_register_material ON rm_cost_register(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_rm_cost_register_date ON rm_cost_register(effective_date);
CREATE INDEX IF NOT EXISTS idx_period_production_summary_dates ON period_production_summary(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usd_zig_rate_history_date ON usd_zig_rate_history(effective_date);

-- Seed: Variance Reason Codes
INSERT INTO variance_reason_codes (code, description, category) VALUES
  ('SUPPLIER_PROMO_ADDITION', 'Supplier promotional addition', 'Supplier'),
  ('WEIGHING_ERROR', 'Weighing error', 'Measurement'),
  ('CROSS_CONTAMINATION_WITH_SIMILAR_RM', 'Cross-contamination with similar raw material', 'Production'),
  ('PRODUCTION_FLOOR_CARRYOVER', 'Production floor carryover', 'Production'),
  ('SYSTEM_ENTRY_ERROR', 'System entry error', 'Admin'),
  ('UNRECORDED_PRODUCTION', 'Unrecorded production', 'Production'),
  ('PACKAGING_NOT_DECLARED', 'Packaging not declared', 'Packaging'),
  ('SCALE_CALIBRATION', 'Scale calibration issue', 'Measurement'),
  ('MISSING_PRODUCTION_NOTICE', 'Missing production notice', 'Production'),
  ('MACROPACK_INGREDIENT_SUBSTITUTION', 'Macropack ingredient substitution', 'Formulation'),
  ('LIMESTONE_DIRECT_TO_PLANT', 'Limestone direct to plant', 'Production')
ON CONFLICT (code) DO NOTHING;

-- Seed: USD/ZIG Rate History (February 2026)
INSERT INTO usd_zig_rate_history (effective_date, rate) VALUES
  ('2026-02-01', 50.0000)
ON CONFLICT (effective_date) DO NOTHING;
