-- UAT safety switch: warehouse replenishment remains an internal MES workflow.
-- Sage is updated only when materials are actually issued to production.
-- Existing audit records are preserved; no Sage data is changed by this script.

DROP TRIGGER IF EXISTS on_material_transfer_received_sage ON public.material_transfers;

UPDATE public.sync_log
SET
  status = 'failed',
  next_retry_at = NULL,
  error_details = jsonb_build_object(
    'message', 'Material-transfer Sage posting is disabled. RM to Production replenishment remains internal to MES.',
    'resolution', 'No action required. Sage is updated at actual production material issue.'
  ),
  updated_at = now()
WHERE event_type = 'material_transfer_to_production'
  AND status IN ('pending', 'processing', 'pending_finance_review');

COMMENT ON TABLE public.material_transfers
  IS 'MES internal warehouse replenishment workflow. Sage posting is intentionally disabled pending a separately validated inter-warehouse design.';
