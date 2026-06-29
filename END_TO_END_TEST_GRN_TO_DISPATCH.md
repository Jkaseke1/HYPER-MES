# End-to-End Test: GRN → Production → Dispatch

## Goal
Test the complete manufacturing flow from raw material receipt through production and dispatch to Sage.

## Prerequisites
1. Bridge worker running with `DRY_RUN=true` initially
2. Test Sage database configured
3. Clean test data in MES (reset transactions if needed)
4. Raw material with valid `sage_code` exists in MES and Sage
5. Finished product with valid `sage_code` exists in MES and Sage
6. Branch with valid `sage_code` exists in MES

## Test Scenario

### Materials Needed
| Role | Sage Code | Description |
|------|-----------|-------------|
| Raw Material | `RM-001` | Maize (or any RM) |
| Finished Good | `FG-001` | Broiler Starter Crumbs (or any formulation) |
| Branch | `BRANCH-001` | Any branch with warehouse mapping |

## Step 1: GRN — Receive Raw Materials

### Action in MES
1. Go to **Goods Received** page
2. Click **+ New GRN**
3. Enter:
   - Supplier: Test Supplier
   - Material: `RM-001`
   - Quantity: `1000` kg
   - Unit Cost: `$0.50`
   - Weigh Bridge Ticket: `WB-TEST-001`
4. Click **Save**

### Expected Result
- GRN status: `confirmed`
- `sync_log` entry created with event_type: `grn_confirmed`
- Bridge worker processes event
- Logs show: `[DRY RUN] Would execute: GRN receipt: 1000kg of RM-001 @ $0.50/kg`

### Verification in Sage
```sql
-- Check journal line
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'GRN-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check stock quantity (should increase by 1000 if not DRY_RUN)
SELECT QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = 'RM-001')
  AND WhseID = 18;

-- Check cost updated
SELECT fAverageCost FROM WhseStk 
WHERE WHStockLink = (SELECT StockLink FROM StkItem WHERE Code = 'RM-001')
  AND WHWhseID = 18;
```

---

## Step 2: Create Production Order

### Action in MES
1. Go to **Production Orders** page
2. Click **+ New Production Order**
3. Enter:
   - Formulation: `FG-001`
   - Planned Quantity: `500` kg
   - Start Date: Today
   - End Date: Today
4. Click **Save**

### Expected Result
- Production order created with status `planned`
- Batch number generated

---

## Step 3: Issue Materials to Production

### Action in MES
1. Open the production order from Step 2
2. Click **Issue Materials**
3. Select raw material: `RM-001`
4. Enter quantity: `600` kg
5. Click **Issue**

### Expected Result
- `production_order_materials` record created
- `sync_log` entry created with event_type: `materials_issued`
- Bridge worker processes event
- Logs show: `[DRY RUN] Would execute: Issue 600kg of RM-001 for {batch_number}`

### Verification in Sage
```sql
-- Check journal line
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'WO-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check RM stock decreased (WhseID=18)
SELECT QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = 'RM-001')
  AND WhseID = 18;
```

---

## Step 4: Complete Production Batch

### Action in MES
1. Open the production order
2. Enter actual quantity: `500` kg
3. Enter rejected quantity: `0` kg
4. Click **Complete Batch**

### Expected Result
- Production order status: `completed`
- `sync_log` entry created with event_type: `production_completed`
- Bridge worker processes event
- Logs show: `[DRY RUN] Would execute: FG receipt: 500kg of FG-001 into Despatch Warehouse`

### Verification in Sage
```sql
-- Check FG receipt journal
SELECT TOP 1 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'WO-%' 
  AND fQtyIn > 0
ORDER BY idInvJrBatchLines DESC;

-- Check FG stock increased (WhseID=20)
SELECT QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = 'FG-001')
  AND WhseID = 20;
```

---

## Step 5: Create Dispatch Order

