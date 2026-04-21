// batchCompleteAuto.js - Event 3: Production Completion Handler
// Reads from production_orders + production_outputs by reference_id from sync_log
// Posts to Sage Pastel as finished goods receipt/inventory addition

const { supabase } = require('./lib/supabase');
const sageClient = require('./lib/sageClient');

async function handleBatchCompleted(syncLogEntry) {
  try {
    console.log(`Processing batch completion for sync_log ID: ${syncLogEntry.id}`);
    
    // Get production order details with outputs
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select(`
        *,
        formulations(name, code, sage_code, batch_unit),
        machines(name),
        warehouses(name),
        production_outputs(
          *,
          warehouses(name)
        )
      `)
      .eq('id', syncLogEntry.reference_id)
      .single();

    if (orderError) {
      throw new Error(`Failed to fetch production order: ${orderError.message}`);
    }

    if (!productionOrder) {
      throw new Error('Production order not found');
    }

    // Validate required Sage codes
    if (!productionOrder.formulations?.sage_code) {
      throw new Error(`Formulation ${productionOrder.formulations.name} missing sage_code`);
    }

    if (!productionOrder.production_outputs || productionOrder.production_outputs.length === 0) {
      throw new Error(`No production outputs found for batch ${productionOrder.batch_number}`);
    }

    // Prepare Sage transaction data for finished goods receipt
    const sageTransaction = {
      transactionType: 'FINISHED_GOODS_RECEIPT',
      transactionDate: productionOrder.actual_end || new Date().toISOString().split('T')[0],
      reference: `BATCH-${productionOrder.batch_number}`,
      formulation: {
        code: productionOrder.formulations.sage_code,
        name: productionOrder.formulations.name,
        batchNumber: productionOrder.batch_number
      },
      lines: productionOrder.production_outputs.map(output => ({
        stockCode: productionOrder.formulations.sage_code,
        description: `${productionOrder.formulations.name} - Batch ${productionOrder.batch_number}`,
        quantity: output.quantity_produced,
        rejectedQuantity: output.rejected_quantity || 0,
        wastageQuantity: output.wastage_quantity || 0,
        unit: productionOrder.formulations.batch_unit || 'kg',
        warehouse: output.warehouses?.name || productionOrder.warehouses?.name || 'Main Warehouse',
        qualityStatus: output.quality_status || 'pending',
        batchNumber: output.batch_number || productionOrder.batch_number,
        productionDate: output.recorded_at || productionOrder.actual_end,
        recordedBy: output.recorded_by || 'System'
      })),
      totalQuantity: productionOrder.actual_qty,
      totalRejected: productionOrder.rejected_qty || 0,
      totalWastage: productionOrder.wastage_qty || 0,
      machine: productionOrder.machines?.name || 'Unknown',
      notes: `Batch ${productionOrder.batch_number} automatically completed - ${productionOrder.formulations.name}`,
      costs: {
        rawMaterialCost: productionOrder.raw_material_cost || 0,
        labourCost: productionOrder.labour_cost || 0,
        machineCost: productionOrder.machine_cost || 0,
        overheadCost: productionOrder.overhead_cost || 0,
        totalCost: productionOrder.total_cost || 0,
        costPerUnit: productionOrder.cost_per_unit || 0
      }
    };

    console.log(`Posting batch completion to Sage: ${JSON.stringify(sageTransaction, null, 2)}`);

    // Post to Sage Pastel as finished goods receipt
    const sageResponse = await sageClient.postFinishedGoodsReceipt(sageTransaction);

    // Update sync log with success
    await supabase
      .from('sync_log')
      .update({
        status: 'success',
        message: `Batch ${productionOrder.batch_number} completion posted to Sage successfully`,
        sage_response: sageResponse,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLogEntry.id);

    console.log(`✅ Batch ${productionOrder.batch_number} completion successfully posted to Sage`);
    return sageResponse;

  } catch (error) {
    console.error(`❌ Error processing batch completion:`, error);
    
    // Update sync log with error
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        message: `Failed to post batch completion to Sage: ${error.message}`,
        error_details: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        retry_count: syncLogEntry.retry_count + 1,
        next_retry_at: new Date(Date.now() + (5 * 60 * 1000)).toISOString(), // Retry in 5 minutes
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLogEntry.id);

    throw error;
  }
}

// Process all pending batch completion events
async function processPendingBatchCompletionEvents() {
  try {
    console.log('🔍 Checking for pending batch completion events...');
    
    const { data: pendingEvents, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('event_type', 'production_completed')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process in batches

    if (error) {
      throw new Error(`Failed to fetch pending events: ${error.message}`);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      console.log('✅ No pending batch completion events found');
      return;
    }

    console.log(`📦 Found ${pendingEvents.length} pending batch completion events`);

    // Process each event
    for (const event of pendingEvents) {
      try {
        await handleBatchCompleted(event);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error.message);
        // Continue with next event
      }
    }

    console.log('✅ Batch completion events processing complete');

  } catch (error) {
    console.error('❌ Error in processPendingBatchCompletionEvents:', error);
  }
}

// Export for use in bridge worker
module.exports = {
  handleBatchCompleted,
  processPendingBatchCompletionEvents
};

// Run standalone if called directly
if (require.main === module) {
  processPendingBatchCompletionEvents()
    .then(() => {
      console.log('✅ Batch completion auto handler completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Batch completion auto handler failed:', error);
      process.exit(1);
    });
}
