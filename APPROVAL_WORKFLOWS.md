# HYPER MES Approval Workflows
## Critical Data Entry & Approval Requirements

This document defines which data requires approval workflows and how to implement them to ensure data accuracy.

---

## Critical Data Requiring Approval

### 🔴 HIGH PRIORITY - Must Have Approval

#### 1. Formulations (Bill of Materials)
**Why Critical:** Incorrect formulas can lead to:
- Product quality issues
- Nutritional deficiencies
- Customer complaints
- Regulatory non-compliance
- Material wastage

**Approval Flow:**
```
Created by: Production Manager/Nutritionist (Draft)
    ↓
Reviewed by: Quality Manager (Review)
    ↓
Approved by: Technical Director/Admin (Active)
```

**Current Status Field:** `status` (draft, active, archived)

**Implementation Needed:**
- Add `created_by` field ✅ (already exists)
- Add `approved_by` field ✅ (already exists)
- Add `reviewed_by` field (NEW)
- Add `approved_at` timestamp (NEW)
- Add approval comments/notes (NEW)

**Business Rule:**
- Only "Active" formulations can be used in production
- Draft formulations cannot be selected in production orders
- Once approved, formulation becomes read-only (create new version to modify)

---

#### 2. Goods Received Notes (GRN)
**Why Critical:** Affects:
- Inventory valuation
- Supplier payments
- Stock availability
- Quality control

**Approval Flow:**
```
Created by: Warehouse Clerk (Pending)
    ↓
Quality Inspection: Quality Inspector (Inspecting)
    ↓
Verified by: Warehouse Supervisor (Verified) ⭐ NEW
    ↓
Approved by: Warehouse Manager (Approved/Rejected)
```

**Current Status Field:** `status` (pending, inspecting, verified, approved, rejected)

**Implementation Added:** ✅
- `verified_by` field (uuid) - Who verified the GRN
- `verified_at` timestamp - When verification occurred
- `verification_notes` field (text) - Verification comments
- `approved_by` field (already exists)
- `approved_at` timestamp (already exists)
- `rejection_reason` field (already exists)
- Link to quality inspection results

**Business Rule:**
- GRN must pass quality inspection before verification
- Verification confirms physical quantities match documentation
- Only verified GRNs can be approved
- Stock only updates when status = "Approved"
- Rejected GRNs do not update stock
- Cannot delete approved GRNs (audit trail)

---

#### 3. Production Orders
**Why Critical:** Affects:
- Material consumption
- Production costs
- Stock movements
- Financial reporting

**Approval Flow:**
```
Created by: Production Planner (Pending)
    ↓
Materials Issued: Warehouse Manager (Materials Issued)
    ↓
Started by: Production Supervisor (In Progress)
    ↓
Completed by: Production Supervisor (Completed)
    ↓
Verified by: Quality/Production Manager (Verified)
```

**Current Status Field:** `status` (pending, materials_issued, in_progress, completed, cancelled)

**Implementation Needed:**
- Add `verified_by` field (NEW)
- Add `verified_at` timestamp (NEW)
- Add `cancellation_reason` field (NEW)
- Add `cancelled_by` field (NEW)

**Business Rule:**
- Cannot start production without materials issued
- Cannot complete without recording output
- Completed orders are locked (no edits)
- Only supervisors+ can cancel orders

---

#### 4. Dispatch Orders
**Why Critical:** Affects:
- Branch inventory
- Revenue recognition
- Customer satisfaction
- Stock accuracy

**Approval Flow:**
```
Created by: Warehouse Clerk (Pending)
    ↓
Prepared by: Warehouse Staff (Loading)
    ↓
Approved by: Warehouse Manager (Dispatched)
    ↓
Confirmed by: Branch Manager (Delivered)
```

**Current Status Field:** `status` (pending, loading, dispatched, in_transit, delivered, cancelled)

**Implementation Needed:**
- Add `approved_by` field ✅ (already exists)
- Add `approved_at` timestamp (NEW)
- Add `delivered_by` field (NEW - branch receiver)
- Add `delivery_confirmation_notes` (NEW)

**Business Rule:**
- Stock deduction happens at "Dispatched" status
- Cannot edit dispatched orders
- Delivery confirmation required from branch

---

#### 5. Material Reconciliation
**Why Critical:** Affects:
- Financial statements
- Variance analysis
- Loss identification
- Management decisions

**Approval Flow:**
```
Created by: Warehouse Manager (Draft)
    ↓
Physical Count: Warehouse Team (In Progress)
    ↓
Reviewed by: Production Manager (Completed)
    ↓
Approved by: Finance Manager/Admin (Approved)
```

**Current Status Field:** `status` (draft, in_progress, completed, approved)

**Implementation Needed:**
- Add `reviewed_by` field (NEW)
- Add `reviewed_at` timestamp (NEW)
- Add `approved_by` field ✅ (already exists)
- Add `approved_at` timestamp (NEW)
- Add `variance_explanation` field (NEW - required if variance > 2%)

