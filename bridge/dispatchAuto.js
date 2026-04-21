// dispatchAuto.js - Event 4: Dispatch Delivery Handler
// Reads from dispatch_orders + dispatch_items by reference_id from sync_log
// Posts to Sage Pastel as customer invoice/delivery note

const { supabase } = require('./lib/supabase');
const sageClient = require('./lib/sageClient');

async function handleDispatchDelivered(syncLogEntry) {
  try {
    console.log(`Processing dispatch delivery for sync_log ID: ${syncLogEntry.id}`);
    
    // Get dispatch order details with items
    const { data: dispatchOrder, error: orderError } = await supabase
      .from('dispatch_orders')
      .select(`
        *,
        branches(name, sage_code, address, contact_person, phone),
        warehouses(name),
        dispatch_items(
          *,
          formulations(name, code, sage_code, batch_unit)
        )
      `)
      .eq('id', syncLogEntry.reference_id)
      .single();

    if (orderError) {
      throw new Error(`Failed to fetch dispatch order: ${orderError.message}`);
    }

    if (!dispatchOrder) {
      throw new Error('Dispatch order not found');
    }

    // Validate required Sage codes
    if (!dispatchOrder.branches?.sage_code) {
      throw new Error(`Branch ${dispatchOrder.branches.name} missing sage_code`);
    }

    const invalidItems = dispatchOrder.dispatch_items.filter(item => !item.formulations?.sage_code);
    if (invalidItems.length > 0) {
      throw new Error(`${invalidItems.length} items missing sage_code: ${invalidItems.map(i => i.formulations.name).join(', ')}`);
    }

    // Prepare Sage transaction data for customer invoice
    const sageTransaction = {
      transactionType: 'CUSTOMER_INVOICE',
      transactionDate: dispatchOrder.delivered_at || new Date().toISOString().split('T')[0],
      reference: `DISPATCH-${dispatchOrder.dispatch_number}`,
      customer: {
        code: dispatchOrder.branches.sage_code,
        name: dispatchOrder.branches.name,
        address: dispatchOrder.branches.address,
        contactPerson: dispatchOrder.branches.contact_person,
        phone: dispatchOrder.branches.phone
      },
      lines: dispatchOrder.dispatch_items.map(item => ({
        stockCode: item.formulations.sage_code,
        description: `${item.formulations.name} - ${item.batch_number || 'No Batch'}`,
        quantity: item.quantity,
        unit: item.formulations.batch_unit || 'kg',
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        batchNumber: item.batch_number,
        formulation: item.formulations.name
      })),
      totalAmount: dispatchOrder.total_value,
      totalWeight: dispatchOrder.total_weight,
      vehicle: dispatchOrder.vehicle_number,
      driver: dispatchOrder.driver_name,
      warehouse: dispatchOrder.warehouses?.name || 'Main Warehouse',
      notes: `Dispatch ${dispatchOrder.dispatch_number} to ${dispatchOrder.branches.name} - ${dispatchOrder.delivery_notes || 'Auto-posted from MES'}`,
      deliveryDate: dispatchOrder.delivered_at,
      preparedBy: dispatchOrder.prepared_by,
      approvedBy: dispatchOrder.approved_by
    };

    console.log(`Posting dispatch delivery to Sage: ${JSON.stringify(sageTransaction, null, 2)}`);

    // Post to Sage Pastel as customer invoice/delivery note
    const sageResponse = await sageClient.postCustomerInvoice(sageTransaction);

    // Update sync log with success
    await supabase
      .from('sync_log')
      .update({
        status: 'success',
        message: `Dispatch ${dispatchOrder.dispatch_number} to ${dispatchOrder.branches.name} posted to Sage successfully`,
        sage_response: sageResponse,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLogEntry.id);

    console.log(`✅ Dispatch ${dispatchOrder.dispatch_number} successfully posted to Sage`);
    return sageResponse;

  } catch (error) {
    console.error(`❌ Error processing dispatch delivery:`, error);
    
    // Update sync log with error
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        message: `Failed to post dispatch to Sage: ${error.message}`,
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

// Process all pending dispatch delivery events
async function processPendingDispatchEvents() {
  try {
    console.log('🔍 Checking for pending dispatch delivery events...');
    
    const { data: pendingEvents, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('event_type', 'dispatch_delivered')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process in batches

    if (error) {
      throw new Error(`Failed to fetch pending events: ${error.message}`);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      console.log('✅ No pending dispatch delivery events found');
      return;
    }

    console.log(`📦 Found ${pendingEvents.length} pending dispatch delivery events`);

    // Process each event
    for (const event of pendingEvents) {
      try {
        await handleDispatchDelivered(event);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error.message);
        // Continue with next event
      }
    }

    console.log('✅ Dispatch delivery events processing complete');

  } catch (error) {
    console.error('❌ Error in processPendingDispatchEvents:', error);
  }
}

// Export for use in bridge worker
module.exports = {
  handleDispatchDelivered,
  processPendingDispatchEvents
};

// Run standalone if called directly
if (require.main === module) {
  processPendingDispatchEvents()
    .then(() => {
      console.log('✅ Dispatch auto handler completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Dispatch auto handler failed:', error);
      process.exit(1);
    });
}
