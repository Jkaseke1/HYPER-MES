-- Adds bag size/count tracking to packaging production and finished goods reconciliation tables
ALTER TABLE IF EXISTS recon_production
  ADD COLUMN IF NOT EXISTS bag_size_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physical_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bag_variance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bag_variance_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS recon_finished_goods
  ADD COLUMN IF NOT EXISTS bag_size_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatched_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physical_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_bags numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bag_variance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bag_variance_pct numeric NOT NULL DEFAULT 0;