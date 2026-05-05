# Ecocash Integration for Temporary Worker Payroll

## Overview
This document outlines the integration between HYPER-MES and Ecocash for automated bulk payments to temporary production workers.

## Ecocash API Options

### 1. Ecocash Business API (Recommended)
**Endpoint:** `https://api.ecocash.co.zw/`

**Features:**
- Bulk payment processing
- Real-time transaction status
- Payment reconciliation
- Transaction history

**Authentication:**
- API Key + Secret
- OAuth 2.0 token-based

### 2. USSD Integration (Alternative)
- Automated USSD session handling
- Less reliable but no API costs
- Requires SMS gateway integration

## Implementation Architecture

```
HYPER-MES (React App)
    ↓
Supabase Edge Function (Secure API calls)
    ↓
Ecocash Business API
    ↓
Worker Ecocash Wallets
```

## Required Credentials

1. **Ecocash Merchant Account**
   - Business registration
   - Merchant code
   - API credentials

2. **API Keys (from Ecocash)**
   - `ECOCASH_MERCHANT_CODE`
   - `ECOCASH_API_KEY`
   - `ECOCASH_API_SECRET`
   - `ECOCASH_CALLBACK_URL`

## Payment Flow

### Step 1: Payroll Calculation
```sql
-- Calculate payroll for period
SELECT 
  w.id,
  w.full_name,
  w.phone_number,
  SUM(a.hours_worked) as total_hours,
  SUM(a.overtime_hours) as overtime_hours,
  (SUM(a.hours_worked) * 2.50) + (SUM(a.overtime_hours) * 3.75) as gross_amount
FROM temporary_workers w
JOIN worker_attendance a ON w.id = a.worker_id
WHERE a.work_date BETWEEN '2026-05-01' AND '2026-05-07'
GROUP BY w.id;
```

### Step 2: Create Payment Batch
```javascript
// Create Ecocash payment batch
const batch = {
  merchantCode: process.env.ECOCASH_MERCHANT_CODE,
  batchId: `PAY-${Date.now()}`,
  payments: [
    {
      recipientPhone: '0771234567',
      amount: 125.50,
      reference: 'Week 18 Payroll - John Doe'
    },
    // ... more payments
  ]
};
```

### Step 3: Submit to Ecocash
```javascript
const response = await fetch('https://api.ecocash.co.zw/v1/bulk-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(batch)
});
```

### Step 4: Track Status
```javascript
// Poll for payment status
const status = await fetch(`https://api.ecocash.co.zw/v1/batch/${batchId}/status`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Update database with results
await supabase
  .from('payroll_lines')
  .update({ 
    payment_status: 'paid',
    ecocash_transaction_id: txnId,
    payment_date: new Date()
  })
  .eq('id', lineId);
