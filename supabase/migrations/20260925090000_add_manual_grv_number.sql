-- Store the manual Sage GRV number separately from external/weighbridge references.
-- TEST rollout only; do not run against the live database.

ALTER TABLE public.goods_received_notes
  ADD COLUMN IF NOT EXISTS manual_grv_number text;

COMMENT ON COLUMN public.goods_received_notes.manual_grv_number IS
  'Normalized manual Sage GRV number, stored with the HFGRV prefix.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_received_notes_manual_grv_number
  ON public.goods_received_notes (manual_grv_number)
  WHERE manual_grv_number IS NOT NULL;
