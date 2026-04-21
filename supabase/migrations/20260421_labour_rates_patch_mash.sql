-- Patch: fix labour rate seeding gaps (Broiler Finisher/Starter/Layer MASH variants)
-- and any other products that fell to $5.00 default. Safe to run multiple times.

-- Broiler Starter/Finisher/Layer/Dairy Mash and others that were missed
WITH rates AS (
  SELECT f.id AS formulation_id, CASE
    -- Broiler Finisher Mash (BFM) → same as finisher pellets: $2.10
    WHEN f.sage_code LIKE 'BFM%' OR f.name ILIKE '%broiler finisher mash%' THEN 2.10
    -- Broiler Starter Mash (BSM) → $2.85
    WHEN f.sage_code LIKE 'BSM%' OR f.name ILIKE '%broiler starter mash%' THEN 2.85
    -- Broiler Grower Mash (BGM) → $2.40
    WHEN f.sage_code LIKE 'BGM%' OR f.name ILIKE '%broiler grower mash%' THEN 2.40
    -- Layer Starter / Developer / Production Mash variants that didn't hit prefix rules
    WHEN f.name ILIKE '%layer starter mash%' OR f.name ILIKE '%layer developer mash%' OR f.name ILIKE '%layer production mash%' OR f.name ILIKE '%layer in production mash%' THEN 1.90
    -- Fat Fat (Dog Chunks) → $2.80
    WHEN f.name ILIKE '%fat fat%' THEN 2.80
    -- Dog Milling → $6.75
    WHEN f.name ILIKE '%dog milling%' THEN 6.75
    -- Explicit sage_code fixes from old labour map
    WHEN f.sage_code IN ('LAC50','LPMC50','BGC50') THEN 18.00
    -- Goat / Horse / Lucerne short codes
    WHEN f.sage_code LIKE 'GOA%' OR f.sage_code LIKE 'HOR%' THEN 7.50
    ELSE NULL
  END AS rate
  FROM formulations f
)
INSERT INTO labour_rates (formulation_id, rate_per_tonne_usd, effective_date, notes)
SELECT formulation_id, rate, CURRENT_DATE, 'Patched from rate sheet (mash/blocks/dog milling)'
FROM rates
WHERE rate IS NOT NULL
ON CONFLICT (formulation_id, effective_date) DO UPDATE
  SET rate_per_tonne_usd = EXCLUDED.rate_per_tonne_usd,
      notes = EXCLUDED.notes;
