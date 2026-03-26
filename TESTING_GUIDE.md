# HYPER MES Testing Guide
## Step-by-Step Data Population & Testing

This guide will help you test the system by populating data in the correct order, simulating real production workflows.

---

## Phase 1: Master Data Setup (Foundation)

### 1.1 Create Branches
**Navigate to:** Settings → Branches

**Test Data:**
```
Branch 1:
- Name: Head Office - Production
- Code: HO-PROD
- Location: Harare
- Type: Production
- Status: Active

Branch 2:
- Name: Bulawayo Branch
- Code: BWY-01
- Location: Bulawayo
- Type: Sales
- Status: Active
```

**What to Test:**
- ✅ Can create a branch
- ✅ Branch code must be unique
- ✅ Can edit branch details
- ✅ Can set branch as active/inactive

---

### 1.2 Create Warehouses
**Navigate to:** Settings → Warehouses

**Test Data:**
```
Warehouse 1:
- Name: Main Raw Materials Store
- Code: WH-RM-01
- Type: Raw Material
- Branch: Head Office - Production
- Location: Building A, Section 1
- Active: ✓

Warehouse 2:
- Name: Finished Goods Store
- Code: WH-FG-01
- Type: Finished Goods
- Branch: Head Office - Production
- Location: Building B, Section 2
- Active: ✓
```

**What to Test:**
- ✅ Warehouse must be linked to a branch
- ✅ Can set warehouse type (Raw Material or Finished Goods)
- ✅ Code must be unique
- ✅ Can set active/inactive status
- ✅ Location field for physical location tracking

---

### 1.3 Create Suppliers
**Navigate to:** Procurement → Suppliers

**Test Data:**
```
Supplier 1:
- Name: Grain Suppliers Ltd
- Code: SUP-001
- Contact: John Doe
- Phone: +263 77 123 4567
- Email: john@grainsuppliers.co.zw
- Address: 123 Industrial Road, Harare
- Payment Terms: 30 days
- Status: Active
```

**What to Test:**
- ✅ Can create supplier
- ✅ Contact information saves correctly
- ✅ Can mark supplier as active/inactive

---

### 1.4 Create Machines
**Navigate to:** Production → Machines

**Test Data:**
```
Machine 1:
- Name: Pellet Mill #1
- Code: PM-001
- Type: Pellet Mill
- Branch: Head Office - Production
- Capacity: 5 tons/hour
- Status: Operational

Machine 2:
- Name: Mixer #1
- Code: MX-001
- Type: Mixer
- Capacity: 2 tons/hour
- Status: Operational
```

**What to Test:**
- ✅ Machine capacity tracking
- ✅ Machine status (Operational, Maintenance, Breakdown)
- ✅ Can link machine to branch

---

## Phase 2: Raw Materials Management

### 2.1 Create Raw Materials
**Navigate to:** Click "Raw Materials" in the left sidebar menu

**Test Data:**
```
Material 1:
- Name: Maize Meal
- Code: RM-001
- Category: Grain
- Unit: ton
- Cost per Unit: 500.00
- Currency: USD (US Dollar)
- Reorder Level: 1
- Warehouse: Main Raw Materials Store (if created)
- Description: Yellow maize meal for feed production

Material 2:
- Name: Soya Bean Meal
- Code: RM-002
- Category: Protein
- Unit: ton
- Cost per Unit: 800.00
- Currency: USD (US Dollar)
- Reorder Level: 0.5
- Warehouse: Main Raw Materials Store (if created)

Material 3:
- Name: Limestone
- Code: RM-003
- Category: Mineral
- Unit: ton
- Cost per Unit: 100.00
- Currency: USD (US Dollar)
- Reorder Level: 0.2
- Warehouse: Main Raw Materials Store (if created)

Material 4:
- Name: Vitamin Premix
- Code: RM-004
- Category: Vitamin
- Unit: ton
- Cost per Unit (GBP): 50000.00
- Currency: GBP (Pound)
- Reorder Level: 0.1 ton
```

**Note:** Make sure to select a warehouse for each material. The form now includes a warehouse dropdown and the cost currency defaults to USD, so adjust only if you need another currency.

