-- The manufacturing UI saves one dispense record per raw material and order.
-- Retain the latest saved dispense reading in each duplicate set, then make the
-- pair unique so the application's upsert target is valid going forward.
BEGIN;

DELETE FROM macropack_manufacture_issues AS duplicate_issue
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY manufacture_order_id, raw_material_id
        ORDER BY dispensed_at DESC NULLS LAST, id DESC
      ) AS row_number
    FROM macropack_manufacture_issues
  ) AS ranked_issues
  WHERE ranked_issues.row_number > 1
) AS obsolete_issue
WHERE duplicate_issue.id = obsolete_issue.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_macropack_manufacture_issues_order_material
  ON macropack_manufacture_issues (manufacture_order_id, raw_material_id);

COMMIT;
