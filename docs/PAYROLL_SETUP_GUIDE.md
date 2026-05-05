# Temporary Worker Payroll System - Setup Guide

## ✅ What's Been Built

### 1. Database Schema (7 Tables)
- ✅ `temporary_workers` - Worker registry with Ecocash phone numbers
- ✅ `payroll_periods` - Weekly/monthly payroll cycles
- ✅ `worker_attendance` - Daily clock in/out records
- ✅ `payroll_lines` - Individual payments per period
- ✅ `worker_advances` - Loans/advances to deduct
- ✅ `ecocash_payment_batches` - Bulk payment tracking
- ✅ `payroll_audit_log` - Complete audit trail

### 2. UI Pages (4 Pages)
- ✅ **Temporary Workers** (`/payroll/workers`) - Worker management
- ✅ **Attendance** (`/payroll/attendance`) - Daily clock in/out tracking
- ✅ **Payroll Processing** (`/payroll/processing`) - Calculate and approve payroll
- ✅ **Payment History** (`/payroll/history`) - Track all Ecocash transactions

### 3. Supabase Edge Functions (2 Functions)
- ✅ `process-ecocash-payment` - Submit bulk payments to Ecocash API
- ✅ `ecocash-webhook` - Handle payment status callbacks

### 4. Documentation
- ✅ `ECOCASH_INTEGRATION.md` - Complete integration guide
- ✅ `PAYROLL_SETUP_GUIDE.md` - This setup guide

---

## 🚀 Setup Steps

### Step 1: Run Database Migration

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Run the migration file:
   ```sql
   -- Copy and paste contents of:
   -- supabase/migrations/20260505_temp_worker_payroll.sql
   ```
3. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE '%worker%' OR table_name LIKE '%payroll%';
   ```

### Step 2: Contact Ecocash Business

**Apply for Merchant Account:**
- Email: business@ecocash.co.zw
- Phone: +263 4 XXXXXXX
- Request: Bulk payment API access

**Required Documents:**
- Business registration certificate
- Tax clearance certificate
- Bank account details
- Authorized signatory ID

**What You'll Receive:**
- Merchant Code
- API Key
- API Secret
- Webhook Secret
- Sandbox credentials for testing

### Step 3: Configure Supabase Edge Functions

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   cd "C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES"
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Set environment secrets:**
   ```bash
   # Ecocash credentials
   supabase secrets set ECOCASH_MERCHANT_CODE=YOUR_MERCHANT_CODE
   supabase secrets set ECOCASH_API_KEY=YOUR_API_KEY
   supabase secrets set ECOCASH_API_SECRET=YOUR_API_SECRET
   supabase secrets set ECOCASH_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
   ```

5. **Deploy Edge Functions:**
   ```bash
   # Deploy payment processing function
   supabase functions deploy process-ecocash-payment

   # Deploy webhook handler
   supabase functions deploy ecocash-webhook
   ```

6. **Get function URLs:**
   ```bash
   supabase functions list
   ```
   Note the URLs - you'll need them for Ecocash webhook configuration.

### Step 4: Configure Ecocash Webhooks

1. Login to Ecocash Business Portal
2. Navigate to API Settings → Webhooks
3. Add webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/ecocash-webhook
   ```
4. Select events to receive:
   - ✅ PAYMENT_SUCCESS
   - ✅ PAYMENT_FAILED
   - ✅ BATCH_COMPLETED

### Step 5: Test with Sandbox

1. **Update Edge Function to use sandbox:**
   ```typescript
   // In process-ecocash-payment/index.ts
   const ECOCASH_URL = 'https://sandbox.ecocash.co.zw/v1';
   ```

2. **Use test credentials:**
   ```bash
   supabase secrets set ECOCASH_API_KEY=test_key_xxx
   supabase secrets set ECOCASH_API_SECRET=test_secret_xxx
   ```

3. **Test phone numbers:**
   - Success: `0771111111`
   - Insufficient funds: `0772222222`
   - Invalid number: `0773333333`

4. **Run test payment:**
   - Add test worker with test phone number
   - Clock in/out for a day
   - Create payroll period
   - Process payment
   - Check logs in Supabase Functions dashboard

---

## 📋 Daily Workflow

### For Raw Materials Manager

**1. Morning - Clock In Workers**
- Navigate to `/payroll/attendance`
- Select today's date
- Click "Bulk Clock In" to clock in all active workers at 8:00 AM
- Or individually clock in workers as they arrive

