# Bridge Worker Testing Guide

## Overview
This guide walks through testing all 7 bridge events that sync data from HYPER-MES to Sage Pastel.

## Pre-Test Setup

### 1. Verify Bridge Configuration
```bash
cd "C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES\bridge"
```

Check `.env` file has:
- `SAGE_DATABASE` = your test database name
- `DRY_RUN=true` (for initial test run)
- Valid Supabase credentials

### 2. Start Bridge Worker
```bash
node bridgeWorker.js
```

Keep this running in a terminal. It polls every 30 seconds.

---

## Event 1: Goods Receipt (GRN → Sage)

**Trigger:** When a GRN is created and marked as received

### Test Steps:
1. Go to **Goods Received** page in MES
2. Click **+ New GRN**
3. Fill in:
   - Supplier: (any)
   - Material: Select a material with valid `sage_code`
   - Quantity: 100 kg
   - Unit Cost: $1.50/kg
   - Weigh Bridge Ticket: TEST-001
4. Click **Save**
5. Watch bridge worker terminal for Event 1 processing

### Expected Bridge Actions:
- ✅ Inserts journal line into `_etblInvJrBatchLines`
- ✅ Updates `QtyOnHand` in `_etblStockQtys` (WhseID=18)
- ✅ Updates average cost in `StkItem`
- ✅ Marks sync event as `completed` in MES

### Verification in Sage:
```sql
-- Check journal line
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'GRN-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check stock quantity
SELECT StockLink, QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = '<material_sage_code>')
  AND WhseID = 18;
```

---

## Event 2: Goods Issue (Material Issue → Sage)

**Trigger:** When materials are issued to a production order

### Test Steps:
1. Go to **Production Orders** page
2. Open an existing order or create new one
3. Click **Issue Materials**
4. Select material and enter quantity
5. Click **Issue**
6. Watch bridge worker terminal for Event 2 processing

### Expected Bridge Actions:
- ✅ Inserts journal line with `fQtyOut` (negative)
- ✅ Decrements `QtyOnHand` in `_etblStockQtys` (WhseID=18)
- ✅ Marks sync event as `completed`

### Verification in Sage:
```sql
-- Check journal line
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'WO-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check stock decreased
SELECT StockLink, QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = '<material_sage_code>')
  AND WhseID = 18;
```

---

## Event 3: Batch Complete (Production → Sage FG Receipt)

**Trigger:** When a production batch is marked as completed

### Test Steps:
1. Go to **Production Orders** page
2. Open a batch that has materials issued
3. Enter **Actual Quantity** produced
4. Click **Complete Batch**
5. Watch bridge worker terminal for Event 3 processing

### Expected Bridge Actions:
- ✅ Inserts FG receipt journal line
- ✅ Increases `QtyOnHand` in `_etblStockQtys` (WhseID=20 - Finished Goods)
- ✅ Marks sync event as `completed`

### Verification in Sage:
```sql
-- Check FG receipt
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'BATCH-%' 
  AND fQtyIn > 0
ORDER BY idInvJrBatchLines DESC;

-- Check FG stock increased
SELECT StockLink, QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = '<fg_sage_code>')
  AND WhseID = 20;
```

---

## Event 4: Dispatch (FG Transfer → Branches)

**Trigger:** When a dispatch order is marked as dispatched

### Test Steps:
1. Go to **Dispatch** page
2. Create new dispatch order
3. Select branch warehouse
4. Add finished goods items
5. Click **Mark as Dispatched**
6. Watch bridge worker terminal for Event 4 processing

### Expected Bridge Actions:
- ✅ Creates two-leg transfer:
  - Leg 1: Deduct from DSP warehouse (WhseID=20)
  - Leg 2: Add to branch warehouse (WhseID varies)
- ✅ Inserts two journal lines
- ✅ Marks sync event as `completed`

### Verification in Sage:
```sql
-- Check dispatch transfer out
SELECT TOP 2 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'DSP-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check DSP warehouse decreased
SELECT StockLink, QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = '<fg_sage_code>')
  AND WhseID = 20;

-- Check branch warehouse increased
SELECT StockLink, QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = '<fg_sage_code>')
  AND WhseID = <branch_whse_id>;
```

---

## Event 7: Macropack Manufactured

**Trigger:** When a macropack production order is completed

### Test Steps:
1. Go to **Macropack Manufacturing** page
2. Create new macropack order
3. Issue ingredients
4. Enter actual quantity produced
5. Click **Complete**
6. Watch bridge worker terminal for Event 7 processing

### Expected Bridge Actions:
- ✅ Inserts macropack receipt journal line
- ✅ Increases macropack `QtyOnHand` in `_etblStockQtys`
- ✅ Marks sync event as `completed`

### Verification in Sage:
```sql
-- Check macropack receipt
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'MP-%' 
ORDER BY idInvJrBatchLines DESC;
```

---

## Event 8: Reconciliation Variance Approved

**Trigger:** When RM reconciliation variance is approved

### Test Steps:
1. Go to **Monthly RM Reconciliation** page
2. Create reconciliation for current month
3. Enter variances
4. Click **Approve**
5. Watch bridge worker terminal for Event 8 processing

### Expected Bridge Actions:
- ✅ Adjusts `QtyOnHand` for materials with variance
- ✅ Inserts adjustment journal lines
- ✅ Marks sync event as `completed`

---

## Event 9: RM Cost Updated

**Trigger:** When raw material cost is updated in RM Prices page

### Test Steps:
1. Go to **RM Prices** page
2. Edit a material's unit cost
3. Click **Save**
4. Watch bridge worker terminal for Event 9 processing

### Expected Bridge Actions:
- ✅ Updates `fExclCost` in `StkItem` table
- ✅ Marks sync event as `completed`

### Verification in Sage:
```sql
-- Check cost updated
SELECT Code, Description_1, fExclCost 
FROM StkItem 
WHERE Code = '<material_sage_code>';
```

---

## Common Issues & Troubleshooting

### Bridge Not Processing Events
- Check `sync_log` table in Supabase for `pending` events
- Verify bridge worker is running (check terminal)
- Check for errors in bridge worker logs

### "Material not found in Sage" Error
- Verify `raw_materials.sage_code` matches `StkItem.Code` in Sage
- Check `ItemActive = 1` in Sage

### Duplicate Entries
- Bridge has idempotency check via `sync_log.processed_at`
- If event is already `completed`, it won't process again

### DRY_RUN Mode
- When `DRY_RUN=true`, bridge logs SQL but doesn't execute
- Review logs to verify correctness
- Set `DRY_RUN=false` to actually write to Sage

---

## Test Checklist

- [ ] Event 1: GRN → Sage goods receipt
- [ ] Event 2: Material issue → Sage goods issue
- [ ] Event 3: Batch complete → Sage FG receipt
- [ ] Event 4: Dispatch → Sage two-leg transfer
- [ ] Event 7: Macropack complete → Sage receipt
- [ ] Event 8: Reconciliation variance → Sage adjustment
- [ ] Event 9: RM cost update → Sage cost update
- [ ] Verify all `sync_log` entries marked as `completed`
- [ ] Verify no duplicate entries in Sage
- [ ] Verify stock quantities match between MES and Sage

---

## Next Steps After Testing

1. If all tests pass with `DRY_RUN=true`, review logs
2. Set `DRY_RUN=false` and re-test one event at a time
3. Verify actual Sage database changes
4. Document any issues or edge cases
5. Prepare for production deployment
