-- Sage-aligned finished-good posting rules.
-- MES remains operationally in kg; Sage posts the stocked finished-good unit.
-- Seeded from Hyperfeeds 2026 UAT Sage BOM BSG50 / BomID 5094.

CREATE TABLE IF NOT EXISTS public.sage_product_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulation_id uuid NOT NULL REFERENCES public.formulations(id) ON DELETE CASCADE,
  sage_code text NOT NULL UNIQUE,
  kg_per_sage_unit numeric NOT NULL DEFAULT 1 CHECK (kg_per_sage_unit > 0),
  packaging_sage_code text,
  packaging_qty_per_sage_unit numeric NOT NULL DEFAULT 0 CHECK (packaging_qty_per_sage_unit >= 0),
  sage_project_id integer NOT NULL DEFAULT 0 CHECK (sage_project_id >= 0),
  sage_project_code text,
  posting_cost_mode text NOT NULL DEFAULT 'sage_average' CHECK (posting_cost_mode IN ('sage_average', 'calculated')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sage_product_integration_settings_formulation
  ON public.sage_product_integration_settings(formulation_id);

ALTER TABLE public.sage_posting_reviews
  ADD COLUMN IF NOT EXISTS sage_project_id integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sage_posting_reviews.sage_project_id IS
  'Sage ProjectLink carried through finance review and passed to PostInventoryTxV2.';

ALTER TABLE public.sage_product_integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read Sage product integration settings" ON public.sage_product_integration_settings;
CREATE POLICY "Authenticated users can read Sage product integration settings"
  ON public.sage_product_integration_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage Sage product integration settings" ON public.sage_product_integration_settings;
CREATE POLICY "Admins can manage Sage product integration settings"
  ON public.sage_product_integration_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.code = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.code = 'admin'
    )
  );

-- BSG50 is a 50 kg bagged Sage stock item. The UAT Sage BOM consumes one
-- PASG0050 bag per BSG50 unit; historical BSG50 MFPs use project GRA (10).
INSERT INTO public.sage_product_integration_settings (
  formulation_id, sage_code, kg_per_sage_unit,
  packaging_sage_code, packaging_qty_per_sage_unit,
  sage_project_id, sage_project_code, posting_cost_mode, notes
)
SELECT id, sage_code, 50, 'PASG0050', 1, 10, 'GRA', 'sage_average',
  'Seeded from Hyperfeeds 2026 UAT Sage BomMast/BomComp: BSG50, packaging PASG0050, project GRA.'
FROM public.formulations
WHERE sage_code = 'BSG50'
ON CONFLICT (sage_code) DO UPDATE SET
  kg_per_sage_unit = EXCLUDED.kg_per_sage_unit,
  packaging_sage_code = EXCLUDED.packaging_sage_code,
  packaging_qty_per_sage_unit = EXCLUDED.packaging_qty_per_sage_unit,
  sage_project_id = EXCLUDED.sage_project_id,
  sage_project_code = EXCLUDED.sage_project_code,
  posting_cost_mode = EXCLUDED.posting_cost_mode,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Mirror the official Sage packaging item in MES packaging declarations.
INSERT INTO public.packaging_skus (
  sku_code, description, bag_size_kg, is_active, sage_stock_code
) VALUES (
  'PASG0050', 'PACKAGING STAR/GRO 50kg', 50, true, 'PASG0050'
)
ON CONFLICT (sku_code) DO UPDATE SET
  description = EXCLUDED.description,
  bag_size_kg = EXCLUDED.bag_size_kg,
  is_active = true,
  sage_stock_code = EXCLUDED.sage_stock_code;

INSERT INTO public.production_bom_packaging (
  formulation_id, item_code, description, unit, expected_qty_per_tonne
)
SELECT f.id, 'PASG0050', 'PACKAGING STAR/GRO 50kg', 'bags', 20
FROM public.formulations f
WHERE f.sage_code = 'BSG50'
  AND NOT EXISTS (
    SELECT 1 FROM public.production_bom_packaging p
    WHERE p.formulation_id = f.id AND p.item_code = 'PASG0050'
  );