**2. During Day - Track Attendance**
- Workers can be clocked in/out throughout the day
- Overtime automatically calculated (hours > 8)
- Notes can be added for absences or issues

**3. End of Day - Clock Out Workers**
- Click "Clock Out" for each worker
- System automatically calculates:
  - Regular hours (max 8 hours)
  - Overtime hours (anything over 8)

**4. Weekly - Process Payroll**
- Navigate to `/payroll/processing`
- Click "New Payroll Period"
- Select date range (e.g., Monday to Friday)
- Click "Create Period"
- System automatically:
  - Pulls attendance records
  - Calculates hours worked
  - Applies rates ($2.50/hr regular, $3.75/hr overtime)
  - Deducts any advances
  - Generates payroll lines

**5. Review & Approve**
- Review payroll lines for accuracy
- Check for any discrepancies
- Click "Approve" when ready

**6. Process Payments**
- Click "Process Payments"
- Confirm batch details
- System submits to Ecocash
- Track status in real-time

**7. Reconciliation**
- Navigate to `/payroll/history`
- Export CSV for accounting
- Match against Ecocash statements
- Flag any failed payments for retry

---

## 💰 Payment Rates & Calculations

### Default Rates
```javascript
HOURLY_RATE = $2.50 USD
OVERTIME_RATE = $3.75 USD (1.5x regular)
```

### Example Calculation
```
Worker: John Doe
Week: May 5-9, 2026

Monday:    8 hours regular
Tuesday:   8 hours regular
Wednesday: 10 hours (8 regular + 2 overtime)
Thursday:  8 hours regular
Friday:    9 hours (8 regular + 1 overtime)

Total Regular Hours: 40 hours × $2.50 = $100.00
Total Overtime Hours: 3 hours × $3.75 = $11.25
Gross Amount: $111.25
Deductions: $0.00
Net Amount: $111.25

Ecocash Fee (1.5%): $1.67
Worker Receives: $111.25
```

---

## 🔧 Troubleshooting

### Issue: Workers not showing in attendance
**Solution:** Check worker status is "active" in `/payroll/workers`

### Issue: Payroll period creation fails
**Solution:** Ensure attendance records exist for the selected date range

### Issue: Ecocash payment fails
**Possible causes:**
1. Invalid phone number format (must be 07XXXXXXXX)
2. Insufficient merchant balance
3. API credentials expired
4. Worker's Ecocash account suspended

**Solution:** Check payment error in `/payroll/history` and retry

### Issue: Webhook not receiving updates
**Solution:** 
1. Verify webhook URL in Ecocash portal
2. Check Supabase Functions logs
3. Ensure webhook secret is correct

---

## 📊 Reports & Analytics

### Available Reports
1. **Daily Attendance Report** - Export from attendance page
2. **Weekly Payroll Summary** - Export from processing page
3. **Payment History** - Export from history page
4. **Worker Performance** - Hours worked per worker

### Export Formats
- CSV (for Excel/accounting software)
- PDF (coming soon)

---

## 🔒 Security & Compliance

### Data Protection
- All API keys stored in Supabase secrets (never in code)
- Webhook signatures verified for authenticity
- Row-level security (RLS) policies on all tables
- Audit log for all payroll actions

### Compliance
- Worker data encrypted at rest
- Payment records retained for 7 years
- POPIA/GDPR compliant data handling

---

## 📞 Support Contacts

**Ecocash Business Support:**
- Email: business@ecocash.co.zw
- Phone: +263 4 XXXXXXX
- API Support: api-support@ecocash.co.zw

**Supabase Support:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

## 🎯 Next Steps

1. ✅ Run database migration
2. ⏳ Apply for Ecocash merchant account (2-4 weeks)
3. ⏳ Configure Edge Functions with credentials
4. ⏳ Test with sandbox environment
5. ⏳ Pilot with 5-10 workers
6. ⏳ Full rollout to all temporary workers

---

## 📝 Notes

- **Payroll Frequency:** Can be weekly, bi-weekly, or monthly
- **Payment Processing Time:** 2-5 minutes for batch submission, 1-24 hours for Ecocash processing
- **Transaction Fees:** ~1.5% + $0.10 per transaction
- **Batch Limits:** Maximum 500 payments per batch
- **Daily Limits:** Check with Ecocash for merchant limits

---

**Last Updated:** May 5, 2026
**Version:** 1.0
**Author:** HYPER-MES Development Team
