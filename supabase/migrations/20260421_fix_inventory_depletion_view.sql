-- Fix inventory_depletion_forecasts: production_input movements are stored
-- as NEGATIVE quantities (outflow). The original view used SUM(quantity)
-- which sums negatives and then clamps to 0 via GREATEST, so every material
-- reported avg_daily_usage = 0 / days_to_depletion = NULL (always "Stable").
--
-- Fix: sum the absolute consumed magnitude regardless of sign convention.

CREATE OR REPLACE VIEW inventory_depletion_forecasts AS
WITH consumption AS (
  SELECT
    raw_material_id,
    SUM(ABS(quantity)) AS qty_used_last_30
  FROM stock_movements
  WHERE movement_type IN ('issue', 'production_input')
    AND movement_date >= NOW() - INTERVAL '30 days'
  GROUP BY raw_material_id
)
SELECT
  rm.id AS raw_material_id,
  rm.name,
  rm.code,
  rm.current_stock,
  COALESCE(consumption.qty_used_last_30 / 30.0, 0) AS avg_daily_usage,
  CASE
    WHEN COALESCE(consumption.qty_used_last_30, 0) = 0 THEN NULL
    ELSE rm.current_stock / (consumption.qty_used_last_30 / 30.0)
  END AS days_to_depletion
FROM raw_materials rm
LEFT JOIN consumption ON consumption.raw_material_id = rm.id;
