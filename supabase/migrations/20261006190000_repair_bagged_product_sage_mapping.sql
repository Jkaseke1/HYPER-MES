-- Repair the TEST/UAT bagged-product mapping when the original seed ran before
-- the formulation existed. MES stores production quantities in kilograms;
-- Sage stocks BSG50 as 50 kg finished-good units.

WITH target_formulation AS (
  SELECT DISTINCT ON (f.sage_code)
    f.id,
    f.sage_code
  FROM public.formulations f
  WHERE f.sage_code = 'BSG50'
  ORDER BY
    f.sage_code,
    (f.status = 'active') DESC,
    f.version DESC NULLS LAST,
    f.created_at DESC,
    f.id
)
INSERT INTO public.sage_product_integration_settings (
  formulation_id,
  sage_code,
  kg_per_sage_unit,
  packaging_sage_code,
  packaging_qty_per_sage_unit,
  sage_project_id,
  sage_project_code,
  posting_cost_mode,
  notes
)
SELECT
  f.id,
  f.sage_code,
  50,
  'PASG0050',
  1,
  10,
  'GRA',
  'sage_average',
  'Repair: BSG50 is posted to Sage as 50 kg finished-good units; one PASG0050 bag per unit.'
FROM target_formulation f
ON CONFLICT (sage_code) DO UPDATE SET
  formulation_id = EXCLUDED.formulation_id,
  kg_per_sage_unit = EXCLUDED.kg_per_sage_unit,
  packaging_sage_code = EXCLUDED.packaging_sage_code,
  packaging_qty_per_sage_unit = EXCLUDED.packaging_qty_per_sage_unit,
  sage_project_id = EXCLUDED.sage_project_id,
  sage_project_code = EXCLUDED.sage_project_code,
  posting_cost_mode = EXCLUDED.posting_cost_mode,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.packaging_skus (
  sku_code, description, bag_size_kg, is_active, sage_stock_code
)
VALUES ('PASG0050', 'PACKAGING STAR/GRO 50kg', 50, true, 'PASG0050')
ON CONFLICT (sku_code) DO UPDATE SET
  description = EXCLUDED.description,
  bag_size_kg = EXCLUDED.bag_size_kg,
  is_active = true,
  sage_stock_code = EXCLUDED.sage_stock_code;

WITH target_formulation AS (
  SELECT DISTINCT ON (f.sage_code)
    f.id,
    f.sage_code
  FROM public.formulations f
  WHERE f.sage_code = 'BSG50'
  ORDER BY
    f.sage_code,
    (f.status = 'active') DESC,
    f.version DESC NULLS LAST,
    f.created_at DESC,
    f.id
)
INSERT INTO public.production_bom_packaging (
  formulation_id, item_code, description, unit, expected_qty_per_tonne
)
SELECT f.id, 'PASG0050', 'PACKAGING STAR/GRO 50kg', 'bags', 20
FROM target_formulation f
WHERE NOT EXISTS (
    SELECT 1
    FROM public.production_bom_packaging p
    WHERE p.formulation_id = f.id
      AND p.item_code = 'PASG0050'
  );
