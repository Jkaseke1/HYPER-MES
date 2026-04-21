// goodsIssueAuto.js - Event 2: Material Issuance Handler
// Reads from production_order_materials by reference_id from sync_log
// Posts to Sage Pastel as material consumption/cost of goods sold

const { supabase } = require('../lib/supabase');
const sageClient = require('../lib/sageClient');

async function handleGoodsIssued(syncLogEntry) {
  try {
    console.log(`Processing material issuance for sync_log ID: ${syncLogEntry.id}`);
    
    // Get production order material details
    const { data: materialIssue, error: issueError } = await supabase
      .from('production_order_materials')
      .select(`
        *,
        production_orders(
          batch_number,
          formulations(name, sage_code),
          machines(name)
        ),
        raw_materials(name, code, sage_code)
      `)
      .eq('id', syncLogEntry.reference_id)
      .single();

    if (issueError) {
      throw new Error(`Failed to fetch material issue: ${issueError.message}`);
    }

    if (!materialIssue) {
      throw new Error('Material issue not found');
    }

    // Validate required Sage codes
    if (!materialIssue.raw_materials?.sage_code) {
      throw new Error(`Raw material ${materialIssue.raw_materials.name} missing sage_code`);
    }

    if (!materialIssue.production_orders?.formulations?.sage_code) {
      throw new Error(`Formulation ${materialIssue.production_orders.formulations.name} missing sage_code`);
    }

    // Prepare Sage transaction data for material consumption
    const sageTransaction = {
      transactionType: 'MATERIAL_ISSUE',
      transactionDate: materialIssue.issued_at || new Date().toISOString().split('T')[0],
      reference: `BATCH-${materialIssue.production_orders.batch_number}`,
      costCenter: 'PRODUCTION', // Can be configured per machine/department
      lines: [{
        stockCode: materialIssue.raw_materials.sage_code,
        description: `Material issue for ${materialIssue.production_orders.formulations.name}`,
        quantity: materialIssue.actual_qty,
        unitCost: materialIssue.unit_cost,
        totalCost: materialIssue.total_cost,
        batchNumber: materialIssue.production_orders.batch_number,
        machine: materialIssue.production_orders.machines?.name || 'Unknown',
        issuedBy: syncLogEntry.details?.operator_id || 'System'
      }],
      notes: `Material automatically issued for batch ${materialIssue.production_orders.batch_number} - ${materialIssue.production_orders.formulations.name}`,
      productionOrder: materialIssue.production_orders.batch_number,
      formulation: materialIssue.production_orders.formulations.name
    };

    console.log(`Posting material issue to Sage: ${JSON.stringify(sageTransaction, null, 2)}`);

    // Post to Sage Pastel as inventory issue/cost of goods sold
    const sageResponse = await sageClient.postMaterialIssue(sageTransaction);

    // Update sync log with success
    await supabase
      .from('sync_log')
      .update({
        status: 'success',
        message: `Material issue for batch ${materialIssue.production_orders.batch_number} posted to Sage successfully`,
        sage_response: sageResponse,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLogEntry.id);

    console.log(`✅ Material issue for batch ${materialIssue.production_orders.batch_number} successfully posted to Sage`);
    return sageResponse;

  } catch (error) {
    console.error(`❌ Error processing material issuance:`, error);
    
    // Update sync log with error
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        message: `Failed to post material issue to Sage: ${error.message}`,
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

// Process all pending material issuance events
async function processPendingGoodsIssueEvents() {
  try {
    console.log('🔍 Checking for pending material issuance events...');
    
    const { data: pendingEvents, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('event_type', 'materials_issued')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process in batches

    if (error) {
      throw new Error(`Failed to fetch pending events: ${error.message}`);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      console.log('✅ No pending material issuance events found');
      return;
    }

    console.log(`📦 Found ${pendingEvents.length} pending material issuance events`);

    // Process each event
    for (const event of pendingEvents) {
      try {
        await handleGoodsIssued(event);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error.message);
        // Continue with next event
      }
    }

    console.log('✅ Material issuance events processing complete');

  } catch (error) {
    console.error('❌ Error in processPendingGoodsIssueEvents:', error);
  }
}

// Export for use in bridge worker
module.exports = {
  handleGoodsIssued,
  processPendingGoodsIssueEvents
};

// Run standalone if called directly
if (require.main === module) {
  processPendingGoodsIssueEvents()
    .then(() => {
      console.log('✅ Material issue auto handler completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Material issue auto handler failed:', error);
      process.exit(1);
    });
}
