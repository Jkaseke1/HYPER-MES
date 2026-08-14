-- Production control centre: replaces paper production notices with an auditable
-- declaration and verification workflow.  This migration is MES-only; it never
-- writes to Sage.

CREATE TABLE IF NOT EXISTS public.production_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL UNIQUE REFERENCES public.production_orders(id) ON DELETE CASCADE,
  output_qty_kg numeric NOT NULL DEFAULT 0 CHECK (output_qty_kg >= 0),
  output_bags numeric NOT NULL DEFAULT 0 CHECK (output_bags >= 0),
  rejected_qty_kg numeric NOT NULL DEFAULT 0 CHECK (rejected_qty_kg >= 0),
  recycle_qty_kg numeric NOT NULL DEFAULT 0 CHECK (recycle_qty_kg >= 0),
  variance_reason text NOT NULL DEFAULT '',
  declaration_notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'returned')),
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  verification_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_notices_status ON public.production_notices(status);
CREATE INDEX IF NOT EXISTS idx_production_notices_order ON public.production_notices(production_order_id);

ALTER TABLE public.production_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read production notices" ON public.production_notices;
CREATE POLICY "Authenticated users can read production notices"
  ON public.production_notices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create production notices" ON public.production_notices;
CREATE POLICY "Authenticated users can create production notices"
  ON public.production_notices FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() OR submitted_by IS NULL);

DROP POLICY IF EXISTS "Authenticated users can update production notices" ON public.production_notices;
CREATE POLICY "Authenticated users can update production notices"
  ON public.production_notices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.production_notices IS
  'Digital replacement for the Production Notice: output, bags, recycle, variance declaration and supervisor verification.';
