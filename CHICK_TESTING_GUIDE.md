# Chick Management Testing Guide

**Production URL:** https://jkaseke1.github.io/HYPER-MES/

## Test User Credentials

| Role | Username | Password | Responsibilities |
|------|----------|----------|------------------|
| Raw Material Manager | `raw_mat_mgr@hyperfeeds.com` | `Test123!` | Create & approve Purchase Orders |
| Production Manager | `prod_mgr@hyperfeeds.com` | `Test123!` | Hatch Night Intake, Consignment creation |
| Warehouse Manager (Dispatch) | `warehouse_mgr@hyperfeeds.com` | `Test123!` | Delivery Declaration |
| Operator (Weigh Bridge) | `operator@hyperfeeds.com` | `Test123!` | Delivery Declaration (weigh-in) |
| Accountant | `accountant@hyperfeeds.com` | `Test123!` | Invoice Capture, Verification, GRN approval |

---

## Module 1: Purchase Orders

**Who:** Raw Material Manager  
**Navigate to:** Chick Hub → Purchase Orders

### Test Steps:
1. **Create New PO**
   - Click "+ New Purchase Order"
   - Select Supplier (e.g., Irvine's)
   - Select Chick Type (STANDARD or HUBBARD)
   - Set Expected Delivery Date
   - Add PO Lines:
     - Select Branch (e.g., HO, BWY, MUT)
     - Enter Booked Qty (e.g., 1000)
     - Enter Wish Qty (e.g., 1200)
     - Select Delivery Type (LOCAL or BRANCH)
   - Click "Save Draft"

2. **Submit for Approval**
   - Find your draft PO in the list
   - Click "Submit for Approval"
   - Status changes to "PENDING APPROVAL"

3. **Approve PO**
   - Find pending PO
   - Click "Approve"
   - Status changes to "APPROVED"

### What to Check:
- ✅ Can add multiple PO lines for different branches
- ✅ Total quantities calculate correctly
- ✅ Cannot approve your own PO (should require different user)
- ✅ Status workflow: DRAFT → PENDING APPROVAL → APPROVED

---

## Module 2: Hatch Night Intake

**Who:** Production Manager  
**Navigate to:** Chick Hub → Hatch Night Intake

### Test Steps:
1. **Select Hatch Date**
   - Pick a date (e.g., today or tomorrow)
   - System loads approved POs

2. **Define Supplier Sections**
   - Click "+ Add Supplier Section"
   - Select Supplier
   - Select Chick Type
   - Enter Allocated Qty (total chicks for this supplier)
   - Click "Add Section"

3. **Create Consignment & Delivery Notes**
   - Review sections
   - Click "Create Consignment & DNotes"
   - System generates:
     - 1 Consignment record
     - Multiple Delivery Notes (one per PO line/branch)

4. **Confirm Hatch Night**
   - Click "Confirm Hatch Night"
   - Status changes to CONFIRMED

### What to Check:
- ✅ Can add multiple supplier sections
- ✅ Delivery notes auto-generate for each branch
- ✅ DNotes show correct branch codes and allocated quantities
- ✅ Cannot modify after confirmation

---

## Module 3: Delivery Declaration

**Who:** Warehouse Manager / Operator  
**Navigate to:** Chick Hub → Delivery Declaration

### Test Steps:
1. **View Pending Deliveries**
   - See list of delivery notes awaiting declaration
   - Filter by LOCAL or BRANCH
   - Search by branch code, dnote number, or supplier

2. **Declare Individual Delivery**
   - Click "Declare" on a delivery note
   - Enter Received Quantity (can differ from allocated)
   - System calculates variance
   - Click "Save Declaration"

3. **Bulk Declare (LOCAL only)**
   - Select multiple LOCAL deliveries (checkboxes)
   - Click "Bulk Declare"
   - Enter received quantities for each
   - Click "Save All"

### What to Check:
- ✅ Variance calculation (Allocated - Received)
- ✅ Can only bulk declare LOCAL deliveries
- ✅ Search filters work correctly
- ✅ Declared deliveries disappear from pending list

---

## Module 4: Invoice Capture

**Who:** Accountant  
**Navigate to:** Chick Hub → Invoice Capture

### Test Steps:
1. **View Consignments**
   - See consignments with delivery notes
   - Filter by status (NO INVOICE, CAPTURED, VERIFIED, POSTED)

2. **Capture Invoice**
   - Click "Capture Invoice" on a consignment
   - Enter Invoice Number
   - Enter Invoice Date
   - Enter Invoice Amount
   - Enter Quantity Invoiced
   - System calculates Unit Cost
   - Add Notes (optional)
   - Click "Save Invoice"

3. **Verify Invoice**
   - Find captured invoice
   - Click "Verify"
   - Status changes to VERIFIED
   - Payment alert is triggered

4. **Mark as Posted to Sage**
   - Click "Mark Posted"
   - Enter Sage Posting Reference (e.g., JNL-001)
   - Status changes to POSTED
   - PO status updates to INVOICED

5. **Generate Sage Worksheet**
   - Click "Generate Sage Worksheet"
   - Excel file downloads with posting details

### What to Check:
- ✅ Unit cost auto-calculates (Amount ÷ Quantity)
- ✅ Cannot verify your own captured invoice
- ✅ Payment alert creates record in `chick_payment_alerts`
- ✅ PO status updates correctly
- ✅ Sage worksheet contains correct data

---

## Module 5: Reconciliation

**Who:** Accountant / Raw Material Manager  
**Navigate to:** Chick Hub → Reconciliation

### Test Steps:
1. **Ordered vs Received Tab**
   - View PO lines vs actual deliveries
   - Check variance columns
   - Filter by branch

2. **Unprocessed GRVs Tab**
   - See deliveries without invoices
   - Identify pending invoice captures

3. **Unmatched Sales Tab**
   - (Future: Sage sales data import)
   - View sales not matched to deliveries

4. **Margins Tab**
   - View cost vs revenue per delivery
   - Check margin percentages

### What to Check:
- ✅ Data matches across modules
- ✅ Variances are accurate
- ✅ Can export data for further analysis

---

## End-to-End Test Scenario

**Complete Workflow:**

1. **Raw Material Manager:**
   - Create PO for 5000 chicks (3 branches)
   - Submit for approval
   - Approve PO

2. **Production Manager:**
   - Create hatch night for tomorrow
   - Add supplier section (5000 chicks)
   - Generate consignment & delivery notes
   - Confirm hatch night

3. **Warehouse Manager:**
   - Declare deliveries as they arrive
   - Enter actual received quantities
   - Note any variances

4. **Accountant:**
   - Capture supplier invoice
   - Verify invoice
   - Mark as posted to Sage
   - Generate Sage worksheet

5. **All Users:**
   - Check Reconciliation page
   - Verify data accuracy across all tabs

---

## Common Challenges & Solutions

### Challenge 1: PO Not Showing in Hatch Night
**Cause:** PO status is not APPROVED  
**Solution:** Ensure PO is approved before creating hatch night

### Challenge 2: Cannot Verify Invoice
**Cause:** Same user captured and trying to verify  
**Solution:** Use different user account for verification

### Challenge 3: Delivery Notes Not Generated
**Cause:** No PO lines exist for the supplier/chick type  
**Solution:** Create PO with correct supplier and chick type first

### Challenge 4: Bulk Declare Not Working
**Cause:** Selected BRANCH deliveries (only LOCAL allowed)  
**Solution:** Filter to LOCAL only and select those

---

## Feedback Template

**Module Tested:** _________________  
**User Role:** _________________  
**Date:** _________________

**What Worked Well:**
- 
- 

**Issues Found:**
1. **Issue:** _________________  
   **Steps to Reproduce:** _________________  
   **Expected:** _________________  
   **Actual:** _________________

2. **Issue:** _________________  
   **Steps to Reproduce:** _________________  
   **Expected:** _________________  
   **Actual:** _________________

**Suggestions for Improvement:**
- 
- 

**Overall Rating:** ⭐⭐⭐⭐⭐ (1-5 stars)

---

## Cross-Functional Testing Scenarios

### Scenario 1: Rush Order
- Create and approve PO in same day
- Immediate hatch night intake
- Same-day delivery declaration
- Invoice capture within 24 hours

### Scenario 2: Variance Investigation
- Create PO for 10,000 chicks
- Declare only 9,500 received (500 variance)
- Track variance through reconciliation
- Document reason for shortage

### Scenario 3: Multi-Branch Delivery
- Create PO with 5 different branches
- Stagger delivery declarations
- Track which branches received vs pending
- Ensure all branches accounted for

### Scenario 4: Invoice Discrepancy
- Supplier invoices for 10,000 chicks
- Only 9,800 received and declared
- Capture invoice with actual received qty
- Note discrepancy in invoice notes

---

## Success Criteria

After testing, the system should:

✅ **Accurate Data Flow:** PO → Hatch Night → Delivery → Invoice → Reconciliation  
✅ **Variance Tracking:** All discrepancies captured and visible  
✅ **Role Separation:** Different users for capture vs approval  
✅ **Audit Trail:** All actions logged with user and timestamp  
✅ **Search & Filter:** Easy to find specific records  
✅ **Status Workflow:** Clear progression through stages  
✅ **Sage Integration:** Correct data in export worksheet  

---

## Need Help?

- **Technical Issues:** Check browser console (F12) for errors
- **Data Issues:** Verify in Supabase dashboard
- **Workflow Questions:** Refer to this guide or ask system admin
- **Bug Reports:** Use feedback template above

**Happy Testing! 🐣**
