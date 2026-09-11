-- Older test databases have approval timestamps but lack these version fields.
BEGIN;
ALTER TABLE public.formulations
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_daily_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS variation_name text DEFAULT '';
NOTIFY pgrst, 'reload schema';
COMMIT;