### Action in MES
1. Go to **Dispatch** page
2. Click **+ New Dispatch**
3. Enter:
   - Branch: `BRANCH-001`
   - Dispatch Date: Today
4. Add dispatch item:
   - Formulation: `FG-001`
   - Quantity: `300` kg
   - Unit Price: `$2.00`
5. Click **Save**

### Expected Result
- Dispatch order created with status `pending`

---

## Step 6: Mark Dispatch as Delivered

### Action in MES
1. Open the dispatch order
2. Click **Mark as Dispatched**

### Expected Result
- Dispatch order status: `delivered`
- `sync_log` entry created with event_type: `dispatch_delivered`
- Bridge worker processes event
- Logs show: `[DRY RUN] Would execute: Dispatch 300kg of FG-001 to {branch_name}`

### Verification in Sage
```sql
-- Check two journal lines
SELECT TOP 2 * FROM _etblInvJrBatchLines 
WHERE cReference LIKE 'DSP-%' 
ORDER BY idInvJrBatchLines DESC;

-- Check DSP stock decreased (WhseID=20)
SELECT QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = 'FG-001')
  AND WhseID = 20;

-- Check branch stock increased
SELECT QtyOnHand FROM _etblStockQtys 
WHERE StockID = (SELECT StockLink FROM StkItem WHERE Code = 'FG-001')
  AND WhseID = (SELECT iWarehouseID FROM branches WHERE sage_code = 'BRANCH-001');
```

---

## Step 7: Verify Final Stock Balances

### Expected Quantities

| Warehouse | Item | Expected Qty After All Steps |
|-----------|------|------------------------------|
| RM (WhseID=18) | RM-001 | 400 kg (1000 - 600) |
| DSP (WhseID=20) | FG-001 | 200 kg (500 - 300) |
| Branch | FG-001 | 300 kg |

### Verification
```sql
-- RM warehouse
SELECT w.WhseID, s.Code, q.QtyOnHand
FROM _etblStockQtys q
JOIN StkItem s ON s.StockLink = q.StockID
JOIN WhseMst w ON w.WhseID = q.WhseID
WHERE s.Code = 'RM-001' AND q.WhseID = 18;

-- DSP warehouse
SELECT w.WhseID, s.Code, q.QtyOnHand
FROM _etblStockQtys q
JOIN StkItem s ON s.StockLink = q.StockID
JOIN WhseMst w ON w.WhseID = q.WhseID
WHERE s.Code = 'FG-001' AND q.WhseID = 20;

-- Branch warehouse
SELECT w.WhseID, s.Code, q.QtyOnHand
FROM _etblStockQtys q
JOIN StkItem s ON s.StockLink = q.StockID
JOIN WhseMst w ON w.WhseID = q.WhseID
WHERE s.Code = 'FG-001' AND w.WhseID = (SELECT whse_id FROM branches WHERE sage_code = 'BRANCH-001');
```

---

## Step 8: Switch to Live Mode and Repeat

After DRY_RUN tests pass:

1. Stop bridge worker
2. Set `DRY_RUN=false` in `.env`
3. Reset test data
4. Repeat Steps 1-7
5. Verify actual writes in Sage test database

---

## Test Results Log

| Step | Description | DRY_RUN Status | LIVE Status | Notes |
|------|-------------|----------------|-------------|-------|
| 1 | GRN Receipt | ⬜ | ⬜ | |
| 2 | Production Order | ⬜ | ⬜ | |
| 3 | Material Issue | ⬜ | ⬜ | |
| 4 | Batch Complete | ⬜ | ⬜ | |
| 5 | Create Dispatch | ⬜ | ⬜ | |
| 6 | Dispatch Delivered | ⬜ | ⬜ | |
| 7 | Final Balances | ⬜ | ⬜ | |

---

## Notes

- Start with DRY_RUN=true to verify the bridge logic without writing to Sage
- Check bridge worker logs after each action
- If any step fails, stop and fix before proceeding
- Keep the bridge worker terminal visible so you can watch the processing