**What to Test:**
- ✅ Different categories work
- ✅ Reorder level alerts (when stock < reorder level)
- ✅ Cost tracking per material

---

### 2.2 Create Goods Received Note (GRN)
**Navigate to:** Click "Goods Received" in the left sidebar menu

**Test Data:**
```
GRN 1:
- GRN Number: GRN-2026-001
- Supplier: Grain Suppliers Ltd (select from dropdown)
- Warehouse: Main Raw Materials Store (select from dropdown)
- Received Date: Today's date (18/03/2026)
- Notes: Optional delivery notes

Line Items (click "+ Add Item" to add more):
1. Material: Maize Meal
   - Ordered Qty: 5
   - Received Qty: 5
   - Unit Cost: 500
   - Batch Number: BATCH-MM-001
   - Expiry Date: (optional)

2. Material: Soya Bean Meal
   - Ordered Qty: 2
   - Received Qty: 1.95
   - Unit Cost: 800
   - Batch Number: BATCH-SB-001
   - Expiry Date: (optional)

**Note:** All costs are in USD (base currency). Total value will be calculated as: (5 × $500) + (1.95 × $800) = $4,060.00
```

**Note:** Status automatically defaults to "Pending" when created. You'll see the status in the GRN list after saving.

**What to Test:**
- ✅ Can add multiple line items
- ✅ Ordered vs Received quantity tracking
- ✅ Batch number assignment
- ✅ Total value calculation
- ✅ Status workflow: Pending → Inspecting → Approved

---

### 2.3 Quality Inspection
**Navigate to:** Click "Quality Inspection" in the left sidebar menu

**Test Data:**
```
Inspection 1:
- GRN: GRN-2026-001
- Material: Maize Meal
- Batch: BATCH-MM-001
- Inspection Date: Today
- Moisture Content: 12.5%
- Protein Content: 8.2%
- Fat Content: (leave blank)
- Fiber Content: (leave blank)
- Result: Passed
- Remarks: Good quality, within specifications
```

**Field Checklist:**
- GRN Number dropdown (required) – loads materials from that GRN
- Material dropdown (required) – auto-fills Batch Number after selection
- Batch Number (read-only once material is picked)
- Inspection Date (required)
- Quality Parameters (optional unless you need the metric): Moisture %, Protein %, Fat %, Fiber %
- Result (required) – Pending / Passed / Failed / Conditional
- Remarks (optional text area)

**What to Test:**
- ✅ Link inspection to GRN
- ✅ Record quality parameters
- ✅ Pass/Fail/Conditional results
- ✅ Only approved GRNs update stock

---

## Phase 3: Formulations (Bill of Materials)

### 3.1 Create Formulation
**Navigate to:** Click "Formulations" in the left sidebar menu

**Test Data:**
```
Formulation 1:
- Name: Broiler Starter Feed
- Code: FORM-BS-001
- Version: 1
- Category: Broiler
- Batch Size: 1000
- Batch Unit: kg (select from dropdown)
- Target Protein: 22%
- Target Fat: 5%
- Target Fiber: 3%
- Target Moisture: 12%
- Status: Draft
- Description: Early growth feed for broilers (optional)

Ingredients:
1. Maize Meal - 500 kg (50%)
2. Soya Bean Meal - 350 kg (35%)
3. Limestone - 150 kg (15%)

Estimated Cost: (500 × 0.50) + (350 × 0.80) + (150 × 0.10) = $545 per 1000kg batch
Cost per kg: $0.545
```

**Field Checklist:**
- Name (required)
- Code (required)
- Batch Size (required number) and Batch Unit (kg, ton, etc.)
- Category dropdown (Broiler / Layer / etc.)
- Status dropdown (Draft / Active)
- Description (optional free text)
- Nutritional targets – Protein %, Fat %, Fiber %, Moisture %
- Ingredients table (each row has):
  1. **Raw Material** dropdown (shows name + code from Raw Materials list)
  2. **Qty** input (required number matching the batch unit)
  3. **Unit** text box (defaults to `kg`, edit if using tons/% for liquids)
  4. **%** input (required percentage share of the batch – totals must equal 100%)
  5. **Critical** checkbox (tick materials that must always be present)
  6. **Trash icon** on the far right to remove the row
