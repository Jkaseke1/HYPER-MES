-- ============================================================================
-- Chick Reconciliation Layer
-- READ-ONLY toward Sage. No INSERT/UPDATE to any Sage object.
-- Additive migrations only. All money in USD.
-- ============================================================================

-- ============================================================================
-- 1a. Add Sage GRV columns to chick_delivery_notes (additive only)
-- ============================================================================
ALTER TABLE chick_delivery_notes
ADD COLUMN IF NOT EXISTS sage_grv_number TEXT,
ADD COLUMN IF NOT EXISTS sage_dn_number TEXT,
ADD COLUMN IF NOT EXISTS sage_grv_status TEXT CHECK (sage_grv_status IN ('Unprocessed','Processed')),
ADD COLUMN IF NOT EXISTS sage_grv_value_usd NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Index for DN lookups
CREATE INDEX IF NOT EXISTS idx_chick_dn_sage ON chick_delivery_notes(sage_dn_number);
CREATE INDEX IF NOT EXISTS idx_chick_dn_grv ON chick_delivery_notes(sage_grv_number);

-- ============================================================================
-- 1b. Create chick_dn_map lookup table
-- Maps branch DNOTE numbers (e.g. '33537') to Sage DN numbers (e.g. 'DN11934')
-- ============================================================================
CREATE TABLE IF NOT EXISTS chick_dn_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_dnote TEXT NOT NULL,
  sage_dn_number TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_dnote, sage_dn_number)
);

CREATE INDEX IF NOT EXISTS idx_chick_dn_map_branch ON chick_dn_map(branch_dnote);
CREATE INDEX IF NOT EXISTS idx_chick_dn_map_sage ON chick_dn_map(sage_dn_number);

ALTER TABLE chick_dn_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read chick_dn_map" ON chick_dn_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow chick_manager insert chick_dn_map" ON chick_dn_map FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','chick_manager','accountant')));
CREATE POLICY "Allow chick_manager update chick_dn_map" ON chick_dn_map FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','chick_manager','accountant')));

-- ============================================================================
-- 2. Sage Sales Feed staging table (read-only import, manually or via bridge)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chick_sage_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_number TEXT,
  item_code TEXT NOT NULL CHECK (item_code IN ('DOC','LDOC001')),
  chicks_sold INTEGER NOT NULL DEFAULT 0,
  revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost_usd NUMERIC(10,4),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chick_sage_sales_branch ON chick_sage_sales(branch_code);
CREATE INDEX IF NOT EXISTS idx_chick_sage_sales_date ON chick_sage_sales(invoice_date);
CREATE INDEX IF NOT EXISTS idx_chick_sage_sales_item ON chick_sage_sales(item_code);

ALTER TABLE chick_sage_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read chick_sage_sales" ON chick_sage_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow accountant insert chick_sage_sales" ON chick_sage_sales FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','accountant')));

-- ============================================================================
-- Helper: resolve Sage DN via chick_dn_map or direct match
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_resolve_sage_dn(p_branch_dnote TEXT)
RETURNS TEXT AS $$
DECLARE
  v_sage_dn TEXT;
BEGIN
  SELECT sage_dn_number INTO v_sage_dn
  FROM chick_dn_map
  WHERE branch_dnote = p_branch_dnote
  LIMIT 1;
  
  RETURN COALESCE(v_sage_dn, p_branch_dnote);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. RECONCILIATION VIEW v_chick_reconciliation
-- Per branch + delivery note, show ordered / received / sage GRV
-- ============================================================================
CREATE OR REPLACE VIEW v_chick_reconciliation AS
WITH ordered AS (
  SELECT
    pl.branch_code,
    po.po_number,
    pl.delivery_type,
    pl.chick_type,
    SUM(pl.booked_qty) AS ordered_qty
  FROM chick_po_lines pl
  JOIN chick_purchase_orders po ON po.id = pl.po_id
  WHERE po.status IN ('APPROVED','DISPATCHED','DELIVERED','INVOICED')
  GROUP BY pl.branch_code, po.po_number, pl.delivery_type, pl.chick_type
),
received AS (
  SELECT
    dn.branch_code,
    dn.dnote_number,
    dn.po_line_id,
    dn.quantity_allocated,
    dn.quantity_received,
    dn.variance,
    dn.sage_grv_number,
    dn.sage_dn_number,
    dn.sage_grv_status,
    dn.sage_grv_value_usd,
    dn.status,
    dn.reconciled_at,
    fn_resolve_sage_dn(dn.dnote_number) AS resolved_sage_dn
  FROM chick_delivery_notes dn
  WHERE dn.status IN ('DELIVERED','VARIANCE')
)
SELECT
  o.branch_code,
  o.po_number,
  r.dnote_number,
  r.resolved_sage_dn,
  o.delivery_type,
  o.chick_type,
  o.ordered_qty,
  COALESCE(r.quantity_allocated, 0) AS allocated_qty,
  COALESCE(r.quantity_received, 0) AS received_qty,
  COALESCE(r.variance, 0) AS variance,
  r.sage_grv_number,
  r.sage_dn_number,
  r.sage_grv_status,
  r.sage_grv_value_usd,
  (COALESCE(r.quantity_received, 0) - o.ordered_qty) AS variance_ordered_vs_received,
  CASE
    WHEN r.sage_grv_status = 'Unprocessed' THEN 'GRV_UNPROCESSED'
    WHEN r.sage_grv_number IS NULL AND r.quantity_received > 0 THEN 'GRV_MISSING'
    WHEN COALESCE(r.quantity_received, 0) = o.ordered_qty THEN 'MATCHED'
    WHEN COALESCE(r.quantity_received, 0) < o.ordered_qty THEN 'SHORT_DELIVERY'
    WHEN COALESCE(r.quantity_received, 0) > o.ordered_qty THEN 'OVER_DELIVERY'
    ELSE 'UNKNOWN'
  END AS status,
  r.reconciled_at,
  o.ordered_qty * 0.78 AS estimated_cost_usd  -- approximate