**Business Rule:**
- Cannot create new period until previous period is approved
- Variances > 5% require management explanation
- Approved reconciliations are locked

---

### 🟡 MEDIUM PRIORITY - Recommended Approval

#### 6. Quality Inspections
**Approval Flow:**
```
Performed by: Quality Inspector
    ↓
Verified by: Quality Manager (if result = Failed)
```

**Business Rule:**
- Failed inspections must be verified by manager
- Passed inspections can be auto-approved

---

#### 7. Raw Material Master Data
**Approval Flow:**
```
Created by: Inventory Clerk (Inactive)
    ↓
Approved by: Inventory Manager (Active)
```

**Business Rule:**
- New materials start as inactive
- Only active materials can be used in GRNs/Formulations

---

#### 8. Price Changes
**Approval Flow:**
```
Proposed by: Procurement Officer
    ↓
Approved by: Finance Manager
```

**Business Rule:**
- Price changes require approval
- Historical prices maintained for costing accuracy

---

## Implementation Recommendations

### Phase 1: Database Schema Updates (IMMEDIATE)

Add approval tracking fields to critical tables:

```sql
-- Add to formulations table
ALTER TABLE formulations ADD COLUMN reviewed_by uuid REFERENCES profiles(id);
ALTER TABLE formulations ADD COLUMN reviewed_at timestamptz;
ALTER TABLE formulations ADD COLUMN approved_at timestamptz;
ALTER TABLE formulations ADD COLUMN approval_notes text;

-- Add to goods_received_notes table
ALTER TABLE goods_received_notes ADD COLUMN approved_by uuid REFERENCES profiles(id);
ALTER TABLE goods_received_notes ADD COLUMN approved_at timestamptz;
ALTER TABLE goods_received_notes ADD COLUMN rejection_reason text;

-- Add to production_orders table
ALTER TABLE production_orders ADD COLUMN verified_by uuid REFERENCES profiles(id);
ALTER TABLE production_orders ADD COLUMN verified_at timestamptz;
ALTER TABLE production_orders ADD COLUMN cancelled_by uuid REFERENCES profiles(id);
ALTER TABLE production_orders ADD COLUMN cancellation_reason text;

-- Add to dispatch_orders table
ALTER TABLE dispatch_orders ADD COLUMN approved_at timestamptz;
ALTER TABLE dispatch_orders ADD COLUMN delivered_by uuid REFERENCES profiles(id);
ALTER TABLE dispatch_orders ADD COLUMN delivery_confirmation_notes text;

-- Add to reconciliation_periods table
ALTER TABLE reconciliation_periods ADD COLUMN reviewed_by uuid REFERENCES profiles(id);
ALTER TABLE reconciliation_periods ADD COLUMN reviewed_at timestamptz;
ALTER TABLE reconciliation_periods ADD COLUMN approved_at timestamptz;
ALTER TABLE reconciliation_periods ADD COLUMN variance_explanation text;
```

### Phase 2: UI/UX Updates (NEXT)

For each critical data entry screen, add:

1. **Status Badge** - Visual indicator of approval status
2. **Approval Button** - Only visible to authorized roles
3. **Approval History** - Who approved when, with comments
4. **Lock Icon** - Show when record is locked after approval
5. **Rejection Modal** - Require reason for rejection

### Phase 3: Role-Based Permissions (CRITICAL)

Define who can approve what:

| Data Type | Creator Role | Approver Role |
|-----------|-------------|---------------|
| Formulations | Production Manager | Technical Director/Admin |
| GRNs | Warehouse Clerk | Warehouse Manager |
| Production Orders | Production Planner | Production Supervisor |
| Dispatch Orders | Warehouse Clerk | Warehouse Manager |
| Reconciliation | Warehouse Manager | Finance Manager/Admin |
| Quality Inspections | Quality Inspector | Quality Manager |

### Phase 4: Notifications (RECOMMENDED)

Implement email/in-app notifications:

- **Pending Approval:** Notify approver when item needs approval
- **Approved:** Notify creator when item is approved
- **Rejected:** Notify creator with rejection reason
- **Overdue:** Remind approver if pending > 24 hours

### Phase 5: Audit Trail (MANDATORY)

Log all approval actions:

```sql
CREATE TABLE approval_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- 'created', 'submitted', 'approved', 'rejected', 'cancelled'
  performed_by uuid REFERENCES profiles(id),
  previous_status text,
  new_status text,
  comments text,
  created_at timestamptz DEFAULT now()
);
```

---

## Approval Workflow Examples

### Example 1: Formulation Approval

