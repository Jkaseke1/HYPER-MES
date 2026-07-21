-- Fix duplicate sync_log inserts on GRN approval / production completion / macropack completion.
--
-- Several frontend pages manually insert a sync_log row on the same status
-- transition that a legacy DB trigger (from 20260328000002_create_bridge_triggers.sql
-- and 20260710_sage_posting_bridge_enhancements.sql) ALSO fires on. This causes
-- two sync_log events per action, which the bridge worker processes independently
-- -- resulting in duplicate Sage postings (double stock qty, double GL entries,
-- double cost revaluation).
--
-- Affected pairs (frontend insert vs DB trigger):
--   GRNApprovalButtons.tsx        -> grn_confirmed        vs on_grn_approved
--   ProductionOrdersPage.tsx      -> production_completed vs on_production_completed
--   MacropackManufacturingPage.tsx -> macropack_manufactured vs on_macropack_completed
--
-- materials_issued (on_materials_issued) and dispatch_delivered
-- (on_dispatch_delivered) have NO frontend duplicate insert -- those triggers
-- are left untouched since they are the only source of those sync_log events.
--
-- The frontend inserts are the source of truth going forward (they also drive
-- rm_cost_register / rm_daily_receipts / DRS creation), so we drop the
-- duplicate DB triggers.

DROP TRIGGER IF EXISTS on_grn_approved ON goods_received_notes;
DROP TRIGGER IF EXISTS on_production_completed ON production_orders;
DROP TRIGGER IF EXISTS on_macropack_completed ON macropack_manufacture_orders;

COMMENT ON FUNCTION trigger_grn_confirmed() IS
  'DEPRECATED: no longer wired to a trigger. GRN approval sync_log insert is now handled exclusively by GRNApprovalButtons.tsx to avoid duplicate grn_confirmed events.';
COMMENT ON FUNCTION trigger_production_completed() IS
  'DEPRECATED: no longer wired to a trigger. production_completed sync_log insert is now handled exclusively by ProductionOrdersPage.tsx to avoid duplicate events.';
COMMENT ON FUNCTION trigger_macropack_manufactured() IS
  'DEPRECATED: no longer wired to a trigger. macropack_manufactured sync_log insert is now handled exclusively by MacropackManufacturingPage.tsx to avoid duplicate events.';
