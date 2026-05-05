// Supabase Edge Function for processing Ecocash bulk payments
// Deploy: supabase functions deploy process-ecocash-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentLine {
  id: string;
  worker_id: string;
  net_amount: number;
  ecocash_number: string;
  temporary_workers: {
    full_name: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { payrollPeriodId } = await req.json();

    if (!payrollPeriodId) {
      throw new Error('payrollPeriodId is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get pending payment lines
    const { data: lines, error: linesError } = await supabase
      .from('payroll_lines')
      .select('*, temporary_workers(full_name)')
      .eq('payroll_period_id', payrollPeriodId)
      .eq('payment_status', 'pending');

    if (linesError) throw linesError;
    if (!lines || lines.length === 0) {
      throw new Error('No pending payments found');
    }

    // 2. Get Ecocash access token
    const tokenResponse = await fetch('https://api.ecocash.co.zw/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: Deno.env.get('ECOCASH_API_KEY'),
        client_secret: Deno.env.get('ECOCASH_API_SECRET'),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Ecocash token: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json();

    // 3. Create batch payment request
    const batchId = `HYPER-${Date.now()}`;
    const payments = (lines as PaymentLine[]).map((line) => ({
      recipientPhone: line.ecocash_number,
      amount: line.net_amount,
      reference: `Payroll ${payrollPeriodId.slice(0, 8)} - ${line.temporary_workers.full_name}`,
    }));

    // 4. Submit to Ecocash API
    const paymentResponse = await fetch('https://api.ecocash.co.zw/v1/bulk-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantCode: Deno.env.get('ECOCASH_MERCHANT_CODE'),
        batchId,
        payments,
      }),
    });

    if (!paymentResponse.ok) {
      throw new Error(`Ecocash API error: ${paymentResponse.statusText}`);
    }

    const result = await paymentResponse.json();

    // 5. Create batch record in database
    const { error: batchError } = await supabase
      .from('ecocash_payment_batches')
      .insert({
        payroll_period_id: payrollPeriodId,
        batch_number: batchId,
        total_payments: payments.length,
        total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
        status: 'processing',
        ecocash_batch_id: result.batchId || batchId,
      });

    if (batchError) throw batchError;

    // 6. Update payment lines to processing
    const { error: updateError } = await supabase
      .from('payroll_lines')
      .update({ payment_status: 'processing' })
      .in('id', lines.map((l) => l.id));

    if (updateError) throw updateError;

    // 7. Log audit trail
    await supabase.from('payroll_audit_log').insert({
      payroll_period_id: payrollPeriodId,
      action: 'ecocash_batch_submitted',
      new_value: { batch_id: batchId, total_payments: payments.length },
      notes: `Submitted ${payments.length} payments to Ecocash`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
