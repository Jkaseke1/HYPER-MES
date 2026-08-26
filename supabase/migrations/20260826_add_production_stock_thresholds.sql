-- Production floor carries a separate minimum from the RM warehouse.
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS production_reorder_level numeric NOT NULL DEFAULT 0;

UPDATE public.raw_materials
SET production_reorder_level = COALESCE(reorder_level, 0)
WHERE production_reorder_level = 0
  AND COALESCE(reorder_level, 0) > 0;
