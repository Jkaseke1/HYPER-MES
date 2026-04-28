-- Add cost_per_unit and updated_at to macropack_manufacture_orders
ALTER TABLE macropack_manufacture_orders
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric(12,4),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
