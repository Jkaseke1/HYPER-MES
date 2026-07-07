# Production & Manufacturing Testing Guide
## Module 1: Formulations (Bill of Materials)

**Who:** Production Manager  
**Navigate to:** Formulations

### Test Steps:
1. **Create New Formulation** SKIP TO PRODUCTION PLAN IF THERE ARE EXISTING FORMULAS
   - Click "+ New Formulation"
   - Enter Name (e.g., "Broiler Starter 22%")
   - Enter Code (e.g., "FORM-BS-001")
   - Set Version: 1
   - Select Category (Broiler/Layer/Grower)
   - Enter Batch Size: 1000
   - Select Batch Unit: kg
   - Set Nutritional Targets:
     - Protein: 22%
     - Fat: 5%
     - Fiber: 3%
     - Moisture: 12%

2. **Add Ingredients**
   - Click "+ Add Ingredient"
   - Select Raw Material (e.g., Maize Meal)
   - Enter Quantity: 500
   - Enter Percentage: 50%
   - Mark as Critical (if essential)
   - Repeat for all ingredients
   - **Ensure total = 100%**

3. **Save & Activate**
   - Click "Save Formula" (Draft status)
   - Click "Activate" to make available for production

### What to Check:
- ✅ Percentage must total exactly 100%
- ✅ Cost auto-calculates from raw material prices
- ✅ Can create multiple versions (v1, v2, v3)
- ✅ Only ACTIVE formulations show in production orders

---

## Module 2: Production Plans

**Who:** Production Manager  
**Navigate to:** Production → Production Plans

### Test Steps:
1. **Create Production Plan**
   - Click "+ New Plan"
   - Enter Plan Number (auto-generated or manual)
   - Set Plan Date (today)
   - Set Start Date & End Date (date range)
   - Status: Draft

2. **Add Plan Items**
   - Click "+ Add Item"
   - Select Formulation (only ACTIVE ones appear)
   - Enter Planned Quantity (e.g., 5000 kg)
   - Set Priority (High/Normal/Low)
   - Add more items as needed

3. **Confirm Plan**
   - Review all items
   - Click "Confirm Plan"
   - Status changes to CONFIRMED

### What to Check:
- ✅ Can add multiple formulations to one plan
- ✅ Total quantities calculate correctly
- ✅ Date validation (end date > start date)
- ✅ Status workflow: DRAFT → CONFIRMED → IN PROGRESS → COMPLETED

---

## Module 3: Production Orders

**Who:** Production Manager / Supervisor  
**Navigate to:** Production → Production Orders

### Test Steps:
1. **Create Production Order**
   - Click "+ New Order"
   - Enter Batch Number (e.g., "BATCH-001")
   - Select Production Plan (optional)
   - Select Formulation
   - Select Machine
   - Enter Planned Quantity (e.g., 1000 kg)
   - Set Priority
   - Set Planned Start & End times
   - Select Operator
   - Materials auto-populate from formulation

2. **Issue Materials**
   - Find order in list (Status: PENDING)
   - Click "Issue Materials"
   - Review material requirements
   - Confirm issuance
   - Status changes to MATERIALS ISSUED

3. **Start Production**
   - Click "Start Production"
   - Status changes to IN PROGRESS
   - Production timer starts

4. **Record Output**
   - Click "Record Output"
   - Enter Quantity Produced (e.g., 980 kg)
   - Enter Rejected Quantity (e.g., 10 kg)
   - Enter Wastage (e.g., 10 kg)
   - Select Quality Status (Passed/Failed)
   - Select Warehouse (Finished Goods)
   - Add Notes (optional)
   - Click "Save Output"

5. **Complete Production**
   - Click "Complete"
   - Status changes to COMPLETED
   - Stock movements recorded

### What to Check:
- ✅ Materials auto-populate from formulation
- ✅ Cannot start without issuing materials
- ✅ Variance calculation (Planned vs Actual)
- ✅ Stock deduction for raw materials
- ✅ Stock addition for finished goods
- ✅ Wastage tracking
- ✅ Status workflow: PENDING → MATERIALS ISSUED → IN PROGRESS → COMPLETED

---

## Module 4: Production Logs

**Who:** Operator / Supervisor  
**Navigate to:** Production Orders → [Select Order] → Logs Tab

### Test Steps:
1. **Add Production Log**
   - Click "+ Add Log"
   - Select Type:
     - **Start:** Production started
     - **Pause:** Temporary stop (break, maintenance)
     - **Issue:** Problem encountered
     - **Stop:** Production ended
   - Enter Description
   - Set Time/Duration
   - Click "Save Log"

2. **Track Downtime**
   - Add PAUSE log with start time
   - Add reason (e.g., "Machine maintenance")
   - Record end time
   - System calculates duration

### What to Check:
- ✅ Timeline view of all events
- ✅ Downtime calculations accurate
- ✅ Issue documentation complete
- ✅ Audit trail maintained

---

## Module 5: Macropack Manufacturing

**Who:** Production Manager / Operator  
**Navigate to:** Production → Macropack Manufacturing

### Test Steps:
1. **View BOMs Tab**
   - See all macropack formulations
   - Check ingredient lists
   - Review costs

2. **Create Macropack Order (Orders Tab)**
   - Click "+ New Order"
   - Select Macropack BOM
   - Enter Batch Number
   - Enter Planned Quantity
   - Select Machine
   - Set Planned Start/End
   - Click "Create Order"

3. **Dispense Ingredients**
   - Find order in list
   - Click "Dispense"
   - Review ingredient requirements
   - Enter Actual Dispensed quantities
   - System calculates variance
   - Click "Save Dispensing"

