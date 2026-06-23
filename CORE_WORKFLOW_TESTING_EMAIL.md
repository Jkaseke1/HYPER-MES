# HYPER MES Testing Guide - Core Workflows

**Production URL:** https://jkaseke1.github.io/HYPER-MES/

---

## Test User Credentials

| Username | Password | Role |
|----------|----------|------|
| `warehouse_mgr@hyperfeeds.com` | `Test123!` | Warehouse Manager (GRN, Dispatch) |
| `prod_mgr@hyperfeeds.com` | `Test123!` | Production Manager |
| `operator@hyperfeeds.com` | `Test123!` | Operator |
| `accountant@hyperfeeds.com` | `Test123!` | Accountant (GRN Approver) |

---

## 1. RAW MATERIAL RECEIVING (GRN)

**Who:** Warehouse Manager  
**Navigate to:** Goods Received

### Quick Steps:
1. Click **"+ New GRN"**
2. Enter GRN Number (e.g., GRN-2026-001)
3. Select Supplier
4. Select Warehouse
5. Set Received Date
6. Click **"+ Add Item"** for each material:
   - Select Material
   - Enter Ordered Qty
   - Enter Received Qty (can differ)
   - Enter Unit Cost
   - Enter Batch Number
7. Click **"Save GRN"** (Status: PENDING)

### What to Test:
- ✅ Can add multiple materials to one GRN
- ✅ Total value calculates correctly
- ✅ Variance shows when Ordered ≠ Received
- ✅ Batch numbers are unique

---

## 2. GRN APPROVAL

**Who:** Accountant  
**Navigate to:** Goods Received

### Quick Steps:
1. Find GRN with Status: PENDING
2. Click **"Approve"**
3. Status changes to APPROVED
4. Stock is updated automatically

### What to Test:
- ✅ Only accountant can approve
- ✅ Stock increases after approval
- ✅ Cannot edit approved GRN
- ✅ Audit trail shows who approved and when

---

## 3. PRODUCTION ORDER

**Who:** Production Manager  
**Navigate to:** Production → Production Orders

### Quick Steps:
1. Click **"+ New Order"**
2. Enter Batch Number
3. Select Formulation (must be ACTIVE)
4. Select Machine
5. Enter Planned Quantity
6. Select Operator
7. Materials auto-populate
8. Click **"Create Order"**

### What to Test:
- ✅ Materials auto-populate from formulation
- ✅ Cost calculates from raw material prices
- ✅ Status: PENDING

---

## 4. MATERIAL ISSUE

**Who:** Warehouse Manager  
**Navigate to:** Production Orders

### Quick Steps:
1. Find order with Status: PENDING
2. Click **"Issue Materials"**
3. Review material requirements
4. Click **"Confirm Issue"**
5. Status changes to MATERIALS ISSUED
6. Raw material stock decreases

### What to Test:
- ✅ Stock deduction happens immediately
- ✅ Cannot issue if insufficient stock
- ✅ Batch traceability maintained

---

## 5. PRODUCTION EXECUTION

**Who:** Operator  
**Navigate to:** Production Orders

### Quick Steps:
1. Find order with Status: MATERIALS ISSUED
2. Click **"Start Production"**
3. Status changes to IN PROGRESS
4. When done, click **"Record Output"**:
   - Enter Quantity Produced (e.g., 980 kg)
   - Enter Rejected Qty (e.g., 10 kg)
   - Enter Wastage (e.g., 10 kg)
   - Select Quality Status: Passed
   - Select Warehouse (Finished Goods)
5. Click **"Save Output"**
6. Click **"Complete"**
7. Status changes to COMPLETED

### What to Test:
- ✅ Variance calculation (Planned vs Actual)
- ✅ Finished goods stock increases
- ✅ Wastage tracked separately
- ✅ Cannot complete without recording output

---

## 6. DISPATCH ORDER

**Who:** Warehouse Manager  
**Navigate to:** Warehouse → Dispatch Orders

### Quick Steps:
1. Click **"+ New Dispatch"**
2. Enter Dispatch Number
3. Select Branch (destination)
4. Select Warehouse (source)
5. Enter Vehicle Number & Driver Name
6. Click **"+ Add Item"**:
   - Select Finished Good
   - Select Batch Number
   - Enter Quantity
   - Enter Unit Price
7. Click **"Save Dispatch"** (Status: PENDING)
8. Click **"Mark Dispatched"**
9. Status changes to DISPATCHED
10. Stock decreases

### What to Test:
- ✅ Can only select finished goods
- ✅ Batch traceability works
- ✅ Stock deduction on dispatch
- ✅ Total value calculates correctly

---

## END-TO-END TEST SCENARIO

**Complete Flow (30 minutes):**

### Step 1: Receive Raw Materials (5 min)
- Create GRN for Maize (500 kg), Soya (350 kg), Limestone (150 kg)
- Accountant approves GRN
- Verify stock updated

### Step 2: Create Production Order (5 min)
- Create order for "Broiler Starter" formulation (1000 kg)
- Materials auto-populate from formulation
- Issue materials (stock decreases)

### Step 3: Execute Production (10 min)
- Start production
- Record output: 980 kg produced, 10 kg rejected, 10 kg wastage
- Complete production
- Verify finished goods stock increased

### Step 4: Dispatch to Branch (5 min)
- Create dispatch for 500 kg to Bulawayo Branch
- Mark as dispatched
- Verify stock decreased

### Step 5: Verify Traceability (5 min)
- Trace batch from GRN → Production → Dispatch
- Check all stock movements recorded
- Verify audit trail complete

---

## COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| Cannot start production | Issue materials first |
| Stock going negative | Create GRN to receive materials |
| Formulation not showing | Activate formulation (change from DRAFT to ACTIVE) |
| Cannot approve GRN | Use accountant login |
| Batch not traceable | Ensure batch numbers entered at GRN stage |

---

## FEEDBACK TEMPLATE

**Tester Name:** _________________  
**Date:** _________________  
**Module Tested:** _________________

**Issues Found:**
1. _________________
2. _________________

**Suggestions:**
- _________________
- _________________

**Overall Experience:** ⭐⭐⭐⭐⭐ (1-5 stars)

---

## WHAT TO CHECK

✅ **Data Accuracy:** All calculations correct  
✅ **Stock Movements:** Increases/decreases as expected  
✅ **Status Workflow:** Logical progression through stages  
✅ **Batch Traceability:** Can track from supplier to customer  
✅ **User Permissions:** Right people can approve/edit  
✅ **Audit Trail:** All actions logged  

---

**Questions?** Check browser console (F12) for errors or contact system admin.

**Happy Testing! 🚀**