```
Day 1, 09:00 - Production Manager creates "Broiler Grower Feed v2"
              Status: Draft
              Created by: John Doe

Day 1, 14:00 - Quality Manager reviews formula
              Status: Draft → Under Review
              Reviewed by: Jane Smith
              Comments: "Protein content looks good, approved"

Day 2, 08:00 - Technical Director approves
              Status: Under Review → Active
              Approved by: Dr. Brown
              Approved at: 2026-03-18 08:00
              
Result: Formula is now available for production orders
```

### Example 2: GRN with Quality Failure

```
Day 1, 10:00 - Warehouse Clerk creates GRN-2026-050
              Status: Pending
              Supplier: ABC Grains
              Material: Maize Meal, 5000 kg

Day 1, 11:00 - Quality Inspector performs inspection
              Status: Pending → Inspecting
              Moisture: 18% (FAIL - max 14%)
              Result: Failed

Day 1, 11:30 - Warehouse Manager reviews and rejects
              Status: Inspecting → Rejected
              Rejected by: Mike Johnson
              Rejection reason: "Moisture content too high - 18% vs max 14%"
              
Result: Stock NOT updated, supplier notified to collect rejected material
```

### Example 3: Production Order Completion

```
Day 1, 08:00 - Production Planner creates order BATCH-2026-100
              Status: Pending
              Formulation: Broiler Starter
              Planned: 1000 kg

Day 1, 08:30 - Warehouse Manager issues materials
              Status: Pending → Materials Issued
              Issued by: Sarah Lee

Day 1, 09:00 - Production Supervisor starts production
              Status: Materials Issued → In Progress
              Started by: Tom Wilson
              Operator: Peter Moyo

Day 1, 13:00 - Production Supervisor completes
              Status: In Progress → Completed
              Completed by: Tom Wilson
              Actual output: 980 kg
              Wastage: 20 kg

Day 1, 14:00 - Production Manager verifies
              Status: Completed → Verified
              Verified by: John Doe
              Comments: "Good batch, wastage within acceptable range"
              
Result: Stock updated, costs calculated, batch ready for dispatch
```

---

## Testing Approval Workflows

### Test Case 1: Unauthorized Approval Attempt
1. Login as Warehouse Clerk
2. Try to approve a formulation
3. **Expected:** Access denied / Approve button not visible

### Test Case 2: Approval with Missing Information
1. Create GRN without quality inspection
2. Try to approve
3. **Expected:** Validation error - "Quality inspection required"

### Test Case 3: Edit After Approval
1. Approve a formulation
2. Try to edit ingredients
3. **Expected:** Record is locked - "Cannot edit approved formulation. Create new version."

### Test Case 4: Rejection Workflow
1. Create production order
2. Reject with reason "Insufficient materials"
3. **Expected:** Status = Cancelled, reason saved, creator notified

### Test Case 5: Multi-Level Approval
1. Create reconciliation period
2. Warehouse Manager marks as Completed
3. Finance Manager approves
4. **Expected:** Both approvals recorded, status progression correct

---

## Key Benefits of Approval Workflows

### 1. Data Accuracy
- ✅ Prevents errors from reaching production
- ✅ Multiple eyes review critical data
- ✅ Catches mistakes before they cause problems

### 2. Accountability
- ✅ Clear audit trail of who did what
- ✅ Cannot deny responsibility
- ✅ Performance tracking per user

### 3. Compliance
- ✅ Meets regulatory requirements
- ✅ Demonstrates due diligence
- ✅ Audit-ready documentation

### 4. Quality Control
- ✅ Ensures standards are met
- ✅ Prevents substandard materials/products
- ✅ Protects brand reputation

### 5. Financial Control
- ✅ Prevents unauthorized transactions
- ✅ Accurate inventory valuation
- ✅ Proper cost allocation

---

## Quick Start: Implementing Approvals

### Step 1: Update Database (Run SQL)
Copy the SQL commands from Phase 1 above and run in Supabase SQL Editor.

### Step 2: Update UI Components
Add approval buttons and status indicators to forms.

### Step 3: Add Validation Rules
Prevent status changes without proper authorization.

### Step 4: Test Thoroughly
Use the test cases above to validate workflows.

### Step 5: Train Users
Ensure everyone understands their approval responsibilities.

---

## Approval Workflow Checklist

Before going live, ensure:

- [ ] All approval fields added to database
- [ ] Role-based permissions configured
- [ ] Approval buttons visible only to authorized users
- [ ] Status transitions validated
- [ ] Rejection reasons captured
- [ ] Audit log implemented
- [ ] Email notifications working
- [ ] Locked records cannot be edited
- [ ] Historical data preserved
- [ ] Users trained on approval process

---

## Support & Questions

If you need help implementing approval workflows:
1. Review this document
2. Test with sample data first
3. Document any issues or edge cases
4. Train one department at a time
5. Gather feedback and refine

**Remember:** Approval workflows slow down data entry initially, but they prevent costly mistakes and ensure data integrity in the long run.