4. **Complete Manufacturing**
   - Click "Complete"
   - Enter Actual Output
   - Record wastage (if any)
   - Status changes to COMPLETED

### What to Check:
- ✅ Ingredient variance tracking
- ✅ Stock deduction for ingredients
- ✅ Stock addition for finished macropacks
- ✅ Cost calculations accurate

---

## Module 6: Warehouse & Dispatch

**Who:** Warehouse Manager  
**Navigate to:** Warehouse → Dispatch Orders

### Test Steps:
1. **Create Dispatch Order**
   - Click "+ New Dispatch"
   - Enter Dispatch Number
   - Select Branch (destination)
   - Select Warehouse (source)
   - Set Dispatch Date
   - Enter Vehicle Number
   - Enter Driver Name

2. **Add Items**
   - Click "+ Add Item"
   - Select Finished Good
   - Select Batch Number
   - Enter Quantity
   - Enter Unit Price
   - System calculates total value

3. **Process Dispatch**
   - Status: PENDING → LOADING → DISPATCHED → DELIVERED
   - Stock deducted on DISPATCHED status

### What to Check:
- ✅ Batch traceability
- ✅ Stock deduction on dispatch
- ✅ Total weight and value calculations
- ✅ Can only select finished goods

---

## Module 7: Reconciliation

**Who:** Production Manager / Accountant  
**Navigate to:** Reconciliation → Periods

### Test Steps:
1. **Create Reconciliation Period**
   - Click "+ New Period"
   - Select Month & Year
   - Select Branch
   - Status: Draft

2. **Raw Materials Section**
   - Enter Opening Stock (from previous month)
   - System shows Received (from GRNs)
   - System shows Transferred to Production
   - Enter Closing Stock (physical count)
   - System calculates variance

3. **Production Section**
   - System shows Expected Production
   - Enter Actual Production
   - System calculates variance

4. **Dispatch Section**
   - System shows Expected Dispatched
   - Enter Actual Dispatched
   - System calculates variance

5. **Complete & Approve**
   - Review all sections
   - Click "Complete"
   - Status: DRAFT → IN PROGRESS → COMPLETED → APPROVED

### What to Check:
- ✅ Variance calculations accurate
- ✅ Physical vs system stock comparison
- ✅ Monthly tracking over time
- ✅ Identifies loss points

---

## End-to-End Test Scenario

**Complete Production Workflow:**

1. **Production Manager:**
   - Create formulation "Broiler Starter 22%" (1000 kg batch)
   - Add ingredients: Maize 50%, Soya 35%, Limestone 15%
   - Activate formulation
   - Create production plan for 5000 kg
   - Confirm plan

2. **Production Manager:**
   - Create production order (1000 kg)
   - Link to plan
   - Select machine & operator
   - Materials auto-populate

3. **Warehouse Manager:**
   - Issue materials for production order
   - Verify stock deduction

4. **Operator:**
   - Start production
   - Add log: "Production started"
   - Add log: "Pause - 30 min break"
   - Record output: 980 kg produced, 10 kg rejected, 10 kg wastage
   - Complete production

5. **Warehouse Manager:**
   - Create dispatch order
   - Select finished batch
   - Dispatch 500 kg to branch
   - Mark as dispatched

6. **Production Manager:**
   - Create reconciliation period
   - Review variances
   - Approve period

---

## Common Challenges & Solutions

### Challenge 1: Cannot Start Production
**Cause:** Materials not issued  
**Solution:** Issue materials first (status must be MATERIALS ISSUED)

### Challenge 2: Formulation Not Appearing
**Cause:** Status is DRAFT  
**Solution:** Activate formulation to make it available

### Challenge 3: Stock Going Negative
**Cause:** Insufficient raw materials  
**Solution:** Create GRN to receive materials first

### Challenge 4: Percentage Not 100%
**Cause:** Ingredient percentages don't sum to 100%  
**Solution:** Adjust ingredient percentages to total exactly 100%

### Challenge 5: Cannot Complete Order
**Cause:** Output not recorded  
**Solution:** Record production output first

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

### Scenario 1: Rush Production
- Create formulation
- Immediate production order
- Same-day material issue, production, and dispatch
- Track time from order to delivery

### Scenario 2: Material Shortage
- Create production order requiring 500 kg Maize
- Ensure only 300 kg available
- Attempt to issue materials
- System should warn/block

### Scenario 3: Quality Failure
- Complete production with "Failed" quality status
- Verify stock not added to finished goods
- Track rejected quantity

### Scenario 4: Batch Traceability
- Receive raw material batch BATCH-RM-001
- Use in production → BATCH-PROD-001
- Dispatch to branch
- Trace full chain: Raw Material → Production → Dispatch

### Scenario 5: High Wastage Investigation
- Record production with 15% wastage
- Add logs documenting issues
- Review in reconciliation
- Identify root cause

---

## Success Criteria

After testing, the system should:

✅ **Accurate Material Flow:** Raw Materials → Production → Finished Goods → Dispatch  
✅ **Cost Tracking:** Know exact production cost per batch  
✅ **Variance Tracking:** All discrepancies captured and visible  
✅ **Batch Traceability:** Full chain from supplier to customer  
✅ **Real-time Status:** Production progress visible at all times  
✅ **Stock Accuracy:** Physical vs system stock reconciled monthly  
✅ **Audit Trail:** All actions logged with user and timestamp  

---

## Need Help?

- **Technical Issues:** Check browser console (F12) for errors
- **Data Issues:** Verify in Supabase dashboard
- **Workflow Questions:** Refer to this guide or ask system admin
- **Bug Reports:** Use feedback template above

**Happy Testing! 🏭**