- Use the **+ Add** button to insert each ingredient row before saving
- Total indicator (top-right of Ingredients block) must read **100%** before "Save Formula" is enabled

**What to Test:**
- ✅ Percentage calculation (must total 100%)
- ✅ Cost calculation based on raw material costs
- ✅ Can save as Draft
- ✅ Can activate formulation (Draft → Active)
- ✅ Version control (can create v2, v3)

---

## Phase 4: Production Planning & Execution

### 4.1 Create Production Plan
**Navigate to:** Production → Production Plans

**Test Data:**
```
Plan 1:
- Plan Number: PP-2026-001
- Plan Date: Today
- Start Date: Today
- End Date: +7 days
- Status: Draft

Plan Items:
1. Formulation: Broiler Starter Feed
   Planned Quantity: 5000 kg
   Priority: High
```

**What to Test:**
- ✅ Can add multiple formulations to one plan
- ✅ Status: Draft → Confirmed → In Progress → Completed
- ✅ Date range validation

---

### 4.2 Create Production Order
**Navigate to:** Production → Production Orders

**Test Data:**
```
Order 1:
- Batch Number: BATCH-PROD-001
- Plan: PP-2026-001
- Formulation: Broiler Starter Feed
- Machine: Pellet Mill #1
- Planned Quantity: 1000 kg
- Status: Pending
- Priority: Normal
- Planned Start: Today 08:00
- Planned End: Today 12:00
- Operator: (Select your admin user)

Materials (Auto-populated from formulation):
1. Maize Meal - Planned: 500 kg
2. Soya Bean Meal - Planned: 350 kg
3. Limestone - Planned: 150 kg
```

**What to Test:**
- ✅ Materials auto-populate from formulation
- ✅ Can issue materials (Status: Pending → Materials Issued)
- ✅ Can start production (Materials Issued → In Progress)
- ✅ Track actual quantities used vs planned

---

### 4.3 Record Production Output
**Navigate to:** Production → Production Orders → [Select Order] → Record Output

**Test Data:**
```
Output 1:
- Batch Number: BATCH-PROD-001
- Quantity Produced: 980 kg (2% loss)
- Rejected Quantity: 10 kg
- Wastage: 10 kg
- Quality Status: Passed
- Warehouse: Finished Goods Store
- Notes: Minor spillage during bagging
```

**What to Test:**
- ✅ Actual vs Planned variance calculation
- ✅ Stock movement to finished goods warehouse
- ✅ Wastage tracking
- ✅ Quality status affects stock availability
yes 
---

### 4.4 Production Logs
**Navigate to:** Production → Production Orders → [Select Order] → Logs

**Test Data:**
```
Log 1:
- Type: Start
- Description: Production started
- Time: 08:00

Log 2:
- Type: Pause
- Description: Machine maintenance check
- Started: 10:00
- Ended: 10:30
- Duration: 30 minutes

Log 3:
- Type: Issue
- Description: Material shortage - waiting for limestone
- Time: 11:00

Log 4:
- Type: Stop
- Description: Production completed
- Time: 12:30
```

**What to Test:**
- ✅ Different log types
- ✅ Downtime tracking
- ✅ Issue documentation
- ✅ Timeline view of production

---

## Phase 5: Warehouse & Dispatch

### 5.1 Stock Movements
**Navigate to:** Warehouse → Stock Movements

**What to Test:**
- ✅ View all material movements (GRN receipts, production issues, production outputs)
- ✅ Filter by warehouse, material, date range
- ✅ Audit trail is complete

---

### 5.2 Create Dispatch Order
**Navigate to:** Warehouse → Dispatch Orders

**Test Data:**
```
Dispatch 1:
- Dispatch Number: DISP-2026-001
- Branch: Bulawayo Branch
- Warehouse: Finished Goods Store
- Dispatch Date: Today
- Vehicle Number: ABC 1234
- Driver Name: Peter Moyo
- Status: Pending

Items:
1. Broiler Starter Feed - Batch: BATCH-PROD-001, Quantity: 500 kg, Unit Price: $0.70
```

