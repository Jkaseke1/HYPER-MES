-- Replace labour_rates (per machine_id, $/hour) with per-formulation ($/tonne).
-- This matches the official Hyperfeeds labour cost rate sheet which prices
-- labour PER TONNE of finished product (not per hour).

-- 1. Drop old per-machine table
DROP TABLE IF EXISTS labour_rates CASCADE;

-- 2. Per-formulation labour rate table
CREATE TABLE labour_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulation_id UUID NOT NULL REFERENCES formulations(id) ON DELETE CASCADE,
  rate_per_tonne_usd NUMERIC(10,4) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (formulation_id, effective_date)
);

CREATE INDEX idx_labour_rates_formulation ON labour_rates(formulation_id);

ALTER TABLE labour_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read labour_rates" ON labour_rates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert labour_rates" ON labour_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update labour_rates" ON labour_rates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete labour_rates" ON labour_rates FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Seed rates from the April 2026 rate sheet by sage_code / name pattern.
-- Run as a single statement that picks the first matching rule per formulation.
WITH rates AS (
  SELECT f.id AS formulation_id, CASE
    -- MAIN PLANT $2.85/t: Broiler Starter/Grower/Starter-Grower/Grower-Finisher Crumbs
    WHEN f.sage_code LIKE 'BSC%' OR f.sage_code LIKE 'BGF%' OR f.sage_code LIKE 'BSGC%' OR f.name ILIKE '%broiler%crumbs%' THEN 2.85
    -- MAIN PLANT $2.40/t: Broiler Grower Pellets
    WHEN f.sage_code LIKE 'BGP%' OR f.name ILIKE '%broiler grower pellet%' THEN 2.40
    -- MAIN PLANT $2.10/t: Broiler Finisher Pellets, Rabbit Pellets, Duck Pellets
    WHEN f.sage_code LIKE 'BFP%' OR f.name ILIKE '%broiler finisher pellet%' THEN 2.10
    WHEN f.sage_code LIKE 'RBP%' OR f.name ILIKE '%rabbit pellet%' THEN 2.10
    WHEN f.name ILIKE '%duck pellet%' THEN 2.10
    -- MAIN PLANT $1.90/t: Layer Mashes
    WHEN f.sage_code LIKE 'LSM%' OR f.sage_code LIKE 'LDM%' OR f.sage_code LIKE 'LPM%' OR f.name ILIKE '%layer%mash%' THEN 1.90
    -- MAIN PLANT $3.40/t: Dog Meal (distinct from Dog Chunks)
    WHEN f.sage_code LIKE 'DML%' OR f.name ILIKE '%dog meal%' THEN 3.40
    -- DOG CHUNKS LINE $3.50/t: HDC Big Plant
    WHEN f.sage_code LIKE 'HDC%' OR f.name ILIKE '%hyper dog chunk%' OR f.name ILIKE '%dog chunk%' THEN 3.50
    -- DOG CHUNKS LINE $7.10/t: New Dog Line
    WHEN f.name ILIKE '%new dog%' THEN 7.10
    -- BLOCKS PLANT $18.00/t: High Phos, Game Blocks, Winter Blocks, Licks
    WHEN f.sage_code LIKE 'BGC%' OR f.name ILIKE '%game block%' OR f.name ILIKE '%winter block%' OR f.name ILIKE '%high phos%' THEN 18.00
    WHEN f.sage_code LIKE 'LAC%' OR f.sage_code LIKE 'LPMC%' OR f.name ILIKE '%lick%' THEN 18.00
    -- RED PLANT $6.75/t: Concentrates
    WHEN f.name ILIKE '%concentrate%' THEN 6.75
    -- RED PLANT $2.60/t: Bran Milling; $2.10/t Maize Milling
    WHEN f.name ILIKE '%bran mill%' THEN 2.60
    WHEN f.name ILIKE '%maize mill%' THEN 2.10
    -- SAMURAI $7.60/t: Road Runner + Pig meals
    WHEN f.sage_code LIKE 'RR%' OR f.name ILIKE '%road runner%' THEN 7.60
    WHEN f.sage_code LIKE 'PIG%' OR f.sage_code LIKE 'PGF%' OR f.sage_code LIKE 'PGM%' OR f.sage_code LIKE 'PCM%' OR f.sage_code LIKE 'PDB%' OR f.sage_code LIKE 'PCW%' OR f.sage_code LIKE 'PGFC%' OR f.name ILIKE '%pig%' THEN 7.60
    -- SAMURAI $9.10/t: Bull Heifer, BFAM, BSUM, DCM, Calf Starter
    WHEN f.sage_code LIKE 'BFAM%' OR f.sage_code LIKE 'BSUM%' OR f.sage_code LIKE 'DCM%' OR f.name ILIKE '%bull heifer%' OR f.name ILIKE '%calf starter%' THEN 9.10
    -- SAMURAI $6.00/t: Dairy Meal, Calf Grower
    WHEN f.sage_code LIKE 'DAI%' OR f.name ILIKE '%dairy meal%' OR f.name ILIKE '%calf grower%' THEN 6.00
    -- SAMURAI $7.50/t: Goat Meal, Horse Meal
    WHEN f.name ILIKE '%goat meal%' OR f.name ILIKE '%horse meal%' THEN 7.50
    -- SAMURAI $3.85/t: Lucerne Milling
    WHEN f.name ILIKE '%lucerne%' THEN 3.85
    -- Default fallback
    ELSE 5.00
  END AS rate
  FROM formulations f
)
INSERT INTO labour_rates (formulation_id, rate_per_tonne_usd, effective_date, notes)
SELECT formulation_id, rate, CURRENT_DATE, 'Seeded from April 2026 rate sheet'
FROM rates
ON CONFLICT (formulation_id, effective_date) DO NOTHING;
