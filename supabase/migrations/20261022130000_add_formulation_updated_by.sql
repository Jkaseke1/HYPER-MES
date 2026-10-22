-- Retain the user responsible for the latest formula or BOM change.
ALTER TABLE public.formulations
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_formulations_updated_by
  ON public.formulations (updated_by);