FROM ordered o
LEFT JOIN received r ON r.branch_code = o.branch_code
ORDER BY o.branch_code, o.po_number, r.dnote_number;

-- ============================================================================
-- 4. UNPROCESSED-GRV MONITOR v_chick_grv_unprocessed
-- Received in MES but Sage GRV is still 'Unprocessed' — timing lag nudge
-- ============================================================================
CREATE OR REPLACE VIEW v_chick_grv_unprocessed AS
SELECT
  dn.id AS delivery_note_id,
  dn.branch_code,
  dn.dnote_number,
  dn.sage_dn_number,
  dn.sage_grv_number,
  dn.sage_grv_status,
  dn.sage_grv_value_usd,
  dn.quantity_received,
  dn.declared_at,
  EXTRACT(DAY FROM (NOW() - dn.declared_at)) AS age_days,
  s.name AS supplier,
  po.po_number
FROM chick_delivery_notes dn
JOIN chick_supplier_consignments sc ON sc.id = dn.consignment_id
JOIN chick_suppliers s ON s.id = sc.supplier_id
LEFT JOIN chick_purchase_orders po ON po.id = sc.po_id
WHERE dn.sage_grv_status = 'Unprocessed'
   OR (dn.quantity_received > 0 AND dn.sage_grv_number IS NULL)
ORDER BY age_days DESC;

-- ============================================================================
-- 5. EXCEPTION REPORT v_chick_sales_unmatched
-- Chick sales from Sage with no matching inbound delivery/PO in the period
-- ============================================================================
CREATE OR REPLACE VIEW v_chick_sales_unmatched AS
WITH delivery_period AS (
  SELECT
    MIN(invoice_date) - INTERVAL '7 days' AS start_date,
    MAX(invoice_date) AS end_date
  FROM chick_sage_sales
)
SELECT
  ss.branch_code,
  ss.invoice_date,
  ss.invoice_number,
  ss.item_code,
  ss.chicks_sold,
  ss.revenue_usd,
  ss.unit_cost_usd,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM chick_delivery_notes dn
      WHERE dn.branch_code = ss.branch_code
        AND (dn.sage_dn_number = ss.invoice_number
             OR dn.dnote_number = ss.invoice_number
             OR EXISTS (SELECT 1 FROM chick_dn_map m
                        WHERE m.sage_dn_number = ss.invoice_number
                          AND m.branch_dnote = dn.dnote_number))
    ) THEN false
    ELSE true
  END AS is_unmatched
FROM chick_sage_sales ss
WHERE ss.invoice_date >= (SELECT start_date FROM delivery_period)
  AND NOT EXISTS (
    SELECT 1 FROM chick_delivery_notes dn2
    WHERE dn2.branch_code = ss.branch_code
      AND (dn2.sage_dn_number = ss.invoice_number
           OR dn2.dnote_number = ss.invoice_number)
  )
ORDER BY ss.invoice_date DESC, ss.branch_code;

-- ============================================================================
-- 6. MARGIN VIEW v_chick_margin (read-only, DOC separate from LDOC001)
-- ============================================================================
CREATE OR REPLACE VIEW v_chick_margin AS
SELECT
  branch_code,
  item_code,
  SUM(chicks_sold) AS total_chicks_sold,
  SUM(revenue_usd) AS total_revenue_usd,
  SUM(chicks_sold * COALESCE(unit_cost_usd, 0)) AS total_cost_usd,
  CASE WHEN SUM(chicks_sold) > 0 THEN ROUND(SUM(revenue_usd) / SUM(chicks_sold), 4) ELSE 0 END AS avg_sell_price,
  CASE WHEN SUM(chicks_sold) > 0 THEN ROUND(SUM(chicks_sold * COALESCE(unit_cost_usd, 0)) / SUM(chicks_sold), 4) ELSE 0 END AS avg_cost,
  CASE WHEN SUM(chicks_sold) > 0 THEN ROUND((SUM(revenue_usd) - SUM(chicks_sold * COALESCE(unit_cost_usd, 0))) / SUM(chicks_sold), 4) ELSE 0 END AS profit_per_chick,
  CASE WHEN SUM(revenue_usd) > 0 THEN ROUND((SUM(revenue_usd) - SUM(chicks_sold * COALESCE(unit_cost_usd, 0))) / SUM(revenue_usd) * 100, 2) ELSE 0 END AS margin_pct
FROM chick_sage_sales
GROUP BY branch_code, item_code
ORDER BY branch_code, item_code;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT SELECT ON v_chick_reconciliation TO authenticated;
GRANT SELECT ON v_chick_grv_unprocessed TO authenticated;
GRANT SELECT ON v_chick_sales_unmatched TO authenticated;
GRANT SELECT ON v_chick_margin TO authenticated;

COMMENT ON VIEW v_chick_reconciliation IS 'Ordered vs Received vs Sage GRV reconciliation per branch/delivery note';
COMMENT ON VIEW v_chick_grv_unprocessed IS 'Received in MES but Sage GRV still Unprocessed — operational nudge for Owen';
COMMENT ON VIEW v_chick_sales_unmatched IS 'Chick sales from Sage with no matching inbound delivery — leakage control';
COMMENT ON VIEW v_chick_margin IS 'Per-branch margin by item_code (DOC=broiler, LDOC001=layer). Do not blend.';
