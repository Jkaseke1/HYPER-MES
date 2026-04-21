// goodsReceiptAuto.js - Event 1: GRN Confirmation Handler
// Reads from goods_received_notes + grn_items by reference_id from sync_log
// Posts to Sage Pastel as supplier invoice/stock receipt

const { supabase } = require('./lib/supabase');
const sageClient = require('./lib/sageClient');

async function handleGoodsReceiptConfirmed(syncLogEntry) {
  try {
    console.log(`Processing GRN confirmation for sync_log ID: ${syncLogEntry.id}`);
    
    // Get GRN details with all related data
    const { data: grn, error: grnError } = await supabase
      .from('goods_received_notes')
      .select(`
        *,
        suppliers(name, sage_code),
        warehouses(name),
        grn_items(
          *,
          raw_materials(name, code, sage_code)
        )
      `)
      .eq('id', syncLogEntry.reference_id)
      .single();

    if (grnError) {
      throw new Error(`Failed to fetch GRN: ${grnError.message}`);
    }

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Validate required Sage codes
    if (!grn.suppliers?.sage_code) {
      throw new Error(`Supplier ${grn.suppliers.name} missing sage_code`);
    }

    const invalidItems = grn.grn_items.filter(item => !item.raw_materials?.sage_code);
    if (invalidItems.length > 0) {
      throw new Error(`${invalidItems.length} items missing sage_code: ${invalidItems.map(i => i.raw_materials.name).join(', ')}`);
    }

    // Prepare Sage transaction data
    const sageTransaction = {
      transactionType: 'SUPPLIER_INVOICE',
      supplierCode: grn.suppliers.sage_code,
      transactionDate: grn.received_date,
      reference: grn.grn_number,
      lines: grn.grn_items.map(item => ({
        stockCode: item.raw_materials.sage_code,
        description: item.raw_materials.name,
        quantity: item.received_qty,
        unitPrice: item.unit_cost,
        batchNumber: item.batch_number,
        expiryDate: item.expiry_date || null,
        lineTotal: item.line_total
      })),
      totalAmount: grn.total_value,
      warehouse: grn.warehouses.name,
      notes: grn.notes || `GRN ${grn.grn_number} auto-posted from MES`
    };

    console.log(`Posting to Sage: ${JSON.stringify(sageTransaction, null, 2)}`);

    // Post to Sage Pastel
    const sageResponse = await sageClient.postSupplierInvoice(sageTransaction);

    // Update sync log with success
    await supabase
      .from('sync_log')
      .update({
        status: 'success',
        message: `GRN ${grn.grn_number} posted to Sage successfully`,
        sage_response: sageResponse,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLogEntry.id);

    console.log(`✅ GRN ${grn.grn_number} successfully posted to Sage`);
    return sageResponse;

  } catch (error) {
    console.error(`❌ Error processing GRN confirmation:`, error);
    
    // Update sync log with error
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        message: `Failed to post GRN to Sage: ${error.message}`,
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

// Process all pending GRN confirmation events
async function processPendingGoodsReceiptEvents() {
  try {
    console.log('🔍 Checking for pending GRN confirmation events...');
    
    const { data: pendingEvents, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('event_type', 'grn_confirmed')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process in batches

    if (error) {
      throw new Error(`Failed to fetch pending events: ${error.message}`);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      console.log('✅ No pending GRN confirmation events found');
      return;
    }

    console.log(`📦 Found ${pendingEvents.length} pending GRN confirmation events`);

    // Process each event
    for (const event of pendingEvents) {
      try {
        await handleGoodsReceiptConfirmed(event);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error.message);
        // Continue with next event
      }
    }

    console.log('✅ GRN confirmation events processing complete');

  } catch (error) {
    console.error('❌ Error in processPendingGoodsReceiptEvents:', error);
  }
}

// Export for use in bridge worker
module.exports = {
  handleGoodsReceiptConfirmed,
  processPendingGoodsReceiptEvents
};

// Run standalone if called directly
if (require.main === module) {
  processPendingGoodsReceiptEvents()
    .then(() => {
      console.log('✅ GRN auto handler completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ GRN auto handler failed:', error);
      process.exit(1);
    });
}
