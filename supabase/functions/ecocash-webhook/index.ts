// Supabase Edge Function for handling Ecocash webhook callbacks
// Deploy: supabase functions deploy ecocash-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ecocash-signature',
};

function verifySignature(payload: any, signature: string): boolean {
  const secret = Deno.env.get('ECOCASH_WEBHOOK_SECRET')!;
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('X-Ecocash-Signature');
    const payload = await req.json();

    // Verify webhook signature for security
    if (!signature || !verifySignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Received Ecocash webhook:', payload);

    // Handle different webhook event types
    switch (payload.eventType) {
      case 'PAYMENT_SUCCESS':
      case 'PAYMENT_FAILED':
        await handlePaymentStatus(supabase, payload);
        break;
      
      case 'BATCH_COMPLETED':
        await handleBatchCompleted(supabase, payload);
        break;
      
      default:
        console.log('Unknown event type:', payload.eventType);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
});

async function handlePaymentStatus(supabase: any, payload: any) {
  const { payment } = payload;
  
  // Update individual payment status
  const { error } = await supabase
    .from('payroll_lines')
    .update({
      payment_status: payment.status === 'SUCCESS' ? 'paid' : 'failed',
      ecocash_transaction_id: payment.transactionId,
      payment_date: payment.status === 'SUCCESS' ? new Date().toISOString() : null,
      payment_error: payment.errorMessage || null,
    })
    .eq('ecocash_number', payment.recipientPhone)
    .eq('payment_status', 'processing');

  if (error) {
    console.error('Error updating payment status:', error);
  } else {
    console.log(`Payment ${payment.transactionId} status: ${payment.status}`);
  }
}

async function handleBatchCompleted(supabase: any, payload: any) {
  const { batchId, successCount, failureCount, payments } = payload;

  // Update batch status
  const { error: batchError } = await supabase
    .from('ecocash_payment_batches')
    .update({
      status: 'completed',
      successful_payments: successCount,
      failed_payments: failureCount,
      completed_at: new Date().toISOString(),
    })
    .eq('ecocash_batch_id', batchId);

  if (batchError) {
    console.error('Error updating batch:', batchError);
  }

  // Update individual payment statuses
  for (const payment of payments) {
    await handlePaymentStatus(supabase, { payment });
  }

  console.log(`Batch ${batchId} completed: ${successCount} success, ${failureCount} failed`);
}
