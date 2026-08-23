// bridgeWorker.js - Main bridge worker that polls sync_log and processes events
// Coordinates all auto event handlers and runs continuously
// Uses direct MSSQL for legacy handlers and the validated Sage SDK API for warehouse transfers.

const { supabase, DRY_RUN } = require('./lib/db');
const { handleGoodsReceipt }  = require('./goodsReceiptAuto');
const { handleGoodsIssue }    = require('./goodsIssueAuto');
const { handleBatchComplete } = require('./batchCompleteAuto');
const { handleDispatch }      = require('./dispatchAuto');
const { handleMaterialTransferToProduction } = require('./materialTransferSdkAuto');
const { handleRmCostUpdated } = require('./rmCostUpdatedAuto');
const { syncSageStock } = require('./sageStockSync');

const POLL_INTERVAL_MS = 30000;
const STOCK_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let stockSyncInProgress = false;

async function refreshSageStock(itemCodes, reason) {
  if (stockSyncInProgress) return;
  stockSyncInProgress = true;
  try {
    const result = await syncSageStock(itemCodes);
    console.log(`  Sage stock sync (${reason}): ${result.synced} warehouse balance(s) refreshed for ${result.materialCount} material(s)`);
    if (result.failures.length) console.warn(`  Sage stock sync warnings: ${result.failures.slice(0, 3).join('; ')}`);
  } catch (error) {
    console.error(`  Sage stock sync failed (${reason}): ${error.message}`);
  } finally {
    stockSyncInProgress = false;
  }
}

function postedStockCodes(eventType, details) {
  if (eventType === 'material_transfer_to_production') return [details?.sdkTransfer?.itemCode].filter(Boolean);
  if (eventType === 'materials_issued') return (details?.sdkMaterialIssue?.lines || []).map((line) => line.itemCode).filter(Boolean);
  if (eventType === 'grn_confirmed') return (details?.sdkGoodsReceipt?.lines || []).map((line) => line.itemCode).filter(Boolean);
  return [];
}

async function processPendingEvents() {
  const { data: pending, error } = await supabase
    .from('sync_log')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ Failed to read sync_log:', error.message);
    return;
  }

  if (!pending || pending.length === 0) return;

  console.log(`\n[${new Date().toISOString()}] Found ${pending.length} pending event(s)`);

  for (const event of pending) {
    // Claim the event atomically. A second bridge instance may have fetched the
    // same pending row, but only one instance is allowed to post it to Sage.
    const { data: claimed, error: claimError } = await supabase
      .from('sync_log')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error(`  ❌ Failed to claim ${event.id}: ${claimError.message}`);
      continue;
    }

    if (!claimed) {
      console.log(`  ⏭️  ${event.event_type} for ${event.reference_id} was claimed by another worker`);
      continue;
    }

    // ── Idempotency check ─────────────────────────────────────────────────────
    const { data: alreadyDone } = await supabase
      .from('sync_log')
      .select('id')
      .eq('reference_id', event.reference_id)
      .eq('event_type', event.event_type)
      .eq('status', 'success')
      .neq('id', event.id)
      .limit(1);

    if (alreadyDone && alreadyDone.length > 0) {
      console.log(`  ⚠️  Duplicate: ${event.event_type} for ${event.reference_id} — already processed, skipping`);
      await supabase
        .from('sync_log')
        .update({ status: 'success', message: 'Duplicate — already processed successfully', updated_at: new Date().toISOString() })
        .eq('id', event.id);
      continue;
    }
    // ── End idempotency check ─────────────────────────────────────────────────

    console.log(`\nProcessing: ${event.event_type} — ${event.reference_type} — ${event.reference_id}`);

    try {
      let handlerResult = null;

      switch (event.event_type) {
        case 'grn_confirmed':
          handlerResult = await handleGoodsReceipt(event);
          break;
        case 'materials_issued':
          handlerResult = await handleGoodsIssue(event);
          break;
        case 'production_completed':
          handlerResult = await handleBatchComplete(event);
          break;
        case 'dispatch_delivered':
          handlerResult = await handleDispatch(event);
          break;
        case 'material_transfer_to_production':
          handlerResult = await handleMaterialTransferToProduction(event);
          break;
        case 'rm_cost_updated':
          handlerResult = await handleRmCostUpdated(event);
          break;
        default:
          console.log(`  ⚠️  Unknown event type: ${event.event_type} — skipping`);
          await supabase
            .from('sync_log')
            .update({ status: 'success', message: `Unknown event type skipped: ${event.event_type}`, updated_at: new Date().toISOString() })
            .eq('id', event.id);
          continue;
      }

      const successUpdate = {
        status: 'success',
        updated_at: new Date().toISOString(),
      };

      if (handlerResult?.message) successUpdate.message = handlerResult.message;
      if (handlerResult?.sage_response) successUpdate.sage_response = handlerResult.sage_response;
      if (handlerResult?.details) successUpdate.details = handlerResult.details;

      await supabase
        .from('sync_log')
        .update(successUpdate)
        .eq('id', event.id);

      const itemCodes = postedStockCodes(event.event_type, handlerResult?.details);
      if (itemCodes.length) {
        await refreshSageStock([...new Set(itemCodes)], `after ${event.event_type}`);
      }

      console.log(`  ✅ ${event.event_type} processed successfully`);

    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);

      await supabase
        .from('sync_log')
        .update({
          status:        'failed',
          message:       err.message,
          error_details: {
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode || null,
            response: err.response || null,
          },
          retry_count:   (event.retry_count || 0) + 1,
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('id', event.id);
    }
  }
}

async function startWorker() {
  console.log('==============================================');
  console.log(' HYPER MES — Sage Pastel Bridge Worker');
  console.log(` Mode: ${DRY_RUN ? 'DRY RUN (safe — no Sage writes)' : 'LIVE'}`);
  console.log(` Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log('==============================================\n');
  console.log('Watching sync_log for pending events...');
  console.log('Idempotency check: ENABLED — no duplicate processing\n');

  // A full stock refresh is batched so a large catalogue never delays posting events.
  void refreshSageStock(undefined, 'startup reconciliation batch');

  await processPendingEvents();
  setInterval(processPendingEvents, POLL_INTERVAL_MS);
  setInterval(() => { refreshSageStock(undefined, 'scheduled refresh'); }, STOCK_SYNC_INTERVAL_MS);
}

process.on('SIGINT',  () => { console.log('\n📡 Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n📡 Shutting down...'); process.exit(0); });

startWorker();
