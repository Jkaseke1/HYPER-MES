-- Daily operations reporting and Power BI branch-feed alert feed.
-- The report page reads production records directly. This migration provides
-- per-branch finished-feed thresholds and a clean, read-only Power BI view.

CREATE TABLE IF NOT EXISTS public.branch_feed_reorder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id integer NOT NULL,
  formulation_id uuid NOT NULL REFERENCES public.formulations(id) ON DELETE CASCADE,
  minimum_qty_kg numeric NOT NULL DEFAULT 0 CHECK (minimum_qty_kg >= 0),
  target_qty_kg numeric NOT NULL DEFAULT 0 CHECK (target_qty_kg >= 0),
  lead_time_days numeric NOT NULL DEFAULT 2 CHECK (lead_time_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, formulation_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_feed_reorder_settings_warehouse
  ON public.branch_feed_reorder_settings (warehouse_id, is_active);

ALTER TABLE public.branch_feed_reorder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read branch feed reorder settings" ON public.branch_feed_reorder_settings;
DROP POLICY IF EXISTS "Authenticated users can manage branch feed reorder settings" ON public.branch_feed_reorder_settings;

CREATE POLICY "Authenticated users can read branch feed reorder settings"
  ON public.branch_feed_reorder_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage branch feed reorder settings"
  ON public.branch_feed_reorder_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_branch_feed_reorder_settings_updated_at ON public.branch_feed_reorder_settings;
CREATE TRIGGER update_branch_feed_reorder_settings_updated_at
  BEFORE UPDATE ON public.branch_feed_reorder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Power BI source: one row per finished product / Sage warehouse.
-- Set a minimum and target quantity for each branch/product in the settings
-- table. Until configured, the row is deliberately labelled Configure Alert.
CREATE OR REPLACE VIEW public.v_powerbi_branch_feed_stock_alerts
WITH (security_invoker = true)
AS
SELECT
  ssb.warehouse_id AS sage_warehouse_id,
  CASE ssb.warehouse_id
    WHEN 17 THEN 'DEB'
    WHEN 19 THEN 'PD'
    WHEN 20 THEN 'DSP'
    WHEN 21 THEN 'MUT'
    WHEN 26 THEN 'FCS'
    WHEN 27 THEN 'EPW'
    WHEN 28 THEN 'MAZ'
    WHEN 31 THEN 'MSA'
    WHEN 32 THEN 'DAN'
    WHEN 36 THEN 'GLE'
    WHEN 39 THEN 'CHI'
    WHEN 40 THEN 'CHK'
    WHEN 43 THEN 'CHR'
    WHEN 44 THEN 'GWE'
    WHEN 45 THEN 'BIN'
    WHEN 49 THEN 'PLU'
    ELSE 'WHSE-' || ssb.warehouse_id::text
  END AS warehouse_code,
  f.id AS formulation_id,
  f.code AS item_code,
  f.name AS item_description,
  f.category,
  COALESCE(ssb.quantity, 0) AS qty_on_hand_kg,
  COALESCE(NULLIF(regexp_replace(COALESCE(f.unit_size_variants->0->>'size', ''), '[^0-9.]', '', 'g'), '')::numeric, 50) AS bag_size_kg,
  ROUND(
    COALESCE(ssb.quantity, 0)
    / NULLIF(COALESCE(NULLIF(regexp_replace(COALESCE(f.unit_size_variants->0->>'size', ''), '[^0-9.]', '', 'g'), '')::numeric, 50), 0),
    2
  ) AS bags_on_hand,
  COALESCE(setting.minimum_qty_kg, 0) AS minimum_qty_kg,
  COALESCE(setting.target_qty_kg, 0) AS target_qty_kg,
  COALESCE(setting.lead_time_days, 2) AS lead_time_days,
  CASE
    WHEN setting.id IS NULL THEN 'CONFIGURE ALERT'
    WHEN COALESCE(ssb.quantity, 0) <= 0 THEN 'STOCKOUT'
    WHEN COALESCE(ssb.quantity, 0) <= setting.minimum_qty_kg THEN 'CRITICAL'
    WHEN COALESCE(ssb.quantity, 0) < setting.target_qty_kg THEN 'LOW'
    ELSE 'OK'
  END AS stock_alert,
  ssb.last_synced_at AS sage_last_synced_at
FROM public.sage_stock_balances ssb
JOIN public.formulations f ON f.id = ssb.formulation_id
LEFT JOIN public.branch_feed_reorder_settings setting
  ON setting.warehouse_id = ssb.warehouse_id
 AND setting.formulation_id = f.id
 AND setting.is_active = true
WHERE f.status = 'active';

GRANT SELECT ON public.v_powerbi_branch_feed_stock_alerts TO authenticated;

COMMENT ON VIEW public.v_powerbi_branch_feed_stock_alerts IS
  'Read-only Power BI feed for current Sage-synchronised branch feed stock and configured reorder alerts.';
