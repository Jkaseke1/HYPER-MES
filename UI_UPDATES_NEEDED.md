# UI Updates Needed for HYPER MES

This document tracks frontend UI updates needed to match the database schema.

---

## 1. Raw Materials Form

**Current UI Fields:**
- Name
- Code
- Category
- Unit
- Cost per Unit (ZAR)
- Reorder Level
- Description

**Missing Fields (exist in database):**
- ✅ Currency dropdown (USD, ZAR, ZWG, GBP)
- ✅ Warehouse selection (warehouse_id)
- ✅ Current Stock display
- ✅ Is Active toggle

**Database Fields Available:**
```sql
raw_materials table:
- id
- name ✓ (in UI)
- code ✓ (in UI)
- category ✓ (in UI)
- unit ✓ (in UI)
- cost_per_unit ✓ (in UI - shows as "Cost per Unit (ZAR)")
- currency_code ✗ (MISSING - needs dropdown)
- cost_per_unit_usd (auto-calculated)
- reorder_level ✓ (in UI)
- current_stock ✗ (MISSING - should be read-only display)
- warehouse_id ✗ (MISSING - needs dropdown)
- description ✓ (in UI)
- is_active ✗ (MISSING - needs toggle)
- created_at
- updated_at
```

**Required UI Changes:**

### Add Currency Dropdown
```typescript
<Select name="currency_code" label="Currency">
  <option value="USD">USD - US Dollar ($)</option>
  <option value="ZAR">ZAR - South African Rand (R)</option>
  <option value="ZWG">ZWG - Zimbabwe Gold (ZWG)</option>
  <option value="GBP">GBP - British Pound (£)</option>
</Select>
```

### Add Warehouse Dropdown
```typescript
<Select name="warehouse_id" label="Warehouse">
  <option value="">Select Warehouse</option>
  {warehouses.map(wh => (
    <option key={wh.id} value={wh.id}>{wh.name}</option>
  ))}
</Select>
```

### Add Current Stock Display
```typescript
<Input 
  name="current_stock" 
  label="Current Stock" 
  type="number"
  disabled
  value={material.current_stock}
  suffix={material.unit}
/>
```

### Add Active Toggle
```typescript
<Toggle 
  name="is_active" 
  label="Active"
  defaultChecked={true}
/>
```

---

## 2. Warehouse Form

**Current UI Fields:**
- Name
- Code
- Type
- Branch
- Location
- Active

**Missing Fields (exist in database):**
- ✅ Capacity (tons)
- ✅ Current Stock (tons)

**Database Fields Available:**
```sql
warehouses table:
- id
- name ✓ (in UI)
- code ✓ (in UI)
- type ✓ (in UI)
- branch_id ✓ (in UI)
- location ✓ (in UI)
- capacity_tons ✗ (MISSING)
- current_stock_tons ✗ (MISSING)
- is_active ✓ (in UI)
- created_at
- updated_at
```

**Required UI Changes:**

### Add Capacity Field
```typescript
<Input 
  name="capacity_tons" 
  label="Capacity (tons)" 
  type="number"
  step="0.01"
  placeholder="e.g., 500"
/>
```

### Add Current Stock Display
```typescript
<Input 
  name="current_stock_tons" 
  label="Current Stock (tons)" 
  type="number"
  disabled
  value={warehouse.current_stock_tons}
/>

// Add capacity utilization indicator
<ProgressBar 
  value={warehouse.current_stock_tons} 
  max={warehouse.capacity_tons}
  label={`${Math.round((warehouse.current_stock_tons / warehouse.capacity_tons) * 100)}% Full`}
/>
```

---

## 3. GRN Form

**Missing Fields:**
- ✅ Verified By (verifier approval step)
- ✅ Verified At (timestamp)
- ✅ Verification Notes
- ✅ Currency display for costs

**Required UI Changes:**

### Add Verification Section
```typescript
{grn.status === 'inspecting' && userRole === 'warehouse_supervisor' && (
  <div className="verification-section">
    <h3>Verification</h3>
    <TextArea 
      name="verification_notes"
      label="Verification Notes"
      placeholder="Confirm quantities and documentation..."
    />
    <Button onClick={handleVerify}>Verify GRN</Button>
  </div>
)}
```

### Show Currency in GRN Items
```typescript
<Table>
  <thead>
    <tr>
      <th>Material</th>
      <th>Quantity</th>
      <th>Unit Cost</th>
      <th>Currency</th>
      <th>Total (Local)</th>
      <th>Total (USD)</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td>{item.material_name}</td>
        <td>{item.quantity} {item.unit}</td>
        <td>{item.unit_cost}</td>
        <td>{item.currency_code}</td>
        <td>{formatCurrency(item.line_total, item.currency_code)}</td>
        <td>{formatCurrency(item.line_total_usd, 'USD')}</td>
      </tr>
    ))}
  </tbody>
</Table>
```

