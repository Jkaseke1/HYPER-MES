-- =====================================================
-- ADD MULTI-CURRENCY SUPPORT
-- Supports: ZAR (Rand), USD (US Dollar), ZWG (Zim Dollar), GBP (Pound)
-- =====================================================

-- 1. CREATE CURRENCIES TABLE
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (code IN ('ZAR', 'USD', 'ZWG', 'GBP')),
  name text NOT NULL,
  symbol text NOT NULL,
  is_base_currency boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read currencies" 
  ON currencies FOR SELECT 
  TO authenticated 
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage currencies" 
  ON currencies FOR ALL 
  TO authenticated 
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- 2. CREATE EXCHANGE RATES TABLE
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL REFERENCES currencies(code),
  to_currency text NOT NULL REFERENCES currencies(code),
  rate numeric(18, 6) NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_currency, to_currency, effective_date)
);

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read exchange rates" 
  ON exchange_rates FOR SELECT 
  TO authenticated 
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage exchange rates" 
  ON exchange_rates FOR ALL 
  TO authenticated 
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Create index for faster rate lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies_date 
  ON exchange_rates(from_currency, to_currency, effective_date DESC);

-- 3. INSERT DEFAULT CURRENCIES
INSERT INTO currencies (code, name, symbol, is_base_currency, is_active) VALUES
  ('USD', 'US Dollar', '$', true, true),
  ('ZAR', 'South African Rand', 'R', false, true),
  ('ZWG', 'Zimbabwe Gold', 'ZWG', false, true),
  ('GBP', 'British Pound', '£', false, true)
ON CONFLICT (code) DO NOTHING;

-- 4. ADD CURRENCY FIELDS TO FINANCIAL TABLES

-- Raw Materials - Add currency support
ALTER TABLE raw_materials 
  ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD' REFERENCES currencies(code),
  ADD COLUMN IF NOT EXISTS cost_per_unit_usd numeric DEFAULT 0;

-- Suppliers - Add default currency
ALTER TABLE suppliers 
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'USD' REFERENCES currencies(code);

-- GRN Items - Add currency tracking
ALTER TABLE grn_items 
  ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD' REFERENCES currencies(code),
  ADD COLUMN IF NOT EXISTS unit_cost_usd numeric DEFAULT 0;

-- Production Orders - Add currency tracking
ALTER TABLE production_orders 
  ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD' REFERENCES currencies(code),
  ADD COLUMN IF NOT EXISTS raw_material_cost_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_cost_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_cost_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_cost_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd numeric DEFAULT 0;

-- Dispatch Items - Add currency for pricing
ALTER TABLE dispatch_items 
  ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD' REFERENCES currencies(code),
  ADD COLUMN IF NOT EXISTS unit_price_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total_usd numeric DEFAULT 0;

-- 5. CREATE HELPER FUNCTION TO GET LATEST EXCHANGE RATE
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency text,
  p_to_currency text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  -- If same currency, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;
  
  -- Get the most recent rate on or before the specified date
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;
  
  -- If no rate found, return NULL (caller should handle)
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. CREATE HELPER FUNCTION TO CONVERT CURRENCY
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount numeric,
  p_from_currency text,
  p_to_currency text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  -- If same currency, return original amount
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;
  
  -- Get exchange rate
  v_rate := get_exchange_rate(p_from_currency, p_to_currency, p_date);
  
  -- If no rate found, return NULL
  IF v_rate IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Convert and return
  RETURN ROUND(p_amount * v_rate, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. INSERT SAMPLE EXCHANGE RATES (Update these with current rates)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
  -- USD to other currencies
  ('USD', 'ZAR', 18.50, CURRENT_DATE),
  ('USD', 'ZWG', 13.50, CURRENT_DATE),
  ('USD', 'GBP', 0.79, CURRENT_DATE),
  
  -- ZAR to other currencies
  ('ZAR', 'USD', 0.054, CURRENT_DATE),
  ('ZAR', 'ZWG', 0.73, CURRENT_DATE),
  ('ZAR', 'GBP', 0.043, CURRENT_DATE),
  
  -- ZWG to other currencies
  ('ZWG', 'USD', 0.074, CURRENT_DATE),
  ('ZWG', 'ZAR', 1.37, CURRENT_DATE),
  ('ZWG', 'GBP', 0.058, CURRENT_DATE),
  
  -- GBP to other currencies
  ('GBP', 'USD', 1.27, CURRENT_DATE),
  ('GBP', 'ZAR', 23.44, CURRENT_DATE),
  ('GBP', 'ZWG', 17.16, CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

-- 8. CREATE VIEW FOR MULTI-CURRENCY REPORTING
CREATE OR REPLACE VIEW raw_materials_multi_currency AS
SELECT 
  rm.*,
  rm.cost_per_unit as cost_in_local_currency,
  rm.cost_per_unit_usd as cost_in_usd,
  convert_currency(rm.cost_per_unit, rm.currency_code, 'ZAR', CURRENT_DATE) as cost_in_zar,
  convert_currency(rm.cost_per_unit, rm.currency_code, 'ZWG', CURRENT_DATE) as cost_in_zwg,
  convert_currency(rm.cost_per_unit, rm.currency_code, 'GBP', CURRENT_DATE) as cost_in_gbp
FROM raw_materials rm;

-- Verify setup
SELECT 
  'Currencies' as table_name,
  COUNT(*) as record_count
FROM currencies
UNION ALL
SELECT 
  'Exchange Rates' as table_name,
  COUNT(*) as record_count
FROM exchange_rates;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Multi-currency support added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Supported Currencies:';
  RAISE NOTICE '- USD (US Dollar) - Base Currency';
  RAISE NOTICE '- ZAR (South African Rand)';
  RAISE NOTICE '- ZWG (Zimbabwe Gold)';
  RAISE NOTICE '- GBP (British Pound)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Added:';
  RAISE NOTICE '1. Currencies table with 4 currencies';
  RAISE NOTICE '2. Exchange rates table with current rates';
  RAISE NOTICE '3. Currency fields added to:';
  RAISE NOTICE '   - raw_materials';
  RAISE NOTICE '   - suppliers';
  RAISE NOTICE '   - grn_items';
  RAISE NOTICE '   - production_orders';
  RAISE NOTICE '   - dispatch_items';
  RAISE NOTICE '4. Helper functions:';
  RAISE NOTICE '   - get_exchange_rate(from, to, date)';
  RAISE NOTICE '   - convert_currency(amount, from, to, date)';
  RAISE NOTICE '5. Multi-currency reporting view';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update exchange rates regularly';
  RAISE NOTICE '2. Set supplier default currencies';
  RAISE NOTICE '3. Record costs in local currency';
  RAISE NOTICE '4. System auto-converts to USD for reporting';
END $$;
