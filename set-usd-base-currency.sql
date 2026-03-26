-- =====================================================
-- SET USD AS BASE CURRENCY
-- Changes base currency from ZAR to USD
-- =====================================================

-- Update currencies table to set USD as base currency
UPDATE currencies 
SET is_base_currency = false 
WHERE code != 'USD';

UPDATE currencies 
SET is_base_currency = true 
WHERE code = 'USD';

-- Update exchange rates to use USD as base
-- Current rates should be inverted if they were ZAR-based
-- Example: If ZAR to USD was 0.054, now USD to ZAR should be 18.5

-- Clear existing rates and set new USD-based rates
DELETE FROM exchange_rates;

-- Insert USD-based exchange rates (March 2026 approximate rates)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
-- USD to other currencies
('USD', 'ZAR', 18.50, CURRENT_DATE),  -- 1 USD = 18.50 ZAR
('USD', 'ZWG', 13.50, CURRENT_DATE),  -- 1 USD = 13.50 ZWG
('USD', 'GBP', 0.79, CURRENT_DATE),   -- 1 USD = 0.79 GBP

-- Other currencies to USD (inverse rates)
('ZAR', 'USD', 0.054, CURRENT_DATE),  -- 1 ZAR = 0.054 USD
('ZWG', 'USD', 0.074, CURRENT_DATE),  -- 1 ZWG = 0.074 USD
('GBP', 'USD', 1.27, CURRENT_DATE),   -- 1 GBP = 1.27 USD

-- Cross rates (optional, for direct conversion)
('ZAR', 'ZWG', 0.73, CURRENT_DATE),
('ZWG', 'ZAR', 1.37, CURRENT_DATE),
('ZAR', 'GBP', 0.043, CURRENT_DATE),
('GBP', 'ZAR', 23.42, CURRENT_DATE),
('ZWG', 'GBP', 0.059, CURRENT_DATE),
('GBP', 'ZWG', 17.09, CURRENT_DATE);

-- Verify base currency is set correctly
SELECT code, name, symbol, is_base_currency 
FROM currencies 
ORDER BY is_base_currency DESC, code;

-- Verify exchange rates
SELECT from_currency, to_currency, rate, effective_date 
FROM exchange_rates 
WHERE from_currency = 'USD' OR to_currency = 'USD'
ORDER BY from_currency, to_currency;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
-- 1. USD is now the base currency for all conversions
-- 2. All cost_per_unit_usd columns will store values in USD
-- 3. When entering costs in other currencies, they will be
--    automatically converted to USD using these rates
-- 4. Exchange rates can be updated regularly via the UI
-- 5. Historical rates are preserved with effective_date
-- =====================================================