---

## 4. Production Orders

**Missing Fields:**
- ✅ Verified By
- ✅ Verified At
- ✅ Cancellation Reason
- ✅ Multi-currency cost display

---

## 5. Dispatch Orders

**Missing Fields:**
- ✅ Delivered By
- ✅ Delivery Confirmation Notes
- ✅ Multi-currency pricing

---

## 6. Formulations

**Missing Fields:**
- ✅ Reviewed By
- ✅ Reviewed At
- ✅ Approved At
- ✅ Approval Notes

**Required UI Changes:**

### Add Approval Workflow UI
```typescript
{formulation.status === 'draft' && (
  <div className="approval-section">
    <h3>Approval Workflow</h3>
    
    {userRole === 'quality_manager' && (
      <Button onClick={handleReview}>
        Mark as Reviewed
      </Button>
    )}
    
    {userRole === 'admin' && formulation.reviewed_by && (
      <div>
        <TextArea 
          name="approval_notes"
          label="Approval Notes"
        />
        <Button onClick={handleApprove}>
          Approve Formulation
        </Button>
      </div>
    )}
  </div>
)}

// Show approval history
{formulation.approved_by && (
  <div className="approval-history">
    <p>Reviewed by: {formulation.reviewer_name} on {formulation.reviewed_at}</p>
    <p>Approved by: {formulation.approver_name} on {formulation.approved_at}</p>
    {formulation.approval_notes && <p>Notes: {formulation.approval_notes}</p>}
  </div>
)}
```

---

## 7. Dashboard / Reports

**Missing Features:**
- ✅ Multi-currency summary
- ✅ Exchange rate display
- ✅ Warehouse capacity utilization
- ✅ Approval pending items count

---

## Priority Order

### High Priority (Core Functionality)
1. **Raw Materials - Currency Dropdown** - Critical for multi-currency support
2. **GRN - Verification Workflow** - Required for approval process
3. **Formulations - Approval Workflow** - Prevents bad recipes

### Medium Priority (Important Features)
4. **Raw Materials - Warehouse Assignment** - Better inventory tracking
5. **Warehouse - Capacity Fields** - Capacity management
6. **Production Orders - Verification** - Quality control

### Low Priority (Nice to Have)
7. **Multi-currency displays** - Enhanced reporting
8. **Current stock displays** - Real-time inventory view
9. **Approval history displays** - Audit trail visibility

---

## Implementation Notes

### Currency Dropdown Component
```typescript
// Fetch currencies from database
const { data: currencies } = await supabase
  .from('currencies')
  .select('*')
  .eq('is_active', true);

// Use in form
<Select name="currency_code" defaultValue="USD">
  {currencies.map(curr => (
    <option key={curr.code} value={curr.code}>
      {curr.code} - {curr.name} ({curr.symbol})
    </option>
  ))}
</Select>
```

### Warehouse Dropdown Component
```typescript
// Fetch warehouses for the branch
const { data: warehouses } = await supabase
  .from('warehouses')
  .select('*')
  .eq('is_active', true)
  .eq('type', 'raw_material'); // Filter by type if needed

<Select name="warehouse_id">
  <option value="">Select Warehouse</option>
  {warehouses.map(wh => (
    <option key={wh.id} value={wh.id}>
      {wh.name} ({wh.code})
    </option>
  ))}
</Select>
```

### Auto-calculate USD Cost
```typescript
// When currency or cost changes, auto-calculate USD equivalent
const handleCostChange = async (cost, currencyCode) => {
  if (currencyCode === 'USD') {
    setCostUsd(cost);
  } else {
    // Get exchange rate
    const rate = await getExchangeRate(currencyCode, 'USD');
    const usdCost = cost * rate;
    setCostUsd(usdCost);
  }
};
```

---

## Testing Checklist

After implementing UI changes:

- [ ] Can select currency when creating raw material
- [ ] USD cost auto-calculates based on exchange rate
- [ ] Can assign warehouse to raw material
- [ ] Warehouse capacity shows on warehouse form
- [ ] GRN verification workflow works
- [ ] Formulation approval workflow works
- [ ] Multi-currency costs display correctly in reports
- [ ] Approval history shows on approved records
- [ ] Currency symbols display correctly (R, $, £, ZWG)

---

## Database vs UI Field Mapping

| Database Field | UI Label | Component Type | Status |
|----------------|----------|----------------|--------|
| `currency_code` | Currency | Dropdown | ✗ Missing |
| `warehouse_id` | Warehouse | Dropdown | ✗ Missing |
| `capacity_tons` | Capacity (tons) | Number Input | ✗ Missing |
| `verified_by` | Verified By | Display/Button | ✗ Missing |
| `reviewed_by` | Reviewed By | Display/Button | ✗ Missing |
| `approved_by` | Approved By | Display/Button | ✗ Missing |

---

This document should be updated as UI changes are implemented.
