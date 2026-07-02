-- Add nominal (theoretical) production speed to formulations.
-- Used to measure production efficiency: actual throughput / nominal speed.
-- Values come from the Hyperfeeds rate sheet (tonnage per hour per product).

ALTER TABLE formulations ADD COLUMN IF NOT EXISTS nominal_speed NUMERIC(10,4) DEFAULT 0;

COMMENT ON COLUMN formulations.nominal_speed IS 'Theoretical maximum production rate in tonnes per hour (t/hr) for efficiency calculations';

-- Seed nominal speeds from the official Hyperfeeds rate sheet by sage_code / name pattern.
-- Run as a single statement that updates all matching formulations.
UPDATE formulations
SET nominal_speed = CASE
  -- MAIN PLANT (3 t/hr)
  WHEN sage_code LIKE 'BSC%' OR sage_code LIKE 'BGF%' OR sage_code LIKE 'BSGC%' OR name ILIKE '%broiler starter%crumbs%' OR name ILIKE '%broiler grower%crumbs%' OR name ILIKE '%broiler star%crumbs%' OR name ILIKE '%broiler gro fin%crumbs%' THEN 3.0
  -- MAIN PLANT (3.5 t/hr)
  WHEN sage_code LIKE 'BGP%' OR name ILIKE '%broiler grower pellet%' THEN 3.5
  -- MAIN PLANT (4 t/hr)
  WHEN sage_code LIKE 'BFP%' OR name ILIKE '%broiler finisher pellet%' OR sage_code LIKE 'RBP%' OR name ILIKE '%rabbit pellet%' OR name ILIKE '%duck pellet%' THEN 4.0
  -- MAIN PLANT (4.5 t/hr)
  WHEN sage_code LIKE 'LSM%' OR sage_code LIKE 'LDM%' OR sage_code LIKE 'LPM%' OR name ILIKE '%layer%mash%' THEN 4.5
  -- MAIN PLANT (2.5 t/hr)
  WHEN sage_code LIKE 'DML%' OR name ILIKE '%dog meal%' THEN 2.5
  -- DOG CHUNKS LINE (0.4 t/hr)
  WHEN sage_code LIKE 'HDC%' OR name ILIKE '%hyper dog chunk%' OR name ILIKE '%dog chunk%' THEN 0.4
  -- DOG CHUNKS LINE (0.6 t/hr)
  WHEN name ILIKE '%fat fat%dog%' OR name ILIKE '%fat fat big plant%' THEN 0.6
  -- DOG CHUNKS LINE (0.4 t/hr - new dog line)
  WHEN name ILIKE '%new dog%' THEN 0.4
  -- RED PLANT (0.5 t/hr)
  WHEN name ILIKE '%broiler concentrate%' OR name ILIKE '%layers concentrate%' OR name ILIKE '%dog milling%' THEN 0.5
  -- RED PLANT (1.0 t/hr)
  WHEN name ILIKE '%bran mill%' THEN 1.0
  -- RED PLANT (1.2 t/hr)
  WHEN name ILIKE '%maize mill%' THEN 1.2
  -- BLOCKS PLANT (0.18 t/hr)
  WHEN sage_code LIKE 'BGC%' OR name ILIKE '%game block%' OR name ILIKE '%winter block%' OR name ILIKE '%high phos%' OR sage_code LIKE 'LAC%' OR sage_code LIKE 'LPMC%' OR name ILIKE '%lick%' THEN 0.18
  -- SAMURAI PLANT (1.0 t/hr)
  WHEN sage_code LIKE 'RR%' OR name ILIKE '%road runner%' OR sage_code LIKE 'PIG%' OR sage_code LIKE 'PGF%' OR sage_code LIKE 'PGM%' OR sage_code LIKE 'PCM%' OR sage_code LIKE 'PDB%' OR sage_code LIKE 'PCW%' OR sage_code LIKE 'PGFC%' OR name ILIKE '%pig%' OR name ILIKE '%goat meal%' OR name ILIKE '%horse meal%' THEN 1.0
  -- SAMURAI PLANT (1.25 t/hr)
  WHEN sage_code LIKE 'DAI%' OR name ILIKE '%dairy meal%' OR name ILIKE '%calf grower%' THEN 1.25
  -- SAMURAI PLANT (0.83 t/hr)
  WHEN sage_code LIKE 'BFAM%' OR sage_code LIKE 'BSUM%' OR sage_code LIKE 'DCM%' OR name ILIKE '%bull heifer%' OR name ILIKE '%calf starter%' THEN 0.83
  -- SAMURAI PLANT (0.875 t/hr)
  WHEN name ILIKE '%lucerne%' THEN 0.875
  -- Default fallback
  ELSE 1.0
END
WHERE nominal_speed = 0 OR nominal_speed IS NULL;
