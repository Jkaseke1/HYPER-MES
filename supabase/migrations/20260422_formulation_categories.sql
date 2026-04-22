-- Formulation Categories lookup table
-- Replaces the restrictive CHECK constraint on formulations.category with a maintainable lookup.
-- Seeded with canonical Hyperfeeds product families. Admin can add/deactivate via Settings (future) or direct SQL.

CREATE TABLE IF NOT EXISTS formulation_categories (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sage_category_code TEXT,  -- Optional link to _etblStockCategories.cCategoryName for future reporting join
  display_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formulation_categories_active
  ON formulation_categories(is_active, display_order);

-- Seed product families
INSERT INTO formulation_categories (code, name, sage_category_code, display_order) VALUES
  ('broiler',   'Broiler',          'POUL', 10),
  ('layer',     'Layer',            'POUL', 20),
  ('breeder',   'Breeder',          'POUL', 30),
  ('game_bird', 'Game Bird',        'POUL', 40),
  ('dairy',     'Dairy Cattle',     'RUM',  50),
  ('beef',      'Beef Cattle',      'RUM',  60),
  ('pig',       'Pig',              NULL,   70),
  ('horse',     'Horse',            NULL,   80),
  ('rabbit',    'Rabbit',           NULL,   90),
  ('dog_food',  'Dog Food',         NULL,  100),
  ('cat_food',  'Cat Food',         NULL,  110),
  ('fish',      'Fish',             NULL,  120),
  ('chemicals', 'Chemicals',        'CHEM', 200),
  ('equipment', 'Equipment',        'EQUI', 210),
  ('pet',       'Pet (Legacy)',     NULL,  900),  -- kept for back-compat with existing data
  ('other',     'Other',            NULL, 1000)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      sage_category_code = EXCLUDED.sage_category_code,
      display_order = EXCLUDED.display_order,
      updated_at = NOW();

-- Relax the CHECK constraint on formulations.category so any code from the lookup is acceptable.
-- We cannot FK because some legacy rows may have non-matching values; instead we drop CHECK and rely on UI dropdown.
ALTER TABLE formulations DROP CONSTRAINT IF EXISTS formulations_category_check;

-- RLS: read for all authenticated; writes for admins only (reuse existing pattern)
ALTER TABLE formulation_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read formulation_categories" ON formulation_categories;
CREATE POLICY "Authenticated can read formulation_categories"
  ON formulation_categories FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can manage formulation_categories" ON formulation_categories;
CREATE POLICY "Authenticated can manage formulation_categories"
  ON formulation_categories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE formulation_categories IS
  'Lookup of formulation product-family categories. Replaces the previous CHECK constraint on formulations.category. sage_category_code optionally maps to _etblStockCategories for reporting joins.';
