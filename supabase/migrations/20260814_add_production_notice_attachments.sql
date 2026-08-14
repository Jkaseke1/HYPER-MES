-- Evidence retained with the MES digital production notice.
CREATE TABLE IF NOT EXISTS public.production_notice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_notice_id uuid NOT NULL REFERENCES public.production_notices(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_size integer NOT NULL CHECK (file_size >= 0),
  file_type text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_notice_attachments_notice
  ON public.production_notice_attachments(production_notice_id);

ALTER TABLE public.production_notice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read production notice attachments"
  ON public.production_notice_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can add production notice attachments"
  ON public.production_notice_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Uploaders can delete production notice attachments"
  ON public.production_notice_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'production-notice-attachments',
  'production-notice-attachments',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload production notice files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'production-notice-attachments');
CREATE POLICY "Authenticated users can view production notice files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'production-notice-attachments');
CREATE POLICY "Uploaders can delete production notice files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'production-notice-attachments' AND owner = auth.uid());

-- The original control-centre migration allowed every signed-in user to verify a notice.
-- Keep preparation with the originating user, but reserve verification for accountable roles.
DROP POLICY IF EXISTS "Authenticated users can create production notices" ON public.production_notices;
DROP POLICY IF EXISTS "Authenticated users can update production notices" ON public.production_notices;

CREATE POLICY "Production users can create their own notices"
  ON public.production_notices FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'submitted'));

CREATE POLICY "Originators and verifiers can update production notices"
  ON public.production_notices FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'production_manager', 'supervisor', 'finance', 'accountant')
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'production_manager', 'supervisor', 'finance', 'accountant')
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_production_notice_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $verification$
DECLARE
  can_verify boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'production_manager', 'supervisor', 'finance', 'accountant')
  ) INTO can_verify;

  IF NEW.status = 'verified' AND NOT can_verify THEN
    RAISE EXCEPTION 'Only an authorised supervisor, production manager or Finance user may verify a production notice';
  END IF;
  IF OLD.status = 'verified' AND NOT can_verify THEN
    RAISE EXCEPTION 'A verified production notice can only be amended by an authorised verifier';
  END IF;
  RETURN NEW;
END;
$verification$;

DROP TRIGGER IF EXISTS production_notice_verification_guard ON public.production_notices;
CREATE TRIGGER production_notice_verification_guard
  BEFORE UPDATE ON public.production_notices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_production_notice_verification();
