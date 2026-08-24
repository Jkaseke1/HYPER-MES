-- Require an auditable physical handover check before finished goods leave
-- Sage Production (PD) for Dispatch (DEB).

ALTER TABLE public.finished_goods_transfers
  ADD COLUMN IF NOT EXISTS verified_quantity numeric,
  ADD COLUMN IF NOT EXISTS verified_bags numeric,
  ADD COLUMN IF NOT EXISTS production_verified_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS production_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_verified_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS finance_verified_at timestamptz;

ALTER TABLE public.finished_goods_transfers
  ADD CONSTRAINT finished_goods_transfer_verified_quantity_positive
  CHECK (verified_quantity IS NULL OR verified_quantity > 0) NOT VALID;

ALTER TABLE public.finished_goods_transfers
  ADD CONSTRAINT finished_goods_transfer_verified_bags_positive
  CHECK (verified_bags IS NULL OR verified_bags > 0) NOT VALID;