```

## Supabase Edge Function Example

```typescript
// supabase/functions/process-ecocash-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { payrollPeriodId } = await req.json();
  
  // 1. Get payment lines
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data: lines } = await supabase
    .from('payroll_lines')
    .select('*, temporary_workers(phone_number, full_name)')
    .eq('payroll_period_id', payrollPeriodId)
    .eq('payment_status', 'pending');
  
  // 2. Get Ecocash access token
  const tokenResponse = await fetch('https://api.ecocash.co.zw/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: Deno.env.get('ECOCASH_API_KEY'),
      client_secret: Deno.env.get('ECOCASH_API_SECRET')
    })
  });
  
  const { access_token } = await tokenResponse.json();
  
  // 3. Create batch payment
  const batchId = `HYPER-${Date.now()}`;
  const payments = lines.map(line => ({
    recipientPhone: line.temporary_workers.phone_number,
    amount: line.net_amount,
    reference: `Payroll ${line.payroll_period_id.slice(0, 8)} - ${line.temporary_workers.full_name}`
  }));
  
  // 4. Submit to Ecocash
  const paymentResponse = await fetch('https://api.ecocash.co.zw/v1/bulk-payment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      merchantCode: Deno.env.get('ECOCASH_MERCHANT_CODE'),
      batchId,
      payments
    })
  });
  
  const result = await paymentResponse.json();
  
  // 5. Create batch record
  await supabase.from('ecocash_payment_batches').insert({
    payroll_period_id: payrollPeriodId,
    batch_number: batchId,
    total_payments: payments.length,
    total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
    status: 'processing',
    ecocash_batch_id: result.batchId
  });
  
  // 6. Update payment lines
  await supabase
    .from('payroll_lines')
    .update({ payment_status: 'processing' })
    .in('id', lines.map(l => l.id));
  
  return new Response(JSON.stringify({ success: true, batchId }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

## Webhook Handler for Status Updates

```typescript
// supabase/functions/ecocash-webhook/index.ts
serve(async (req) => {
  const signature = req.headers.get('X-Ecocash-Signature');
  const payload = await req.json();
  
  // Verify webhook signature
  const isValid = verifySignature(payload, signature);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Update payment status
  for (const payment of payload.payments) {
    await supabase
      .from('payroll_lines')
      .update({
        payment_status: payment.status === 'SUCCESS' ? 'paid' : 'failed',
        ecocash_transaction_id: payment.transactionId,
        payment_date: payment.status === 'SUCCESS' ? new Date() : null,
        payment_error: payment.errorMessage
      })
      .eq('ecocash_number', payment.recipientPhone)
      .eq('payment_status', 'processing');
  }
  
  return new Response('OK', { status: 200 });
});
```

## Security Considerations

1. **Never store API keys in frontend code**
   - Use Supabase Edge Functions
   - Store credentials in Supabase secrets

2. **Validate webhook signatures**
   - Verify all incoming webhooks from Ecocash
   - Use HMAC-SHA256 validation

3. **Implement rate limiting**
   - Prevent abuse of payment endpoints
   - Maximum batch size limits

4. **Audit trail**
   - Log all payment attempts
   - Track who initiated payments

## Testing

### Sandbox Environment
```javascript
const ECOCASH_SANDBOX_URL = 'https://sandbox.ecocash.co.zw/v1';

// Test credentials (from Ecocash developer portal)
const TEST_MERCHANT_CODE = 'TEST123';
const TEST_API_KEY = 'test_key_xxx';
```

### Test Phone Numbers
- Success: `0771111111`
- Insufficient funds: `0772222222`
- Invalid number: `0773333333`

## Reconciliation

Daily reconciliation process:
1. Download Ecocash transaction report
2. Match against `payroll_lines` table
3. Flag discrepancies
4. Generate reconciliation report

## Cost Estimation

**Ecocash Transaction Fees:**
- Per transaction: ~1.5% + $0.10
- Bulk payment discount: Available for >100 transactions
- Monthly API fee: ~$50

**Example:**
- 50 workers × $100 average = $5,000 total
- Fees: (50 × $0.10) + ($5,000 × 0.015) = $5 + $75 = $80
- Cost per worker: $1.60

## Alternative: Batch File Upload

If API integration is too complex initially:

1. Export CSV from HYPER-MES
2. Upload to Ecocash Business Portal
3. Manual approval and processing
4. Import transaction results back to system

## Next Steps

1. **Contact Ecocash Business**
   - Apply for merchant account
   - Request API access
   - Get sandbox credentials

2. **Set up Supabase Edge Functions**
   - Deploy payment processing function
   - Configure webhook handler
   - Add environment variables

3. **Build UI**
   - Worker management page
   - Attendance tracking
   - Payroll processing dashboard
   - Payment history

4. **Testing**
   - Test with sandbox
   - Pilot with small group
   - Full rollout

## Support Contacts

- **Ecocash Business Support:** business@ecocash.co.zw
- **API Technical Support:** api-support@ecocash.co.zw
- **Phone:** +263 4 XXXXXXX