**What to Test:**
- ✅ Can select finished goods only
- ✅ Batch traceability
- ✅ Status workflow: Pending → Loading → Dispatched → Delivered
- ✅ Stock deduction on dispatch
- ✅ Total weight and value calculation

---

## Phase 6: Material Reconciliation

### 6.1 Create Reconciliation Period
**Navigate to:** Reconciliation → Periods

**Test Data:**
```
Period 1:
- Month: March
- Year: 2026
- Branch: Head Office - Production
- Status: Draft

Raw Materials Section:
- Opening Stock: 7000 kg (from previous month or initial stock)
- Received (GRNs): 7000 kg
- Transferred to Production: 1000 kg
- Closing Stock (Physical Count): 5950 kg
- System Closing: 6000 kg
- Variance: -50 kg (-0.83%)

Production Section:
- Expected Production: 1000 kg
- Actual Production: 980 kg
- Variance: -20 kg (-2%)

Dispatch Section:
- Expected Dispatched: 500 kg
- Actual Dispatched: 500 kg
- Variance: 0 kg (0%)
```

**What to Test:**
- ✅ Variance calculations
- ✅ Physical vs system stock comparison
- ✅ Identify loss points (receiving, production, dispatch)
- ✅ Status: Draft → In Progress → Completed → Approved
- ✅ Monthly tracking over time

---

## Testing Scenarios to Validate

### Scenario 1: Material Shortage
1. Create production order requiring 500 kg Maize Meal
2. Ensure only 300 kg available in stock
3. **Expected:** System should warn about insufficient materials
4. **Test:** Can you still issue materials? Should be blocked or flagged

### Scenario 2: Quality Failure
1. Create GRN with quality inspection
2. Mark inspection as "Failed"
3. **Expected:** Stock should not be updated, GRN status = Rejected
4. **Test:** Failed materials don't appear in available stock

### Scenario 3: Production Wastage Tracking
1. Create production order for 1000 kg
2. Record output: 900 kg produced, 50 kg rejected, 50 kg wastage
3. **Expected:** Total = 1000 kg, wastage % = 10%
4. **Test:** Wastage appears in reports

### Scenario 4: Batch Traceability
1. Receive raw material with batch BATCH-RM-001
2. Use in production order → produces BATCH-PROD-001
3. Dispatch BATCH-PROD-001 to branch
4. **Expected:** Can trace from dispatch → production → raw material batch
5. **Test:** Full traceability chain works

### Scenario 5: Multi-User Workflow
1. Operator creates production order
2. Supervisor approves and starts production
3. Warehouse manager issues materials
4. **Expected:** Role-based permissions work correctly
5. **Test:** Each user can only perform their authorized actions

---

## Common Issues to Watch For

### Data Entry Errors
- ❌ Negative quantities
- ❌ Quantities exceeding capacity
- ❌ Missing required fields
- ❌ Duplicate codes (GRN numbers, batch numbers)
- ❌ Invalid date ranges (end date before start date)

### Calculation Errors
- ❌ Formulation percentages not totaling 100%
- ❌ Cost calculations incorrect
- ❌ Variance calculations wrong
- ❌ Stock balance going negative

### Workflow Errors
- ❌ Skipping approval steps
- ❌ Editing locked/approved records
- ❌ Deleting records with dependencies

---

## Success Metrics

After completing all phases, you should be able to:

✅ **Track Material Flow:** Raw Material → Production → Finished Goods → Dispatch  
✅ **Calculate Costs:** Know exact production cost per batch  
✅ **Identify Variances:** See where materials are lost/wasted  
✅ **Trace Batches:** From supplier to customer  
✅ **Monitor Production:** Real-time status of all orders  
✅ **Reconcile Monthly:** Physical vs system stock matching  
✅ **Generate Reports:** Production efficiency, wastage, costs  

---

## Next Steps

1. **Populate Sample Data:** Follow phases 1-6 above
2. **Test All Workflows:** Complete all testing scenarios
3. **Document Issues:** Note any bugs or confusing workflows
4. **Train Users:** Use this guide to train production staff
5. **Go Live:** Start with one production line, then scale up

---

## Need Help?

- Check console errors in browser (F12)
- Review Supabase logs for database errors
- Test with small quantities first
- Keep track of batch numbers for traceability testing
